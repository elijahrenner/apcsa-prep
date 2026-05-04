import { NextResponse } from "next/server";

import { db, recordAttempt, type FRQRow } from "@/lib/db";
import { updateSkill } from "@/lib/skill";
import { gradeFrq } from "@/lib/modelClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { question_id?: string; code?: string; time_ms?: number };
  try {
    body = (await req.json()) as { question_id?: string; code?: string; time_ms?: number };
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const question_id = body.question_id;
  const code = body.code ?? "";
  if (!question_id || typeof question_id !== "string") {
    return NextResponse.json({ error: "missing question_id" }, { status: 400 });
  }

  const row = db()
    .prepare(
      `SELECT id, topic_id, archetype, stem, parts_json, reference_solution,
              rubric_json, total_points
         FROM questions WHERE id = ? AND type = 'frq'`
    )
    .get(question_id) as FRQRow | undefined;
  if (!row) {
    return NextResponse.json({ error: "unknown frq" }, { status: 404 });
  }

  let rubric: unknown;
  try {
    rubric = JSON.parse(row.rubric_json);
  } catch {
    return NextResponse.json({ error: "rubric_json is malformed in db" }, { status: 500 });
  }

  const totalPoints = row.total_points || 9;

  let result;
  try {
    result = await gradeFrq({
      rubric,
      studentCode: code,
      referenceSolution: row.reference_solution || "",
      totalPoints,
      stem: row.stem,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "grader failed", detail: msg }, { status: 502 });
  }

  const max = result.max || totalPoints;
  const correct: 0 | 1 = result.total >= 0.6 * max ? 1 : 0;

  try {
    recordAttempt({
      question_id,
      user_answer: code,
      correct,
      points_earned: result.total,
      time_ms: typeof body.time_ms === "number" ? body.time_ms : undefined,
    });
    updateSkill(row.topic_id, correct === 1, 4);
  } catch (err) {
    // Don't kill the grade response if persistence hiccups; surface the data.
    console.error("attempt persistence failed", err);
  }

  return NextResponse.json({
    per_criterion: result.per_criterion,
    total: result.total,
    max,
    feedback: result.feedback,
  });
}
