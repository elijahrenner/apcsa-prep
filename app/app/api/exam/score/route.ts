import { NextResponse } from "next/server";
import { db, recordAttempt } from "@/lib/db";
import { updateSkill } from "@/lib/skill";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    type: "mcq_full" | "frq_full" | "official";
    picks: Record<string, string>;
    question_ids: string[];
  };

  const start = Math.floor(Date.now() / 1000);
  const examId = Number(
    db()
      .prepare(
        `INSERT INTO exams (type, started_at, completed_at) VALUES (?, ?, ?)`
      )
      .run(body.type, start, start).lastInsertRowid
  );

  let correctCount = 0;
  const total = body.question_ids.length;
  for (let i = 0; i < total; i++) {
    const qid = body.question_ids[i];
    const ans = body.picks[qid] ?? null;
    const row = db()
      .prepare(
        `SELECT topic_id, correct, difficulty FROM questions WHERE id = ?`
      )
      .get(qid) as
      | { topic_id: string; correct: string; difficulty: number }
      | undefined;
    if (!row) continue;
    const ok = ans !== null && ans === row.correct ? 1 : 0;
    if (ok) correctCount++;
    db()
      .prepare(
        `INSERT INTO exam_items (exam_id, seq, question_id, user_answer, correct)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(examId, i, qid, ans, ok);
    if (ans !== null) {
      recordAttempt({
        question_id: qid,
        user_answer: ans,
        correct: ok as 0 | 1,
        exam_id: examId,
        exam_seq: i,
      });
      updateSkill(row.topic_id, ok === 1, row.difficulty ?? 3);
    }
  }

  const pct = correctCount / total;
  const scaled = pct >= 0.7 ? 5 : pct >= 0.6 ? 4 : pct >= 0.5 ? 3 : pct >= 0.4 ? 2 : 1;

  db()
    .prepare(
      `UPDATE exams SET raw_score = ?, scaled_score = ? WHERE id = ?`
    )
    .run(correctCount, scaled, examId);

  return NextResponse.json({
    exam_id: examId,
    correct: correctCount,
    total,
    pct,
    scaled,
  });
}
