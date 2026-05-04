import { NextResponse } from "next/server";

import { coachSummary, type CoachSnapshot } from "@/lib/modelClient";
import { db, getSkill, getTopics } from "@/lib/db";
import { mastery } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const snapshot = buildSnapshot();
  try {
    const summary = await coachSummary(snapshot);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("coach model unavailable", err);
    return NextResponse.json({ summary: localCoachSummary(snapshot), fallback: true });
  }
}

function buildSnapshot(): CoachSnapshot {
  const d = db();
  const now = Math.floor(Date.now() / 1000);

  const exams = d
    .prepare(
      `SELECT type, started_at, raw_score, scaled_score
         FROM exams
        WHERE completed_at IS NOT NULL
        ORDER BY started_at DESC
        LIMIT 5`
    )
    .all() as Array<{
    type: string;
    started_at: number;
    raw_score: number | null;
    scaled_score: number | null;
  }>;

  const topics = getTopics();
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const skills = getSkill();
  const ranked = skills
    .map((s) => {
      const t = topicById.get(s.topic_id);
      return {
        section: t?.section ?? s.topic_id,
        name: t?.name ?? "",
        mastery_pct: Math.round(mastery(s.elo, s.ema_accuracy, s.n_seen) * 100),
        n_seen: s.n_seen,
      };
    })
    .filter((r) => r.n_seen > 0)
    .sort((a, b) => a.mastery_pct - b.mastery_pct)
    .slice(0, 10);

  const mcqByUnit = d
    .prepare(
      `SELECT t.unit AS unit,
              COUNT(*) AS n,
              ROUND(AVG(a.correct) * 100) AS accuracy_pct
         FROM attempts a
         JOIN questions q ON q.id = a.question_id
         JOIN topics t ON t.id = q.topic_id
        WHERE q.type = 'mcq'
        GROUP BY t.unit
        ORDER BY t.unit`
    )
    .all() as Array<{ unit: number; n: number; accuracy_pct: number }>;

  const frqByArchetype = d
    .prepare(
      `SELECT q.archetype AS archetype,
              COUNT(*) AS n,
              ROUND(AVG(a.points_earned * 1.0 / NULLIF(q.total_points, 0)) * 100) AS avg_pct
         FROM attempts a
         JOIN questions q ON q.id = a.question_id
        WHERE q.type = 'frq' AND a.points_earned IS NOT NULL
        GROUP BY q.archetype`
    )
    .all() as Array<{ archetype: string; n: number; avg_pct: number | null }>;

  const totalAttempts = (d
    .prepare(`SELECT COUNT(*) AS n FROM attempts`)
    .get() as { n: number }).n;

  return {
    recent_exams: exams.map((e) => ({
      type: e.type,
      raw: e.raw_score,
      scaled: e.scaled_score,
      days_ago: Math.max(0, Math.floor((now - e.started_at) / 86400)),
    })),
    weakest_topics: ranked,
    mcq_by_unit: mcqByUnit,
    frq_by_archetype: frqByArchetype.map((r) => ({
      archetype: r.archetype,
      n: r.n,
      avg_pct: r.avg_pct ?? 0,
    })),
    total_attempts: totalAttempts,
  };
}

function localCoachSummary(snapshot: CoachSnapshot): string {
  if (snapshot.total_attempts === 0) {
    return "No practice data yet. Take one full MCQ or official practice section first so the dashboard has enough signal to pick the right drills.";
  }

  const weak = snapshot.weakest_topics
    .filter((t) => t.n_seen > 0)
    .slice(0, 2)
    .map((t) => `${t.section} ${t.name}`);
  const unit = snapshot.mcq_by_unit
    .filter((u) => u.n > 0)
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct)[0];
  const frq = snapshot.frq_by_archetype
    .filter((a) => a.n > 0)
    .sort((a, b) => a.avg_pct - b.avg_pct)[0];

  if (weak.length > 0) {
    const unitText = unit ? ` Unit ${unit.unit} is your lowest MCQ band at ${unit.accuracy_pct}%.` : "";
    return `Drill ${weak.join(" and ")} next; those are your weakest seen topics.${unitText}`;
  }
  if (frq) {
    return `Your weakest FRQ archetype is ${frq.archetype} at ${frq.avg_pct}%. Do one timed FRQ there, then review missed rubric points.`;
  }
  return "You have some attempts logged, but not enough topic-level signal yet. Do a focused MCQ set or a full practice exam next.";
}
