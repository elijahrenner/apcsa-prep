import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

import { db, getSkill, getTopics } from "@/lib/db";
import { mastery } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

export default function StatsPage() {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }
  const topics = getTopics();
  const skills = new Map(getSkill().map((s) => [s.topic_id, s]));
  const totals = db()
    .prepare(`SELECT COUNT(*) AS n, SUM(correct) AS k FROM attempts`)
    .get() as { n: number; k: number };
  const exams = db()
    .prepare(
      `SELECT id, type, started_at, raw_score, scaled_score
         FROM exams WHERE completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 10`
    )
    .all() as Array<{
    id: number;
    type: string;
    started_at: number;
    raw_score: number | null;
    scaled_score: number | null;
  }>;

  const sorted = [...topics].sort((a, b) => {
    const sa = skills.get(a.id);
    const sb = skills.get(b.id);
    const ma = sa ? mastery(sa.elo, sa.ema_accuracy, sa.n_seen) : 0;
    const mb = sb ? mastery(sb.elo, sb.ema_accuracy, sb.n_seen) : 0;
    return ma - mb;
  });

  return (
    <div className="space-y-10">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
          Analytics
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Stats
        </h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total questions answered" value={`${totals.n ?? 0}`} />
        <Stat
          label="Accuracy"
          value={
            totals.n > 0
              ? `${(((totals.k ?? 0) / totals.n) * 100).toFixed(1)}%`
              : " - "
          }
        />
        <Stat
          label="Topics seen"
          value={`${[...skills.values()].filter((s) => s.n_seen > 0).length}/${topics.length}`}
        />
      </section>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Weakest 10 topics
          </h2>
        </div>
        <div className="divide-y divide-white/60">
          {sorted.slice(0, 10).map((t) => {
            const s = skills.get(t.id);
            const m = s ? mastery(s.elo, s.ema_accuracy, s.n_seen) : 0;
            return (
              <div
                key={t.id}
                className="grid grid-cols-[5rem_1fr_5rem_5rem_4.5rem] items-center gap-3 px-5 py-2.5 text-sm hover:bg-white/40 transition-colors"
              >
                <span className="font-mono text-xs text-neutral-500">
                  {t.section}
                </span>
                <span className="text-neutral-900">{t.name}</span>
                <span className="font-mono text-xs text-neutral-600">
                  elo {Math.round(s?.elo ?? 0)}
                </span>
                <span className="font-mono text-xs text-neutral-600">
                  seen {s?.n_seen ?? 0}
                </span>
                <span className="font-mono text-xs font-medium text-neutral-900">
                  {(m * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Recent exams
          </h2>
        </div>
        {exams.length === 0 ? (
          <div className="px-5 py-6 text-sm text-neutral-500">None yet.</div>
        ) : (
          <div className="divide-y divide-white/60">
            {exams.map((e) => (
              <Link
                key={e.id}
                href={`/exams/history?exam=${e.id}`}
                className="grid grid-cols-4 gap-3 px-5 py-2.5 text-sm hover:bg-white/40 transition-colors"
              >
                <span className="font-mono text-xs text-neutral-500">
                  {new Date(e.started_at * 1000).toLocaleString()}
                </span>
                <span className="text-neutral-900">{e.type}</span>
                <span className="font-mono text-neutral-700">
                  {e.raw_score ?? " - "}
                </span>
                <span className="font-mono text-neutral-700">
                  scaled {e.scaled_score ?? " - "}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
        {value}
      </div>
    </div>
  );
}
