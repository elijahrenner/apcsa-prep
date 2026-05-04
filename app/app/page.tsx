import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

import { CoachCard } from "@/components/CoachCard";
import { db, getSkill, getTopics, type Topic, type SkillRow } from "@/lib/db";
import { mastery } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");
const EXAM_DATE = "2026-05-22";

export default function DashboardPage() {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-8">
        <h1 className="text-lg font-semibold text-neutral-900">No question bank yet</h1>
        <p className="mt-2 text-sm text-neutral-700">
          Run <code>make seed</code>{" "}
          in <code>../pipeline</code>{" "}
          to build the SQLite database. Then refresh.
        </p>
      </div>
    );
  }

  const topics = getTopics();
  const skillByTopic = new Map(getSkill().map((s) => [s.topic_id, s]));
  const byUnit = new Map<number, Topic[]>();
  for (const t of topics) {
    if (!byUnit.has(t.unit)) byUnit.set(t.unit, []);
    byUnit.get(t.unit)!.push(t);
  }

  const exams = db()
    .prepare(
      `SELECT id, type, started_at, raw_score, scaled_score
         FROM exams WHERE completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 12`
    )
    .all() as Array<{
    id: number;
    type: string;
    started_at: number;
    raw_score: number | null;
    scaled_score: number | null;
  }>;

  const days = daysUntil(EXAM_DATE);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Overview
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
            Dashboard
          </h1>
        </div>
        <div className="glass rounded-2xl px-6 py-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Days until exam
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight text-neutral-900 tabular-nums">
              {days}
            </span>
            <span className="text-sm text-neutral-500">
              · May 22, 2026
            </span>
          </div>
        </div>
      </header>

      <CoachCard />

      <section className="glass rounded-2xl p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
              Skills
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Each square is a CED topic. Click to drill into focused practice.
            </p>
          </div>
          <Legend />
        </div>
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((u) => (
            <UnitRow
              key={u}
              unit={u}
              topics={byUnit.get(u) ?? []}
              skillByTopic={skillByTopic}
            />
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Practice exam log
          </h2>
          <Link
            href="/exams"
            className="text-xs font-medium text-neutral-700 underline underline-offset-4 hover:no-underline"
          >
            Take a new exam →
          </Link>
          <Link
            href="/exams/history"
            className="text-xs font-medium text-neutral-700 underline underline-offset-4 hover:no-underline"
          >
            Analyze past exams →
          </Link>
        </div>
        {exams.length === 0 ? (
          <div className="px-5 py-8 text-sm text-neutral-500 text-center">
            No exams completed yet.{" "}
            <Link
              href="/exams"
              className="text-neutral-900 underline underline-offset-2 hover:no-underline"
            >
              Take your first one
            </Link>
            .
          </div>
        ) : (
          <div className="divide-y divide-white/60">
            <div className="grid grid-cols-[1fr_8rem_5rem_5rem] gap-3 px-5 py-2 text-[11px] uppercase tracking-wide text-neutral-500">
              <span>Date</span>
              <span>Type</span>
              <span>Raw</span>
              <span>Scaled</span>
            </div>
            {exams.map((e) => (
              <Link
                key={e.id}
                href={`/exams/history?exam=${e.id}`}
                className="grid grid-cols-[1fr_8rem_5rem_5rem] gap-3 px-5 py-2.5 text-sm hover:bg-white/40 transition-colors"
              >
                <span className="font-mono text-xs text-neutral-600">
                  {new Date(e.started_at * 1000).toLocaleString()}
                </span>
                <span className="text-neutral-900">{prettyType(e.type)}</span>
                <span className="font-mono text-neutral-700">
                  {e.raw_score ?? " - "}
                </span>
                <span className="font-mono font-medium text-neutral-900">
                  {e.scaled_score ?? " - "}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden sm:flex items-center gap-2 text-[11px] text-neutral-500">
      <span>weak</span>
      <span className="flex items-center gap-px">
        {[0.05, 0.2, 0.4, 0.6, 0.8, 0.95].map((m) => (
          <span
            key={m}
            className="h-2.5 w-2.5 first:rounded-l-sm last:rounded-r-sm ring-1 ring-blue-800/10"
            style={{ background: heatColor(m) }}
          />
        ))}
      </span>
      <span>strong</span>
    </div>
  );
}

function UnitRow({
  unit,
  topics,
  skillByTopic,
}: {
  unit: number;
  topics: Topic[];
  skillByTopic: Map<string, SkillRow>;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-500">
        Unit {unit}
      </span>
      <div className="flex flex-wrap gap-[3px]">
        {topics.map((t) => {
          const s = skillByTopic.get(t.id);
          const m = s ? mastery(s.elo, s.ema_accuracy, s.n_seen) : 0;
          return (
            <Link
              key={t.id}
              href={`/practice?topic=${t.id}`}
              title={`${t.section} ${t.name}  -  mastery ${(m * 100).toFixed(0)}%`}
              className="h-3.5 w-3.5 rounded-[3px] ring-1 ring-blue-800/10 transition-transform hover:scale-150 hover:ring-blue-800/40"
              style={{ background: heatColor(m) }}
            />
          );
        })}
      </div>
    </div>
  );
}

// Mastery heatmap: weak = light gray, strong = blue.
function heatColor(m: number): string {
  const t = Math.min(1, Math.max(0, m));
  const from = [229, 231, 235];
  const to = [37, 99, 235];
  const rgb = from.map((start, i) => Math.round(start + (to[i] - start) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function daysUntil(iso: string): number {
  const target = new Date(iso + "T00:00:00").getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}

function prettyType(t: string): string {
  switch (t) {
    case "mcq_full":
      return "MCQ exam";
    case "frq_full":
      return "FRQ exam";
    case "official_mcq":
      return "Official MCQ";
    case "official_frq":
      return "Official FRQ";
    default:
      return t;
  }
}
