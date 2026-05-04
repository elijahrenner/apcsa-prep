import { existsSync } from "node:fs";
import path from "node:path";

import { ExamMcqRunner } from "@/components/ExamMcqRunner";
import { sampleMcqExam } from "@/lib/examSampler";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

export default function McqExamPage() {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }
  const questions = sampleMcqExam();
  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
          Section I
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Full MCQ exam
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          42 questions · 90 minutes · 4 options each. Distribution matches CED unit weighting.
        </p>
      </header>
      {questions.length < 10 ? (
        <div className="glass rounded-2xl p-5 text-sm text-neutral-800">
          Question bank too small ({questions.length} sampled). Re-run the pipeline.
        </div>
      ) : (
        <ExamMcqRunner questions={questions} />
      )}
    </div>
  );
}
