"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { renderInlineCode } from "@/lib/renderMarkdownHtml";

type Question = {
  id: string;
  topic_id: string;
  topic: { unit: number; section: string; name: string };
  stem: string;
  options: string[];
  difficulty: number;
  correct: "A" | "B" | "C" | "D";
  explanation: string;
};

const LETTERS = ["A", "B", "C", "D"] as const;

function fmtTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function ExamMcqRunner({
  questions,
  durationSeconds = 90 * 60,
}: {
  questions: Question[];
  durationSeconds?: number;
}) {
  const [examQuestions, setExamQuestions] = useState<Question[]>(questions);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [idx, setIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [secsLeft, setSecsLeft] = useState(durationSeconds);
  const [paused, setPaused] = useState(false);
  const [restored, setRestored] = useState(false);
  const submitRef = useRef<() => void>(() => {});
  const picksRef = useRef<Record<string, string>>({});

  function updatePicks(next: Record<string, string>) {
    picksRef.current = next;
    setPicks(next);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("apcsa.mcqExam.v2");
    window.localStorage.removeItem("apcsa.mcqExam.v3");
    const saved = readMcqProgress();
    if (saved && saved.path === window.location.pathname && saved.questions.length > 0) {
      const currentById = new Map(questions.map((question) => [question.id, question]));
      const adjustedPicks = { ...saved.picks };
      const adjustedMarked = { ...(saved.marked ?? {}) };
      const refreshedQuestions = saved.questions.map(
        (question) => {
          const current = currentById.get(question.id);
          if (!current) return question;
          const answerContractChanged =
            current.correct !== question.correct ||
            JSON.stringify(current.options) !== JSON.stringify(question.options);
          if (answerContractChanged && adjustedPicks[question.id]) {
            delete adjustedPicks[question.id];
            adjustedMarked[question.id] = true;
          }
          return current;
        }
      );
      setExamQuestions(refreshedQuestions);
      updatePicks(adjustedPicks);
      setMarked(adjustedMarked);
      setIdx(Math.min(saved.idx, refreshedQuestions.length - 1));
      const savedDuration =
        typeof saved.durationSeconds === "number" ? saved.durationSeconds : durationSeconds;
      setSecsLeft(Math.max(0, Math.min(saved.secsLeft, savedDuration)));
      setPaused(saved.paused);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (!restored || submitted) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      MCQ_STORAGE_KEY,
      JSON.stringify({
        path: window.location.pathname,
        questions: examQuestions,
        picks,
        marked,
        idx,
        secsLeft,
        paused,
        durationSeconds,
      } satisfies SavedMcqProgress)
    );
  }, [durationSeconds, examQuestions, idx, marked, paused, picks, restored, secsLeft, submitted]);

  useEffect(() => {
    if (submitted || paused) return;
    const t = setInterval(() => {
      setSecsLeft((remaining) => {
        if (remaining <= 1) {
          window.setTimeout(() => submitRef.current(), 0);
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paused, submitted]);

  const score = useMemo(() => {
    if (!submitted) return null;
    const scoringPicks = picksRef.current;
    let n = 0;
    for (const q of examQuestions) if (scoringPicks[q.id] === q.correct) n++;
    return n;
  }, [submitted, examQuestions]);

  function submit() {
    if (submitted) return;
    const finalPicks = picksRef.current;
    setPicks(finalPicks);
    setSubmitted(true);
    if (typeof window !== "undefined") window.localStorage.removeItem(MCQ_STORAGE_KEY);
    fetch("/api/exam/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "mcq_full",
        picks: finalPicks,
        question_ids: examQuestions.map((q) => q.id),
      }),
    }).catch(() => {});
  }

  const q = examQuestions[idx];
  if (!q) return null;
  const answered = Object.keys(picks).length;
  const markedCount = Object.values(marked).filter(Boolean).length;
  const isMarked = Boolean(marked[q.id]);
  const timerUrgent = secsLeft <= 120;
  const timerWarn = secsLeft <= 600 && secsLeft > 120;

  if (submitted && score !== null) {
    const submittedPicks = picksRef.current;
    const pct = score / examQuestions.length;
    const scaled = pct >= 0.7 ? 5 : pct >= 0.6 ? 4 : pct >= 0.5 ? 3 : pct >= 0.4 ? 2 : 1;
    const byUnit = new Map<number, { right: number; total: number }>();
    for (const qq of examQuestions) {
      const u = qq.topic.unit;
      if (!byUnit.has(u)) byUnit.set(u, { right: 0, total: 0 });
      const r = byUnit.get(u)!;
      r.total++;
      if (submittedPicks[qq.id] === qq.correct) r.right++;
    }
    return (
      <div className="space-y-8">
        <div className="glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Result
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="text-5xl font-semibold tracking-tight text-neutral-900">
                {score}
                <span className="text-2xl text-neutral-400">/{examQuestions.length}</span>
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                {(pct * 100).toFixed(0)}% correct
              </div>
            </div>
            <div className="border-l border-neutral-300/60 pl-10">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                MCQ-only scaled est.
              </div>
              <div className="text-4xl font-semibold tracking-tight text-neutral-900 mt-1">
                {scaled}
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((u) => {
              const r = byUnit.get(u);
              const p = r ? (r.right / r.total) * 100 : 0;
              return (
                <div
                  key={u}
                  className="rounded-xl border border-white/80 bg-white/55 p-3 backdrop-blur"
                >
                  <div className="text-xs text-neutral-500">Unit {u}</div>
                  <div className="mt-1 font-mono text-xl text-neutral-900">
                    {r ? `${r.right}/${r.total}` : " - "}
                  </div>
                  <div className="text-xs text-neutral-500">{p.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Review
          </div>
          {examQuestions.map((qq, i) => {
            const my = submittedPicks[qq.id];
            const right = my === qq.correct;
            return (
              <details
                key={qq.id}
                className="glass rounded-xl p-4 group"
              >
                <summary className="cursor-pointer text-sm flex items-center gap-3 list-none">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      right
                        ? "bg-blue-800 text-white"
                        : "border border-blue-800 bg-white text-blue-800"
                    }`}
                    aria-hidden
                  >
                    {right ? "✓" : "✕"}
                  </span>
                  <span className="font-mono text-neutral-500">#{i + 1}</span>
                  <span className="text-neutral-800">
                    {qq.topic.section} {qq.topic.name}
                  </span>
                  <span className="ml-auto font-mono text-xs text-neutral-600">
                    you={my ?? " - "} · key={qq.correct}
                  </span>
                </summary>
                <div className="mt-3 whitespace-pre-wrap font-mono text-sm text-neutral-900">
                  <div dangerouslySetInnerHTML={{ __html: renderInlineCode(qq.stem) }} />
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  {my && (
                    <div className="rounded-lg border border-white/70 bg-white/45 p-3">
                      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Your choice {my}
                      </div>
                      <div
                        className="font-mono text-neutral-900"
                        dangerouslySetInnerHTML={{
                          __html: renderInlineCode(optionText(qq, my)),
                        }}
                      />
                    </div>
                  )}
                  <div className="rounded-lg border border-blue-800/20 bg-white/60 p-3">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-800">
                      Key {qq.correct}
                    </div>
                    <div
                      className="font-mono text-neutral-900"
                      dangerouslySetInnerHTML={{
                        __html: renderInlineCode(optionText(qq, qq.correct)),
                      }}
                    />
                  </div>
                </div>
                <div
                  className="mt-3 text-sm text-neutral-700"
                  dangerouslySetInnerHTML={{ __html: renderInlineCode(qq.explanation) }}
                />
              </details>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-strong rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
        <div className="text-sm text-neutral-600">
          Question{" "}
          <span className="font-semibold text-neutral-900">{idx + 1}</span>
          <span className="text-neutral-400"> / {examQuestions.length}</span>
          <span className="ml-4 text-neutral-500">
            answered {answered}/{examQuestions.length}
          </span>
          {markedCount > 0 && (
            <span className="ml-4 text-blue-800">
              review {markedCount}
            </span>
          )}
        </div>
        <div
          className={`font-mono text-2xl tabular-nums tracking-tight ${
            timerUrgent
              ? "text-neutral-900 animate-pulse"
              : timerWarn
              ? "text-neutral-700"
              : "text-neutral-900"
          }`}
        >
          {fmtTime(secsLeft)}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused((value) => !value)}
            className="rounded-xl border border-white/80 bg-white/65 px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:border-blue-800 hover:text-blue-800"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={submit}
            className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 transition-colors"
          >
            Submit exam
          </button>
        </div>
      </div>

      {paused ? (
        <PausePanel onResume={() => setPaused(false)} />
      ) : (
        <>
          <div className="glass rounded-2xl p-6 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-500">
                Unit {q.topic.unit} · {q.topic.section} {q.topic.name}
              </div>
              <button
                onClick={() =>
                  setMarked((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                }
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isMarked
                    ? "border-blue-800 bg-blue-800 text-white"
                    : "border-blue-800/30 bg-white/55 text-blue-800 hover:border-blue-800"
                }`}
              >
                {isMarked ? "Marked for review" : "Mark review"}
              </button>
            </div>
            <div
              className="whitespace-pre-wrap font-mono text-[15px] leading-relaxed text-neutral-900"
              dangerouslySetInnerHTML={{ __html: renderInlineCode(q.stem) }}
            />
          </div>

          <div className="grid gap-2.5">
            {LETTERS.map((letter, i) => {
              const isPicked = picks[q.id] === letter;
              return (
                <button
                  key={letter}
                  onClick={() => updatePicks({ ...picksRef.current, [q.id]: letter })}
                  className={`group flex items-start gap-3 text-left rounded-xl border px-4 py-3.5 font-mono text-sm transition-all backdrop-blur ${
                    isPicked
                      ? "border-blue-800 bg-white/90 ring-2 ring-blue-800/30 text-neutral-900"
                      : "border-white/80 bg-white/55 text-neutral-900 hover:bg-white/80 hover:border-blue-800/25 hover:-translate-y-0.5"
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                      isPicked
                        ? "bg-blue-800 text-white"
                        : "bg-blue-800 text-white group-hover:bg-blue-800"
                    }`}
                  >
                    {letter}
                  </span>
                  <span
                    className="min-w-0 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderInlineCode(q.options[i]) }}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm text-neutral-800 backdrop-blur hover:bg-white/85 transition-colors disabled:opacity-40 disabled:hover:bg-white/60"
            >
              ← Prev
            </button>
            <div className="flex flex-wrap gap-1 max-w-3xl flex-1 justify-center">
              {examQuestions.map((qq, i) => {
                const isCurrent = i === idx;
                const isAnswered = !!picks[qq.id];
                const isReview = !!marked[qq.id];
                return (
                  <button
                    key={qq.id}
                    onClick={() => setIdx(i)}
                    className={`relative h-7 w-7 rounded-md text-xs font-mono transition-colors ${
                      isCurrent
                        ? "bg-blue-800 text-white shadow-md"
                        : isAnswered
                        ? "bg-white/85 text-neutral-900 ring-1 ring-blue-800/30"
                        : "bg-white/40 text-neutral-500 ring-1 ring-white/70 hover:bg-white/65"
                    } ${isReview && !isCurrent ? "ring-2 ring-blue-800" : ""}`}
                    title={`Q${i + 1}${isAnswered ? ` · ${picks[qq.id]}` : ""}${
                      isReview ? " · marked for review" : ""
                    }`}
                  >
                    <span>{i + 1}</span>
                    {isReview && (
                      <span
                        className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
                          isCurrent ? "bg-white" : "bg-blue-800"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setIdx((i) => Math.min(examQuestions.length - 1, i + 1))}
              disabled={idx === examQuestions.length - 1}
              className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm text-neutral-800 backdrop-blur hover:bg-white/85 transition-colors disabled:opacity-40 disabled:hover:bg-white/60"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const MCQ_STORAGE_KEY = "apcsa.mcqExam.v4";

type SavedMcqProgress = {
  path: string;
  questions: Question[];
  picks: Record<string, string>;
  marked?: Record<string, boolean>;
  idx: number;
  secsLeft: number;
  paused: boolean;
  durationSeconds: number;
};

function readMcqProgress(): SavedMcqProgress | null {
  try {
    const raw = window.localStorage.getItem(MCQ_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedMcqProgress;
    if (!Array.isArray(saved.questions)) return null;
    if (typeof saved.picks !== "object" || saved.picks === null) return null;
    if (typeof saved.idx !== "number" || typeof saved.secsLeft !== "number") return null;
    return saved;
  } catch {
    return null;
  }
}

function optionText(question: Question, letter: string): string {
  const index = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  return index >= 0 ? question.options[index] ?? "" : "";
}

function PausePanel({ onResume }: { onResume: () => void }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
        Exam paused
      </div>
      <div className="mt-3 text-sm text-neutral-700">
        Your answers, current question, and remaining time are saved on this device.
      </div>
      <button
        onClick={onResume}
        className="mt-5 rounded-xl bg-blue-800 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800"
      >
        Resume exam
      </button>
    </div>
  );
}
