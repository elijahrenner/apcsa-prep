"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { FRQ_BLUEPRINT, type FrqArchetype } from "@/lib/frqBlueprint";
import { renderInlineCode } from "@/lib/renderMarkdownHtml";
import { FrqEditor } from "./FrqEditor";

type DrillQuestion = {
  id: string;
  topic_id: string;
  archetype: FrqArchetype;
  label: string;
  source: string;
  stem: string;
  parts: string[];
  rubric: Array<{ point_label: string; criterion: string; points: number }>;
  total_points: number;
  blueprint?: {
    masteryTargets: string[];
    rubricFocus: string[];
  };
};

type GradeResponse = {
  per_criterion: { point_label: string; awarded: number; max: number; justification: string }[];
  total: number;
  max: number;
  feedback: string;
  error?: string;
  detail?: string;
};

const STARTER = "// Write your response here.\n// Keep it AP-style: no extra libraries unless the prompt allows them.\n\n";

export function FrqDrillPlayer() {
  const [q, setQ] = useState<DrillQuestion | null>(null);
  const [selected, setSelected] = useState<FrqArchetype | "all">("all");
  const [code, setCode] = useState(STARTER);
  const [grade, setGrade] = useState<GradeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tStart = useRef<number>(Date.now());

  const generationBody = useMemo(
    () => (selected === "all" ? {} : { archetype: selected }),
    [selected]
  );

  async function loadNext() {
    setLoading(true);
    setGrading(false);
    setGrade(null);
    setError(null);
    setCode(STARTER);
    const r = await fetch("/api/frq/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(generationBody),
    });
    const data = (await r.json()) as DrillQuestion & { error?: string };
    if (!r.ok || data.error) {
      setQ(null);
      setError(data.error ?? "failed to load FRQ");
      setLoading(false);
      return;
    }
    setQ(data);
    tStart.current = Date.now();
    setLoading(false);
  }

  useEffect(() => {
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationBody]);

  async function submit() {
    if (!q || grading || grade) return;
    setGrading(true);
    setError(null);
    const time_ms = Date.now() - tStart.current;
    const r = await fetch("/api/frq/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question_id: q.id, code, time_ms }),
    });
    const data = (await r.json()) as GradeResponse;
    if (!r.ok || data.error) {
      setError(data.detail ?? data.error ?? "grader failed");
      setGrading(false);
      return;
    }
    setGrade(data);
    setGrading(false);
  }

  return (
    <div className="space-y-6">
      <div className="glass-subtle rounded-2xl p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              FRQ drill mix
            </div>
            <div className="mt-1 text-sm text-neutral-700">
              Fresh FRQs are generated one at a time from the Princeton 7/7/5/6 section shape and
              your recent misses.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={selected === "all"} onClick={() => setSelected("all")}>
              All
            </FilterButton>
            {FRQ_BLUEPRINT.map((b) => (
              <FilterButton
                key={b.id}
                active={selected === b.id}
                onClick={() => setSelected(b.id)}
              >
                {b.shortLabel}
              </FilterButton>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 text-center">
          <div className="inline-flex items-center gap-3 text-sm text-neutral-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-800" />
            Generating fresh FRQ...
          </div>
        </div>
      ) : error && !q ? (
        <div className="glass rounded-2xl p-6 text-sm text-neutral-800">{error}</div>
      ) : q ? (
        <>
          <QuestionCard q={q} />
          <FrqEditor value={code} onChange={setCode} height="500px" />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={submit}
              disabled={grading || !!grade}
              className="rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {grading ? "Grading..." : "Grade with agent"}
            </button>
            <button
              onClick={loadNext}
              disabled={grading}
              className="rounded-xl border border-white/80 bg-white/65 px-5 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:border-blue-800 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate another
            </button>
            <span className="text-xs text-neutral-500">
              Each generated FRQ is saved with its own reference solution and per-point rubric.
            </span>
          </div>
          {error && <div className="glass rounded-xl p-3 text-sm text-neutral-800">{error}</div>}
          {grading && (
            <div className="glass rounded-2xl p-5 text-sm text-neutral-700">
              <span className="mr-3 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-800" />
              Codex is scoring each rubric point...
            </div>
          )}
          {grade && <GradePanel grade={grade} onNext={loadNext} />}
          <DrillSupport q={q} />
        </>
      ) : null}
    </div>
  );
}

