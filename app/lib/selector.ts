import { db, getSkill, getTopics } from "./db";
import { FRQ_ARCHETYPE_ORDER, FRQ_BLUEPRINT_BY_ID, type FrqArchetype } from "./frqBlueprint";
import { mastery } from "./scoring";

const HIGH_YIELD_TOPIC_IDS = new Set([
  // Strings: substring, indexOf, length, equals, and traversal.
  "u1_s1_15",
  "u2_s2_10",

  // Boolean logic and conditionals.
  "u2_s2_1",
  "u2_s2_2",
  "u2_s2_3",
  "u2_s2_4",
  "u2_s2_5",
  "u2_s2_6",

  // Loops and hand tracing.
  "u2_s2_7",
  "u2_s2_8",
  "u2_s2_9",
  "u2_s2_11",
  "u2_s2_12",

  // Classes: instance variables, constructors, methods, references, scope.
  "u1_s1_12",
  "u1_s1_13",
  "u1_s1_14",
  "u3_s3_3",
  "u3_s3_4",
  "u3_s3_5",
  "u3_s3_6",
  "u3_s3_8",
  "u3_s3_9",

  // Arrays, ArrayLists, 2D arrays.
  "u4_s4_2",
  "u4_s4_3",
  "u4_s4_4",
  "u4_s4_5",
  "u4_s4_8",
  "u4_s4_9",
  "u4_s4_10",
  "u4_s4_11",
  "u4_s4_12",
  "u4_s4_13",
  "u4_s4_14",
  "u4_s4_15",
]);

const LOW_YIELD_TOPIC_IDS = new Set([
  "u1_s1_1", // Why Programming?
  "u1_s1_7", // APIs and Libraries
  "u1_s1_8", // Comments
  "u1_s1_11", // Math Class
  "u3_s3_1", // Abstraction and Program Design
  "u3_s3_7", // Static Variables and Methods
  "u4_s4_6", // Reading Input Files
  "u4_s4_7", // Wrapper Classes
]);

const RECURSION_BASICS_TOPIC_IDS = new Set([
  "u4_s4_16",
]);

/** Pick a topic id, weighted by weakness. */
export function pickTopic(opts?: { restrictUnit?: number; restrictTopic?: string }): string {
  if (opts?.restrictTopic) return opts.restrictTopic;

  const topics = getTopics().filter(
    (t) => opts?.restrictUnit == null || t.unit === opts.restrictUnit
  );
  const skill = new Map(getSkill().map((s) => [s.topic_id, s]));
  const now = Math.floor(Date.now() / 1000);

  const weights = topics.map((t) => {
    const s = skill.get(t.id);
    const m = s ? mastery(s.elo, s.ema_accuracy, s.n_seen) : 0.0;
    const recencySec = s?.last_seen ? now - s.last_seen : 60 * 60 * 24 * 7;
    const recencyBoost = 1 + Math.min(2, recencySec / (60 * 60 * 6));
    return Math.pow(1 - m + 0.05, 2) * recencyBoost * yieldPriority(t.id);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < topics.length; i++) {
    r -= weights[i];
    if (r <= 0) return topics[i].id;
  }
  return topics[topics.length - 1].id;
}

function yieldPriority(topicId: string): number {
  if (HIGH_YIELD_TOPIC_IDS.has(topicId)) return 5;
  if (RECURSION_BASICS_TOPIC_IDS.has(topicId)) return 0.4;
  if (LOW_YIELD_TOPIC_IDS.has(topicId)) return 0.2;
  return 1;
}

/** Pick a random MCQ from a topic, preferring questions not seen recently. */
export function pickMcq(topic_id: string): { id: string } | null {
  const row = db()
    .prepare(
      `SELECT q.id
         FROM questions q
         LEFT JOIN (
           SELECT question_id, MAX(ts) AS last_ts
             FROM attempts
            GROUP BY question_id
         ) a ON a.question_id = q.id
        WHERE q.topic_id = ? AND q.type = 'mcq'
        ORDER BY COALESCE(a.last_ts, 0) ASC, RANDOM()
        LIMIT 1`
    )
    .get(topic_id) as { id: string } | undefined;
  return row ?? null;
}

/** Pick an FRQ slot, weighted by point value, weakness, and recency. */
export function pickFrqArchetype(opts?: { restrictArchetype?: FrqArchetype }): FrqArchetype {
  if (opts?.restrictArchetype) return opts.restrictArchetype;

  const now = Math.floor(Date.now() / 1000);
  const rows = db()
    .prepare(
      `SELECT q.archetype,
              COUNT(a.id) AS n_seen,
              AVG(CASE WHEN q.total_points > 0 AND a.points_earned IS NOT NULL
                       THEN a.points_earned * 1.0 / q.total_points
                  END) AS avg_pct,
              MAX(a.ts) AS last_seen
         FROM questions q
         LEFT JOIN attempts a ON a.question_id = q.id
        WHERE q.type = 'frq'
        GROUP BY q.archetype`
    )
    .all() as Array<{
    archetype: string;
    n_seen: number;
    avg_pct: number | null;
    last_seen: number | null;
  }>;
  const byArchetype = new Map(rows.map((r) => [r.archetype, r]));

  const weights = FRQ_ARCHETYPE_ORDER.map((archetype) => {
    const info = FRQ_BLUEPRINT_BY_ID.get(archetype)!;
    const row = byArchetype.get(archetype);
    const avg = typeof row?.avg_pct === "number" ? row.avg_pct : 0;
    const weakness = Math.pow(1 - avg + 0.12, 2);
    const recencySec = row?.last_seen ? now - row.last_seen : 60 * 60 * 24 * 10;
    const recencyBoost = 1 + Math.min(2, recencySec / (60 * 60 * 8));
    return info.drillWeight * weakness * recencyBoost;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < FRQ_ARCHETYPE_ORDER.length; i++) {
    r -= weights[i];
    if (r <= 0) return FRQ_ARCHETYPE_ORDER[i];
  }
  return FRQ_ARCHETYPE_ORDER[0];
}

/** Pick a single FRQ, preferring questions not seen recently. */
export function pickFrq(opts?: {
  restrictArchetype?: FrqArchetype;
  restrictTopic?: string;
  source?: "all" | "generated" | "princeton-2025";
}): { id: string; archetype: FrqArchetype } | null {
  const archetype = pickFrqArchetype({ restrictArchetype: opts?.restrictArchetype });
  const clauses = ["q.type = 'frq'", "q.archetype = @archetype"];
  const params: Record<string, string> = { archetype };
  if (opts?.restrictTopic) {
    clauses.push("q.topic_id = @topic_id");
    params.topic_id = opts.restrictTopic;
  }
  if (opts?.source && opts.source !== "all") {
    clauses.push("q.source = @source");
    params.source = opts.source;
  }

  const row = db()
    .prepare(
      `SELECT q.id
         FROM questions q
         LEFT JOIN (
           SELECT question_id, MAX(ts) AS last_ts
             FROM attempts
            GROUP BY question_id
         ) a ON a.question_id = q.id
        WHERE ${clauses.join(" AND ")}
        ORDER BY COALESCE(a.last_ts, 0) ASC, RANDOM()
        LIMIT 1`
    )
    .get(params) as { id: string } | undefined;
  return row ? { id: row.id, archetype } : null;
}
