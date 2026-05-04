import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

import { DeleteExamButton } from "@/components/DeleteExamButton";
import { db } from "@/lib/db";
import { parseMcqOptions } from "@/lib/mcqOptions";
import { renderInlineCode } from "@/lib/renderMarkdownHtml";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

type ExamSummary = {
  id: number;
  type: string;
  started_at: number;
  raw_score: number | null;
  scaled_score: number | null;
  total: number;
  answered: number;
  recalculated: number;
};

type ExamItem = {
  exam_id: number;
  seq: number;
  question_id: string;
  user_answer: string | null;
  key: string;
  stem: string;
  options_json: string;
  explanation: string | null;
};

export default async function ExamHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}) {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }

  const exams = db()
    .prepare(
      `SELECT e.id, e.type, e.started_at, e.raw_score, e.scaled_score,
              COUNT(ei.seq) AS total,
              SUM(CASE WHEN ei.user_answer IS NOT NULL THEN 1 ELSE 0 END) AS answered,
              SUM(CASE WHEN ei.user_answer = q.correct THEN 1 ELSE 0 END) AS recalculated
         FROM exams e
         JOIN exam_items ei ON ei.exam_id = e.id
         JOIN questions q ON q.id = ei.question_id
        WHERE q.type = 'mcq'
        GROUP BY e.id
        ORDER BY e.started_at DESC`
    )
    .all() as ExamSummary[];

  const items = db()
    .prepare(
      `SELECT ei.exam_id, ei.seq, ei.question_id, ei.user_answer,
              q.correct AS key, q.stem, q.options_json, q.explanation
         FROM exam_items ei
         JOIN questions q ON q.id = ei.question_id
        WHERE q.type = 'mcq'
        ORDER BY ei.exam_id DESC, ei.seq`
    )
    .all() as ExamItem[];

  const byExam = new Map<number, ExamItem[]>();
  for (const item of items) {
    if (!byExam.has(item.exam_id)) byExam.set(item.exam_id, []);
    byExam.get(item.exam_id)!.push(item);
  }

  const { exam: selectedExam } = await searchParams;
  const selectedExamId = selectedExam ? Number(selectedExam) : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Recalculated MCQ records
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
            Past Exam Analysis
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Scores here are recalculated from saved answers and the current answer key each time
            this page loads.
          </p>
        </div>
        <Link
          href="/exams"
          className="text-sm font-medium text-neutral-900 underline underline-offset-4 hover:no-underline"
        >
          Practice exams
        </Link>
      </header>

      {exams.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-neutral-600">
          No completed MCQ exams yet.
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <ExamReview
              key={exam.id}
              exam={exam}
              items={byExam.get(exam.id) ?? []}
              open={selectedExamId === exam.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamReview({
  exam,
  items,
  open,
}: {
  exam: ExamSummary;
  items: ExamItem[];
  open: boolean;
}) {
  const pct = exam.total > 0 ? exam.recalculated / exam.total : 0;
  const scaled = scaledMcq(pct);
  const storedDiffers =
    exam.raw_score !== null && Number(exam.raw_score) !== Number(exam.recalculated);
  const missed = items.filter((item) => item.user_answer !== item.key);

  return (
    <details className="glass rounded-2xl p-5" open={open}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-neutral-500">
            {new Date(exam.started_at * 1000).toLocaleString()}
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-neutral-900">
            Exam #{exam.id} · {prettyType(exam.type)}
          </div>
        </div>
        <ScorePill label="MCQ" value={`${exam.recalculated}/${exam.total}`} />
        <ScorePill label="Percent" value={`${(pct * 100).toFixed(1)}%`} />
        <ScorePill label="Scaled" value={`${scaled}`} />
        <DeleteExamButton examId={exam.id} />
      </summary>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/70 bg-white/45 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Answered
          </div>
          <div className="mt-1 font-mono text-xl text-neutral-900">
            {exam.answered}/{exam.total}
          </div>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/45 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Missed
          </div>
          <div className="mt-1 font-mono text-xl text-neutral-900">
            {missed.length}
          </div>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/45 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Stored raw
          </div>
          <div className="mt-1 font-mono text-xl text-neutral-900">
            {exam.raw_score ?? " - "}
            {storedDiffers && (
              <span className="ml-2 text-xs text-blue-800">recalculated</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {items.map((item) => {
          const right = item.user_answer === item.key;
          return (
            <details
              key={`${item.exam_id}-${item.seq}`}
              className="rounded-xl border border-white/70 bg-white/45 p-3"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    right
                      ? "bg-blue-800 text-white"
                      : "border border-blue-800 bg-white text-blue-800"
                  }`}
                >
                  {right ? "✓" : "✕"}
                </span>
                <span className="font-mono text-neutral-500">
                  #{item.seq + 1}
                </span>
                <span className="ml-auto font-mono text-xs text-neutral-600">
                  you={item.user_answer ?? " - "} · key={item.key}
                </span>
              </summary>
              <div
                className="mt-3 font-mono text-sm text-neutral-900"
                dangerouslySetInnerHTML={{ __html: renderInlineCode(item.stem) }}
              />
              <AnswerBlock item={item} />
              {item.explanation && (
                <div
                  className="mt-3 text-sm leading-relaxed text-neutral-700"
                  dangerouslySetInnerHTML={{
                    __html: renderInlineCode(item.explanation),
                  }}
                />
              )}
            </details>
          );
        })}
      </div>
    </details>
  );
}

function AnswerBlock({ item }: { item: ExamItem }) {
  const options = parseMcqOptions(item.options_json);
  const userOption = optionFor(options, item.user_answer);
  const keyOption = optionFor(options, item.key);
  return (
    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
      <div className="rounded-lg border border-white/70 bg-white/50 p-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Your choice {item.user_answer ?? "blank"}
        </div>
        <div
          className="font-mono text-neutral-900"
          dangerouslySetInnerHTML={{ __html: renderInlineCode(userOption) }}
        />
      </div>
      <div className="rounded-lg border border-blue-800/20 bg-white/65 p-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-800">
          Key {item.key}
        </div>
        <div
          className="font-mono text-neutral-900"
          dangerouslySetInnerHTML={{ __html: renderInlineCode(keyOption) }}
        />
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-right">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="font-mono text-lg text-neutral-900">{value}</div>
    </div>
  );
}

function optionFor(options: string[], letter: string | null): string {
  if (!letter) return "";
  const index = ["A", "B", "C", "D"].indexOf(letter);
  return index >= 0 ? options[index] ?? "" : "";
}

function scaledMcq(pct: number): number {
  if (pct >= 0.7) return 5;
  if (pct >= 0.6) return 4;
  if (pct >= 0.5) return 3;
  if (pct >= 0.4) return 2;
  return 1;
}

function prettyType(t: string): string {
  switch (t) {
    case "mcq_full":
      return "MCQ exam";
    case "frq_full":
      return "FRQ exam";
    case "official":
      return "Official";
    default:
      return t;
  }
}
