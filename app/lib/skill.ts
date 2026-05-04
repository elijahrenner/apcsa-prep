import { db } from "./db";

const ELO_K = 24;
const EMA_ALPHA = 0.3;
// difficulty 1..5 → expected opponent rating
const DIFF_TO_RATING: Record<number, number> = {
  1: 1000,
  2: 1100,
  3: 1200,
  4: 1300,
  5: 1400,
};

export function ensureSkillRow(topic_id: string) {
  db()
    .prepare(
      `INSERT OR IGNORE INTO skill (topic_id) VALUES (?)`
    )
    .run(topic_id);
}

export function updateSkill(topic_id: string, correct: boolean, difficulty: number) {
  ensureSkillRow(topic_id);
  const row = db()
    .prepare(
      `SELECT elo, n_seen, n_correct, ema_accuracy FROM skill WHERE topic_id = ?`
    )
    .get(topic_id) as { elo: number; n_seen: number; n_correct: number; ema_accuracy: number };

  const opponent = DIFF_TO_RATING[difficulty] ?? 1200;
  const expected = 1 / (1 + 10 ** ((opponent - row.elo) / 400));
  const score = correct ? 1 : 0;
  const newElo = row.elo + ELO_K * (score - expected);
  const newEma = EMA_ALPHA * score + (1 - EMA_ALPHA) * row.ema_accuracy;

  db()
    .prepare(
      `UPDATE skill SET elo = ?, n_seen = n_seen + 1, n_correct = n_correct + ?,
                        ema_accuracy = ?, last_seen = unixepoch() WHERE topic_id = ?`
    )
    .run(newElo, correct ? 1 : 0, newEma, topic_id);
}

export function rebuildSkillFromAttempts() {
  const d = db();
  const rows = d
    .prepare(
      `SELECT q.topic_id, q.difficulty, a.correct
         FROM attempts a
         JOIN questions q ON q.id = a.question_id
        WHERE q.type = 'mcq'
        ORDER BY a.ts, a.id`
    )
    .all() as Array<{ topic_id: string; difficulty: number | null; correct: 0 | 1 }>;

  const tx = d.transaction(() => {
    d.prepare(
      `UPDATE skill
          SET elo = 1200,
              n_seen = 0,
              n_correct = 0,
              ema_accuracy = 0.5,
              last_seen = NULL`
    ).run();

    for (const row of rows) {
      updateSkill(row.topic_id, row.correct === 1, row.difficulty ?? 3);
    }
  });
  tx();
}

/** 0..1 mastery score. Untouched topics start weak until there is real evidence. */
export function mastery(elo: number, ema_accuracy: number, nSeen = 0): number {
  if (nSeen <= 0) return 0;
  const normElo = Math.min(1, Math.max(0, (elo - 800) / 800));
  const evidence = Math.min(1, nSeen / 8);
  return (0.6 * normElo + 0.4 * ema_accuracy) * evidence;
}

/** Princeton Review-style AP CSA scaled-score band (1–5) from a percentage. */
export function pctToFiveBand(pct: number): number {
  if (pct >= 0.72) return 5;
  if (pct >= 0.58) return 4;
  if (pct >= 0.42) return 3;
  if (pct >= 0.28) return 2;
  return 1;
}