function QuestionCard({ q }: { q: DrillQuestion }) {
  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-blue-800 px-3 py-1 font-medium text-white">
          {q.label}
        </span>
        <span className="rounded-full border border-white/80 bg-white/65 px-3 py-1 font-mono text-neutral-700">
          {q.total_points} pts
        </span>
        <span className="rounded-full border border-white/80 bg-white/65 px-3 py-1 text-neutral-600">
          {q.source === "live-generated" ? "fresh" : q.source}
        </span>
      </div>
      <div
        className="max-w-none whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-900"
        dangerouslySetInnerHTML={{ __html: renderInlineCode(q.stem) }}
      />
      {q.parts.length > 0 && (
        <ol className="mt-4 list-[lower-alpha] space-y-3 pl-6 text-[14px] leading-relaxed text-neutral-800">
          {q.parts.map((p, i) => (
            <li
              key={i}
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: renderInlineCode(p) }}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function DrillSupport({ q }: { q: DrillQuestion }) {
  const targets = q.blueprint?.masteryTargets ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <section className="glass rounded-2xl p-4">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">
          Master this slot
        </div>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          {targets.map((target) => (
            <li key={target} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-800" />
              <span>{target}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="glass rounded-2xl p-4">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">
          Rubric preview
        </div>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {q.rubric.map((r, i) => (
            <li key={`${r.point_label}-${i}`} className="rounded-lg bg-white/45 px-3 py-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-neutral-900">{r.point_label}</span>
                <span className="font-mono text-xs text-neutral-500">{r.points}</span>
              </div>
              {r.criterion && (
                <div className="mt-1 text-xs leading-relaxed text-neutral-600">
                  {r.criterion}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function GradePanel({ grade, onNext }: { grade: GradeResponse; onNext: () => void }) {
  const pct = grade.max > 0 ? grade.total / grade.max : 0;
  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Rubric score
          </div>
          <div className="mt-1 font-mono text-4xl tracking-tight text-neutral-900">
            {grade.total.toFixed(1)}
            <span className="text-2xl text-neutral-400"> / {grade.max}</span>
          </div>
        </div>
        <div className="text-sm text-neutral-600">{(pct * 100).toFixed(1)}%</div>
      </div>

      <ul className="mt-5 space-y-2">
        {grade.per_criterion.map((c, i) => {
          const full = c.awarded >= c.max;
          const partial = c.awarded > 0 && !full;
          return (
            <li key={i} className="flex gap-3 rounded-lg bg-white/45 px-3 py-2 text-sm">
              <span
                className={`shrink-0 inline-flex h-6 min-w-10 items-center justify-center rounded-md px-2 text-xs font-mono font-medium ${
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
                <span className="font-semibold text-neutral-900">{c.point_label}</span>
                <span className="text-neutral-600"> - {c.justification}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {grade.feedback && (
        <div className="mt-4 border-t border-white/60 pt-4 text-sm leading-relaxed text-neutral-700">
          {grade.feedback}
        </div>
      )}
      <button
        onClick={onNext}
        className="mt-5 rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800"
      >
        Next FRQ
      </button>
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-blue-800 px-4 py-1.5 text-sm font-medium text-white shadow-sm"
          : "rounded-full border border-white/80 bg-white/60 px-4 py-1.5 text-sm text-neutral-800 transition-colors hover:bg-white/85"
      }
    >
      {children}
    </button>
  );
}
