"use client";

import { useEffect, useRef, useState } from "react";

import { renderInlineCode } from "@/lib/renderMarkdownHtml";

type Question = {
  id: string;
  topic: { unit: number; section: string; name: string };
  topic_id: string;
  stem: string;
  options: string[];
  difficulty: number;
};

type Result = { correct: boolean; correct_answer: string; explanation: string };

const LETTERS = ["A", "B", "C", "D"] as const;

export function McqPlayer({
  fetchUrl,
  onAnswered,
  showTopicChip = true,
}: {
  fetchUrl: string;
  onAnswered?: (correct: boolean) => void;
  showTopicChip?: boolean;
}) {
  const [q, setQ] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const tStart = useRef<number>(Date.now());

  async function loadNext() {
    setLoading(true);
    setPicked(null);
    setResult(null);
    const r = await fetch(fetchUrl, { cache: "no-store" });
    const data = (await r.json()) as Question;
    setQ(data);
    tStart.current = Date.now();
    setLoading(false);
  }

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl]);

  async function submit(letter: string) {
    if (!q || picked) return;
    setPicked(letter);
    const time_ms = Date.now() - tStart.current;
    const r = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question_id: q.id, answer: letter, time_ms }),
    });
    const res = (await r.json()) as Result;
    setResult(res);
    onAnswered?.(res.correct);
  }

  if (loading || !q) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <div className="inline-flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-800" />
          Loading question…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showTopicChip && (
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3 py-1 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-800" />
            <span className="font-mono text-neutral-800">{q.topic.section}</span>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-700">{q.topic.name}</span>
          </span>
          <DifficultyDots level={q.difficulty} />
        </div>
      )}

      <div className="glass rounded-2xl p-6 sm:p-7">
        <div
          className="max-w-none whitespace-pre-wrap font-mono text-[15px] leading-relaxed text-neutral-900"
          dangerouslySetInnerHTML={{ __html: renderInlineCode(q.stem) }}
        />
      </div>

      <div className="grid gap-2.5">
        {LETTERS.map((letter, i) => {
          const text = q.options[i];
          const isPicked = picked === letter;
          const isCorrect = result?.correct_answer === letter;
          const showState = !!result;
          const base =
            "group flex items-start gap-3 text-left rounded-xl border px-4 py-3.5 font-mono text-sm transition-all backdrop-blur";
          let cls: string;
          if (showState) {
            if (isCorrect) {
              cls = "border-blue-800 bg-white/90 text-neutral-900 ring-2 ring-blue-800/30";
            } else if (isPicked) {
              cls = "border-neutral-300 bg-white/50 text-neutral-500 line-through decoration-neutral-400";
            } else {
              cls = "border-white/60 bg-white/35 text-neutral-500";
            }
          } else {
            cls =
              "border-white/80 bg-white/60 text-neutral-900 hover:bg-white/90 hover:border-blue-800/25 hover:shadow-md hover:-translate-y-0.5";
          }
          return (
            <button
              key={letter}
              onClick={() => submit(letter)}
              disabled={!!picked}
              className={`${base} ${cls}`}
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold transition-colors ${
                  showState && isCorrect
                    ? "bg-blue-800 text-white"
                    : showState && isPicked
                    ? "bg-neutral-300 text-neutral-600"
                    : "bg-blue-800 text-white group-hover:bg-blue-800"
                }`}
              >
                {letter}
              </span>
              <span
                className="min-w-0 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderInlineCode(text) }}
              />
            </button>
          );
        })}
      </div>

      {result && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                result.correct
                  ? "bg-blue-800 text-white"
                  : "border border-blue-800 bg-white text-blue-800"
              }`}
              aria-hidden
            >
              {result.correct ? "✓" : "✕"}
            </span>
            {result.correct
              ? "Correct."
              : `Incorrect  -  correct answer: ${result.correct_answer}`}
          </div>
          <div
            className="text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderInlineCode(result.explanation) }}
          />
          <button
            onClick={loadNext}
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 hover:-translate-y-0.5 transition-all"
          >
            Next question
            <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
      <span className="mr-1">difficulty</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i <= level ? "bg-blue-800" : "bg-neutral-300"
          }`}
        />
      ))}
    </span>
  );
}
