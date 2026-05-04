/** Sample 42 MCQs matching CED unit weights for a full MCQ exam. */
import { db } from "./db";
import { parseMcqOptions } from "./mcqOptions";

const UNIT_WEIGHTS: Record<number, [number, number]> = {
  1: [15, 25],
  2: [25, 35],
  3: [10, 18],
  4: [30, 40],
};
const TOTAL = 42;

export function sampleMcqExam(): {
  id: string;
  topic_id: string;
  topic: { unit: number; section: string; name: string };
  stem: string;
  options: string[];
  difficulty: number;
  correct: "A" | "B" | "C" | "D";
  explanation: string;
}[] {
  // pick a target count per unit by sampling within [low, high] range that sums to 42
  const targets: Record<number, number> = {};
  let remaining = TOTAL;
  const units = [1, 2, 3, 4];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const [lo, hi] = UNIT_WEIGHTS[u];
    if (i === units.length - 1) {
      targets[u] = Math.max(0, remaining);
    } else {
      const loN = Math.round((lo / 100) * TOTAL);
      const hiN = Math.round((hi / 100) * TOTAL);
      const n = loN + Math.floor(Math.random() * (hiN - loN + 1));
      targets[u] = Math.min(n, remaining);
      remaining -= targets[u];
    }
  }

  const out: ReturnType<typeof sampleMcqExam> = [];
  for (const u of units) {
    const rows = db()
      .prepare(
        `SELECT q.id, q.topic_id, q.stem, q.options_json, q.difficulty,
                q.correct, q.explanation,
                t.unit, t.section, t.name AS topic_name
           FROM questions q JOIN topics t ON t.id = q.topic_id
          WHERE q.type = 'mcq' AND t.unit = ?
          ORDER BY RANDOM() LIMIT ?`
      )
      .all(u, targets[u]) as Array<{
      id: string;
      topic_id: string;
      stem: string;
      options_json: string;
      difficulty: number;
      correct: "A" | "B" | "C" | "D";
      explanation: string;
      unit: number;
      section: string;
      topic_name: string;
    }>;
    for (const r of rows) {
      out.push({
        id: r.id,
        topic_id: r.topic_id,
        topic: { unit: r.unit, section: r.section, name: r.topic_name },
        stem: r.stem,
        options: parseMcqOptions(r.options_json),
        difficulty: r.difficulty,
        correct: r.correct,
        explanation: r.explanation,
      });
    }
  }
  return out;
}
