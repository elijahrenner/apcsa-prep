import { NextResponse } from "next/server";
import { db, recordAttempt } from "@/lib/db";
import { updateSkill } from "@/lib/skill";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    question_id: string;
    answer: string;
    time_ms?: number;
  };

  const row = db()
    .prepare(
      `SELECT topic_id, correct, explanation, difficulty, options_json
         FROM questions WHERE id = ? AND type = 'mcq'`
    )
    .get(body.question_id) as {
    topic_id: string;
    correct: string;
    explanation: string;
    difficulty: number;
    options_json: string;
  } | undefined;
  if (!row) return NextResponse.json({ error: "unknown question" }, { status: 404 });

  const correct = body.answer === row.correct;
  recordAttempt({
    question_id: body.question_id,
    user_answer: body.answer,
    correct: correct ? 1 : 0,
    time_ms: body.time_ms,
  });
  updateSkill(row.topic_id, correct, row.difficulty ?? 3);

  return NextResponse.json({
    correct,
    correct_answer: row.correct,
    explanation: row.explanation,
  });
}
