"use client";

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; summary: string }
  | { kind: "error"; message: string };

export function CoachCard() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function refresh() {
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/coach", { method: "POST" });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setState({
          kind: "error",
          message: data.error ?? `request failed (${r.status})`,
        });
        return;
      }
      const data = (await r.json()) as { summary?: string };
      const summary = (data.summary ?? "").trim();
      if (!summary) {
        setState({ kind: "error", message: "empty response" });
        return;
      }
      setState({ kind: "result", summary });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-800" />
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Coach
          </h2>
        </div>
        <button
          onClick={refresh}
          disabled={state.kind === "loading"}
          className="rounded-full border border-white/80 bg-white/65 px-3 py-1 text-xs font-medium text-neutral-800 backdrop-blur hover:bg-white/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.kind === "loading" ? "Thinking…" : "Refresh"}
        </button>
      </div>

      <div className="mt-3 min-h-[3.5rem] text-sm leading-relaxed">
        {state.kind === "idle" && (
          <p className="text-neutral-500">
            Tap refresh for a 2–3 sentence focus recommendation based on your
            recent practice.
          </p>
        )}
        {state.kind === "loading" && (
          <div className="inline-flex items-center gap-2 text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-800 animate-pulse" />
            Reading your stats…
          </div>
        )}
        {state.kind === "result" && (
          <p className="text-neutral-800">{state.summary}</p>
        )}
        {state.kind === "error" && (
          <p className="text-neutral-700">
            Couldn&apos;t generate a summary
            <span className="text-neutral-500">  -  {state.message}</span>
          </p>
        )}
      </div>
    </div>
  );
}
