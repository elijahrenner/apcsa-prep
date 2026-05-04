import Database from "better-sqlite3";
import path from "node:path";

import { pctToFiveBand } from "./scoring";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

/**
 * Idempotent runtime migration. The pipeline is the source of truth for the
 * schema, but local DBs built before a column was added need to catch up.
 * SQLite's ADD COLUMN has no IF NOT EXISTS, so each ALTER is wrapped.
 */
function migrate(d: Database.Database) {
  const alters = [
    `ALTER TABLE exam_items ADD COLUMN criteria_json TEXT`,
    `ALTER TABLE exam_items ADD COLUMN feedback TEXT`,
    `ALTER TABLE attempts ADD COLUMN exam_id INTEGER`,
    `ALTER TABLE attempts ADD COLUMN exam_seq INTEGER`,
  ];
  for (const sql of alters) {
    try {
      d.exec(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) throw err;
    }
  }
}

export type Topic = {
  id: string;
  unit: number;
  section: string;
  name: string;
};

export type MCQRow = {
  id: string;
  topic_id: string;
  stem: string;
  options_json: string;
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: number;
};

export type FRQRow = {
  id: string;
  topic_id: string;
  archetype: string;
  stem: string;
  parts_json: string | null;
  reference_solution: string;
  rubric_json: string;
  total_points: number;
};

export type SkillRow = {
  topic_id: string;
  elo: number;
  n_seen: number;
  n_correct: number;
  ema_accuracy: number;
  last_seen: number | null;
};

export function getTopics(): Topic[] {
  return db()
    .prepare("SELECT id, unit, section, name FROM topics ORDER BY unit, section")
    .all() as Topic[];
}

export function getSkill(): SkillRow[] {
  return db()
    .prepare("SELECT * FROM skill ORDER BY topic_id")
    .all() as SkillRow[];
}

export function recordAttempt(args: {
  question_id: string;
  user_answer: string;
  correct: 0 | 1;
  points_earned?: number;
  time_ms?: number;
  exam_id?: number | null;
  exam_seq?: number | null;
}) {
  db()
    .prepare(
      `INSERT INTO attempts
         (question_id, user_answer, correct, points_earned, time_ms, exam_id, exam_seq)
       VALUES
         (@question_id, @user_answer, @correct, @points_earned, @time_ms, @exam_id, @exam_seq)`
    )
    .run({
      points_earned: null,
      time_ms: null,
      exam_id: null,
      exam_seq: null,
      ...args,
    });
}

export type FrqExamItemPersist = {
  question_id: string;
  code: string;
  total: number;
  max: number;
  per_criterion: unknown;
  feedback: string;
};

/** Persist a completed FRQ exam in one transaction. Returns the exam_id. */
export function recordFrqExam(args: {
  type: "frq_full" | "official";
  practice_exam_id?: number | null;
  items: FrqExamItemPersist[];
}): { exam_id: number; raw_score: number; max: number; scaled: number } {
  const d = db();
  const start = Math.floor(Date.now() / 1000);
  const raw = args.items.reduce((a, it) => a + (it.total ?? 0), 0);
  const max = args.items.reduce((a, it) => a + (it.max ?? 0), 0);
  const pct = max > 0 ? raw / max : 0;
  const scaled = pctToFiveBand(pct);

  const insertExam = d.prepare(
    `INSERT INTO exams (type, practice_exam_id, started_at, completed_at, raw_score, scaled_score)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertItem = d.prepare(
    `INSERT INTO exam_items
       (exam_id, seq, question_id, user_answer, correct, points_earned, criteria_json, feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = d.transaction(() => {
    const examId = Number(
      insertExam.run(
        args.type,
        args.practice_exam_id ?? null,
        start,
        start,
        raw,
        scaled
      ).lastInsertRowid
    );
    args.items.forEach((it, i) => {
      const ok = it.max > 0 && it.total / it.max >= 0.6 ? 1 : 0;
      insertItem.run(
        examId,
        i,
        it.question_id,
        it.code,
        ok,
        it.total,
        JSON.stringify(it.per_criterion ?? []),
        it.feedback ?? ""
      );
    });
    return examId;
  });

  const exam_id = tx();
  return { exam_id, raw_score: raw, max, scaled };
}
