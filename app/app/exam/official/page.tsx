import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

import { listPracticeExams } from "@/lib/officialExam";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

export default function OfficialExamsIndex() {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }
  const exams = listPracticeExams();
  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
          Official tests
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Official practice exams
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Full-length practice tests sourced from the Princeton Review 2025 prep book.
          Each test mirrors the new digital format: 42 MCQ / 90 min, then 4 FRQ / 90 min.
        </p>
      </header>
      {exams.length === 0 ? (
        <div className="glass rounded-2xl p-5 text-sm text-neutral-800">
          No practice exams loaded yet. Re-run Stage 1 + Stage 8.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {exams.map((e) => (
            <div key={e.id} className="glass rounded-2xl p-5 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">
                  {e.source}
                </div>
                <div className="text-lg font-semibold text-neutral-900">
                  {e.label}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/exam/official/${e.id}/mcq`}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 hover:-translate-y-0.5 transition-all"
                >
                  Section I (MCQ)
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href={`/exam/official/${e.id}/frq`}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-medium text-neutral-800 backdrop-blur hover:bg-white/85 transition-colors"
                >
                  Section II (FRQ)
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
