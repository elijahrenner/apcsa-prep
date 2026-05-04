import { db } from "./db";
import { parseMcqOptions } from "./mcqOptions";
import type { FrqExamQuestion } from "@/components/FrqExamRunner";

export type PracticeExam = { id: number; source: string; label: string };

export function listPracticeExams(): PracticeExam[] {
  return db()
    .prepare(`SELECT id, source, label FROM practice_exams ORDER BY id`)
    .all() as PracticeExam[];
}

export function getPracticeExam(id: number): PracticeExam | null {
  return (
    (db()
      .prepare(`SELECT id, source, label FROM practice_exams WHERE id = ?`)
      .get(id) as PracticeExam | undefined) ?? null
  );
}

export type OfficialMcq = {
  id: string;
  topic_id: string;
  topic: { unit: number; section: string; name: string };
  stem: string;
  options: string[];
  difficulty: number;
  correct: "A" | "B" | "C" | "D";
  explanation: string;
};

export function getOfficialMcqSection(exam_id: number): OfficialMcq[] {
  const rows = db()
    .prepare(
      `SELECT q.id, q.topic_id, q.stem, q.options_json, q.difficulty,
              q.correct, q.explanation,
              t.unit, t.section, t.name AS topic_name
         FROM practice_exam_items pi
         JOIN questions q ON q.id = pi.question_id
         JOIN topics t ON t.id = q.topic_id
        WHERE pi.exam_id = ? AND pi.section = 'mcq'
        ORDER BY pi.seq`
    )
    .all(exam_id) as Array<{
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
  return rows.map((r) => ({
    id: r.id,
    topic_id: r.topic_id,
    topic: { unit: r.unit, section: r.section, name: r.topic_name },
    stem: r.stem,
    options: parseMcqOptions(r.options_json),
    difficulty: r.difficulty,
    correct: r.correct,
    explanation: r.explanation,
  }));
}

export function getOfficialFrqSection(exam_id: number): FrqExamQuestion[] {
  const rows = db()
    .prepare(
      `SELECT q.id, q.topic_id, q.stem, q.parts_json, q.archetype, q.total_points
         FROM practice_exam_items pi
         JOIN questions q ON q.id = pi.question_id
        WHERE pi.exam_id = ? AND pi.section = 'frq'
        ORDER BY pi.seq`
    )
    .all(exam_id) as Array<{
    id: string;
    topic_id: string;
    stem: string;
    parts_json: string | null;
    archetype: string | null;
    total_points: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    topic_id: r.topic_id,
    archetype: r.archetype ?? "methods_control",
    stem: r.stem,
    parts: r.parts_json ? extractPartPrompts(r.parts_json) : [],
    total_points: r.total_points,
  }));
}

function extractPartPrompts(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .map((p) => (typeof p === "string" ? p : p?.prompt ?? p?.text ?? ""))
        .filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return [];
}
