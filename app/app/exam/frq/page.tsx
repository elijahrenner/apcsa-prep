import { existsSync } from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";
import { FrqExamRunner, type FrqExamQuestion } from "@/components/FrqExamRunner";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");
const ARCHETYPES = ["methods_control", "class_writing", "arraylist", "array_2d"] as const;

type FrqRow = {
  id: string;
  topic_id: string;
  archetype: string;
  stem: string;
  parts_json: string | null;
  total_points: number;
};

function pickFrqs(): { picked: FrqExamQuestion[]; missing: string[] } {
  const picked: FrqExamQuestion[] = [];
  const missing: string[] = [];
  const stmt = db().prepare(
    `SELECT id, topic_id, archetype, stem, parts_json, total_points
       FROM questions
      WHERE type = 'frq' AND archetype = ?
      ORDER BY RANDOM()
      LIMIT 1`
  );
  for (const a of ARCHETYPES) {
    const row = stmt.get(a) as FrqRow | undefined;
    if (!row) {
      missing.push(a);
      continue;
    }
    let parts: string[] = [];
    if (row.parts_json) {
      try {
        const parsed = JSON.parse(row.parts_json);
        if (Array.isArray(parsed)) {
          parts = parsed.map((p) => (typeof p === "string" ? p : (p?.prompt ?? p?.text ?? JSON.stringify(p))));
        }
      } catch {
        /* leave parts empty */
      }
    }
    picked.push({
      id: row.id,
      topic_id: row.topic_id,
      archetype: row.archetype,
      stem: row.stem,
      parts,
      total_points: row.total_points ?? 9,
    });
  }
  return { picked, missing };
}

export default function FrqExamPage() {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        <h1 className="text-lg font-semibold text-neutral-900">No question bank yet</h1>
        <p className="mt-2 text-sm text-neutral-700">
          Run <code>make seed</code>{" "}
          in <code>../pipeline</code>{" "}
          to build the SQLite database (Stages 1–8). Then refresh this page.
        </p>
      </div>
    );
  }

  const { picked, missing } = pickFrqs();

  if (picked.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <h1 className="text-lg font-semibold text-neutral-900">No FRQs in the bank yet</h1>
        <p className="mt-2 text-sm text-neutral-700">
          The pipeline hasn&apos;t produced any FRQs yet. Run Stages 6–8 of{" "}
          <code>make seed</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="glass-subtle rounded-xl p-3 text-sm text-neutral-800">
          Missing archetype{missing.length > 1 ? "s" : ""}:{" "}
          <span className="font-mono">{missing.join(", ")}</span>. Running with{" "}
          {picked.length} of 4 FRQs. Re-run the pipeline to fill in the gap
          {missing.length > 1 ? "s" : ""}.
        </div>
      )}
      <FrqExamRunner questions={picked} />
    </div>
  );
}
