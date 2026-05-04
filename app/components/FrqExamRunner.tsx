"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pctToFiveBand } from "@/lib/scoring";
import { FrqEditor } from "./FrqEditor";

export type FrqExamQuestion = {
  id: string;
  archetype: string;
  topic_id: string;
  stem: string;
  parts: string[];
  total_points: number;
};

type GradeResponse = {
  per_criterion: { point_label: string; awarded: number; max: number; justification: string }[];
  total: number;
  max: number;
  feedback: string;
  error?: string;
};

type PerQuestionGrade = GradeResponse & { question_id: string };

const EXAM_SECONDS = 90 * 60;
const STORAGE_KEY = "apcsa.frqExam.v2";
const LEGACY_STORAGE_KEY = "apcsa.frqExam.v1";
const STARTER = "// Write your response here.\n// You may add helper methods if helpful.\n\n";

type SavedFrqProgress = {
  path: string;
  signature: string;
  practiceExamId: number | null;
  responses: Record<string, string>;
  marked?: Record<string, boolean>;
  active: number;
  secsLeft: number;
  paused: boolean;
};

function fmtTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function FrqExamRunner({
  questions,
  practiceExamId,
}: {
  questions: FrqExamQuestion[];
  practiceExamId?: number;
}) {
  const [active, setActive] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) init[q.id] = STARTER;
    return init;
  });
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<"writing" | "grading" | "done">("writing");
  const [grades, setGrades] = useState<PerQuestionGrade[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [secsLeft, setSecsLeft] = useState(EXAM_SECONDS);
  const [paused, setPaused] = useState(false);
  const [restored, setRestored] = useState(false);
  const submitRef = useRef<() => void>(() => {});
  const signature = useMemo(() => questions.map((q) => q.id).join("|"), [questions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedFrqProgress;
        if (
          saved.path === window.location.pathname &&
          saved.signature === signature &&
          saved.responses &&
          typeof saved.responses === "object"
        ) {
          setResponses((prev) => mergeSavedResponses(prev, questions, saved.responses));
          setMarked(saved.marked ?? {});
          setActive(Math.max(0, Math.min(saved.active, questions.length - 1)));
          setSecsLeft(Math.max(0, Math.min(saved.secsLeft, EXAM_SECONDS)));
          setPaused(Boolean(saved.paused));
          setRestored(true);
          return;
        }
      }

      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const saved = JSON.parse(legacyRaw) as { responses?: Record<string, string> };
        if (saved.responses) {
          setResponses((prev) => mergeSavedResponses(prev, questions, saved.responses ?? {}));
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setRestored(true);
  }, [questions, signature]);

  useEffect(() => {
    submitRef.current = () => {
      void submitExam();
    };
  });

  useEffect(() => {
    if (!restored || phase !== "writing") return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          path: window.location.pathname,
          signature,
          practiceExamId: practiceExamId ?? null,
          responses,
          marked,
          active,
          secsLeft,
          paused,
        } satisfies SavedFrqProgress)
      );
    } catch {
      /* quota exceeded, non-fatal */
    }
  }, [active, marked, paused, phase, practiceExamId, restored, responses, secsLeft, signature]);

  useEffect(() => {
    if (phase !== "writing" || paused) return;
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
  }, [paused, phase]);

  const updateResponse = useCallback((id: string, v: string) => {
    setResponses((prev) => ({ ...prev, [id]: v }));
  }, []);

  const submitExam = useCallback(async () => {
    if (phase !== "writing") return;
    setPhase("grading");
    setPaused(false);
    setSubmitError(null);
    try {
      const results = await Promise.all(
        questions.map(async (q): Promise<PerQuestionGrade> => {
          const r = await fetch("/api/frq/grade", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ question_id: q.id, code: responses[q.id] ?? "" }),
          });
          const data = (await r.json()) as GradeResponse;
          return { ...data, question_id: q.id };
        })
      );
      setGrades(results);

      // Persist the exam best-effort. Results should not depend on this write.
      try {
        await fetch("/api/frq/exam-score", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: practiceExamId ? "official" : "frq_full",
            practice_exam_id: practiceExamId ?? null,
            items: results.map((g) => ({
              question_id: g.question_id,
              code: responses[g.question_id] ?? "",
              total: g.total ?? 0,
              max: g.max ?? 0,
              per_criterion: g.per_criterion ?? [],
              feedback: g.feedback ?? "",
            })),
          }),
        });
      } catch (persistErr) {
        console.error("frq exam persist failed", persistErr);
      }

      setPhase("done");
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setPhase("writing");
    }
  }, [phase, questions, responses, practiceExamId]);

  const totals = useMemo(() => {
    if (!grades) return null;
    const total = grades.reduce((a, g) => a + (g.total ?? 0), 0);
    const max = grades.reduce((a, g) => a + (g.max ?? 0), 0);
    const pct = max > 0 ? total / max : 0;
    return { total, max, pct, scaled: pctToFiveBand(pct) };
  }, [grades]);

  if (phase === "done" && grades && totals) {
    return <ResultsPanel questions={questions} grades={grades} totals={totals} />;
  }

  const isGrading = phase === "grading";
  const timerUrgent = secsLeft <= 120;
  const timerWarn = secsLeft <= 600 && secsLeft > 120;
  const activeQuestion = questions[active];
  const activeMarked = activeQuestion ? Boolean(marked[activeQuestion.id]) : false;
  const markedCount = Object.values(marked).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header className="glass-strong rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            FRQ Exam Simulator
          </div>
          <div className="text-sm text-neutral-700 mt-0.5">
            4 questions · 90 minutes · graded by Codex
            {markedCount > 0 && (
              <span className="ml-3 text-blue-800">review {markedCount}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
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
            <div className="text-[11px] uppercase tracking-wide text-neutral-500 mt-1">
              remaining
            </div>
          </div>
          <button
            onClick={() => setPaused((value) => !value)}
            disabled={phase !== "writing"}
            className="rounded-xl border border-white/80 bg-white/65 px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:border-blue-800 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </header>

      {paused && phase === "writing" ? (
        <PausePanel onResume={() => setPaused(false)} />
      ) : (
        <>
          <div className="glass-subtle rounded-xl p-2 flex flex-wrap items-center gap-1.5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setActive(i)}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active === i
                    ? "bg-blue-800 text-white shadow-sm"
                    : "text-neutral-700 hover:bg-white/70"
                } ${marked[q.id] && active !== i ? "ring-2 ring-blue-800" : ""}`}
                title={`Q${i + 1}${marked[q.id] ? " · marked for review" : ""}`}
              >
                <span className="font-mono">Q{i + 1}</span>
                <span className="ml-2 text-xs opacity-75">
                  {archetypeLabel(q.archetype)}
                </span>
                {marked[q.id] && (
                  <span
                    className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
                      active === i ? "bg-white" : "bg-blue-800"
                    }`}
                  />
                )}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {activeQuestion && (
                <button
                  onClick={() =>
                    setMarked((prev) => ({
                      ...prev,
                      [activeQuestion.id]: !prev[activeQuestion.id],
                    }))
                  }
                  disabled={phase !== "writing"}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    activeMarked
                      ? "border-blue-800 bg-blue-800 text-white"
                      : "border-blue-800/30 bg-white/55 text-blue-800 hover:border-blue-800"
                  }`}
                >
                  {activeMarked ? "Marked for review" : "Mark review"}
                </button>
              )}
              <button
                onClick={submitExam}
                disabled={phase !== "writing"}
                className="rounded-lg bg-blue-800 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGrading ? "Grading..." : "Submit exam"}
              </button>
            </div>
          </div>

          {submitError && (
            <div className="glass rounded-xl p-3 text-sm text-neutral-900 border-2 border-blue-800">
              {submitError}
            </div>
          )}

          {isGrading && (
            <div className="glass rounded-2xl p-6 text-center">
              <div className="inline-flex items-center gap-3 text-sm text-neutral-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-800" />
                Codex is grading your responses against the AP rubric...
              </div>
            </div>
          )}

          {questions.map((q, i) => (
            <div key={q.id} className={i === active ? "" : "hidden"}>
              <QuestionPane
                question={q}
                value={responses[q.id] ?? ""}
                onChange={(v) => updateResponse(q.id, v)}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function mergeSavedResponses(
  prev: Record<string, string>,
  questions: FrqExamQuestion[],
  saved: Record<string, string>
) {
  const next = { ...prev };
  for (const q of questions) {
    if (typeof saved[q.id] === "string") next[q.id] = saved[q.id];
  }
  return next;
}

function PausePanel({ onResume }: { onResume: () => void }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
        Exam paused
      </div>
      <div className="mt-3 text-sm text-neutral-700">
        Your responses, current question, and remaining time are saved on this device.
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

function QuestionPane({
  question,
  value,
  onChange,
}: {
  question: FrqExamQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          {archetypeLabel(question.archetype)} ·{" "}
          <span className="font-mono">{question.total_points} points</span>
        </div>
        <div className="max-w-none whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-900">
          {question.stem}
        </div>
        {question.parts.length > 0 && (
          <ol className="mt-4 list-[lower-alpha] space-y-3 pl-6 text-[14px] leading-relaxed text-neutral-800">
            {question.parts.map((p, i) => (
              <li key={i} className="whitespace-pre-wrap">
                {p}
              </li>
            ))}
          </ol>
        )}
      </div>

      <FrqEditor value={value} onChange={onChange} height="520px" />
    </div>
  );
}

function ResultsPanel({
  questions,
  grades,
  totals,
}: {
  questions: FrqExamQuestion[];
  grades: PerQuestionGrade[];
  totals: { total: number; max: number; pct: number; scaled: number };
}) {
  return (
    <div className="space-y-6">
      <header className="glass rounded-2xl p-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            FRQ Exam · Results
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
            Graded
          </h1>
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl tracking-tight text-neutral-900">
            {totals.total.toFixed(1)}
            <span className="text-2xl text-neutral-400"> / {totals.max}</span>
          </div>
          <div className="text-sm text-neutral-600 mt-1">
            {(totals.pct * 100).toFixed(1)}% · est. AP score{" "}
            <span className="font-semibold text-neutral-900">
              {totals.scaled}
            </span>{" "}
            <span className="text-xs text-neutral-500">
              (FRQ-only projection)
            </span>
          </div>
        </div>
      </header>

      {grades.map((g, i) => {
        const q = questions.find((qq) => qq.id === g.question_id);
        return (
          <section key={g.question_id} className="glass rounded-2xl p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
                Q{i + 1}
                <span className="text-xs font-mono text-neutral-500 ml-2">
                  {q ? archetypeLabel(q.archetype) : ""}
                </span>
              </h2>
              <div className="font-mono text-lg text-neutral-900">
                {g.error ? (
                  <span className="text-neutral-500">error</span>
                ) : (
                  <>
                    {(g.total ?? 0).toFixed(1)}{" "}
                    <span className="text-neutral-400">/ {g.max ?? 0}</span>
                  </>
                )}
              </div>
            </div>

            {g.error ? (
              <div className="text-sm text-neutral-700">{g.error}</div>
            ) : (
              <>
                <ul className="space-y-2 mb-4">
                  {g.per_criterion.map((c, j) => {
                    const full = c.awarded >= c.max;
                    const partial = c.awarded > 0 && !full;
                    return (
                      <li
                        key={j}
                        className="flex gap-3 text-sm rounded-lg px-3 py-2 bg-white/45"
                      >
                        <span
                          className={`shrink-0 inline-flex items-center justify-center h-6 px-2 rounded-md text-xs font-mono font-medium ${
                            full
                              ? "bg-blue-800 text-white"
                              : partial
                              ? "bg-white text-neutral-900 ring-1 ring-blue-800"
                              : "bg-white text-neutral-500 ring-1 ring-neutral-300"
                          }`}
                        >
                          {c.awarded}/{c.max}
                        </span>
                        <span className="text-neutral-800">
                          <span className="font-semibold text-neutral-900">
                            {c.point_label}
                          </span>
                          <span className="text-neutral-600">  -  {c.justification}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {g.feedback && (
                  <div className="text-sm text-neutral-700 border-t border-white/60 pt-3">
                    {g.feedback}
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function archetypeLabel(a: string): string {
  switch (a) {
    case "methods_control":
      return "Methods & Control";
    case "class_writing":
      return "Class Writing";
    case "arraylist":
      return "ArrayList";
    case "array_2d":
      return "2D Array";
    default:
      return a;
  }
}
