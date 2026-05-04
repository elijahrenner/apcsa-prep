import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

import { listPracticeExams } from "@/lib/officialExam";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

export default function ExamsIndex() {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }
  const exams = listPracticeExams();
  return (
    <div className="space-y-10">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
          Timed practice
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Practice Exams
        </h1>
        <p className="mt-2 text-sm text-neutral-600 max-w-2xl">
          Full-length, timed practice tests. MCQ sections are auto-graded; FRQ sections are graded
          by Codex against the official AP rubric. Final scaled score (1–5) is computed using
          the Princeton Review cutoffs.
        </p>
        <Link
          href="/exams/history"
          className="mt-4 inline-flex rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-medium text-neutral-800 backdrop-blur hover:bg-white/85 transition-colors"
        >
          Analyze past exams
        </Link>
      </header>

      <section>
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 mb-3">
          Adaptive (sampled from your bank)
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <ExamCard
            href="/exam/mcq"
            section="Section I"
            title="Random MCQ exam"
            blurb="42 questions · 90 minutes · CED-weighted unit distribution"
          />
          <ExamCard
            href="/exam/frq"
            section="Section II"
            title="Random FRQ exam"
            blurb="4 questions · 90 minutes · graded by Codex against AP rubric"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 mb-3">
          Official practice exams
        </h2>
        {exams.length === 0 ? (
          <div className="glass rounded-2xl p-5 text-sm text-neutral-700">
            No official exams loaded yet. Re-run Stage 1 + Stage 8 of the pipeline.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {exams.map((e) => (
              <div key={e.id} className="glass rounded-2xl p-5 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    {e.source}
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-neutral-900">
                    {e.label}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
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
      </section>
    </div>
  );
}

function ExamCard({
  href,
  section,
  title,
  blurb,
}: {
  href: string;
  section: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="glass rounded-2xl p-5 block group transition-all hover:-translate-y-0.5 hover:bg-white/75"
    >
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {section}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-neutral-900">
        {title}
      </div>
      <p className="mt-2 text-sm text-neutral-600">{blurb}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-900">
        Begin
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
