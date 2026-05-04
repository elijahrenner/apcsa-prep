"use client";

import { useRouter } from "next/navigation";
import { MouseEvent, useState } from "react";

export function DeleteExamButton({ examId }: { examId: number }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteExam(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const ok = window.confirm(
      `Delete exam #${examId}? This removes it from exam history.`
    );
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/exam/${examId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Delete failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={deleteExam}
        disabled={deleting}
        className="rounded-xl border border-red-200 bg-white/60 px-3 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
