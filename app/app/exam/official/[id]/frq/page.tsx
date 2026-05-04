import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

import { FrqExamRunner } from "@/components/FrqExamRunner";
import { getOfficialFrqSection, getPracticeExam } from "@/lib/officialExam";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

export default async function OfficialFrqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }
  const { id } = await params;
  const examId = Number(id);
  const exam = getPracticeExam(examId);
  if (!exam)
    return (
      <div className="glass rounded-2xl p-6 text-neutral-800">
        Exam not found.
      </div>
    );
  const questions = getOfficialFrqSection(examId);
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Section II
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
            {exam.label}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            4 FRQ · 90 minutes · graded by Codex
          </p>
        </div>
        <Link
          href={`/exam/official/${examId}/mcq`}
          className="text-sm font-medium text-neutral-900 underline underline-offset-4 hover:no-underline"
        >
          ← Section I
        </Link>
      </header>
      {questions.length === 0 ? (
        <div className="glass rounded-2xl p-5 text-sm text-neutral-800">
          This exam has no FRQ items loaded.
        </div>
      ) : (
        <FrqExamRunner questions={questions} practiceExamId={examId} />
      )}
    </div>
  );
}
