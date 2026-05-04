import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

import { McqPlayer } from "@/components/McqPlayer";
import { getTopics } from "@/lib/db";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; unit?: string }>;
}) {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }

  const params = await searchParams;
  const topics = getTopics();
  const selectedTopic = params.topic
    ? topics.find((t) => t.id === params.topic)
    : undefined;
  const selectedUnit = params.unit ? Number(params.unit) : undefined;

  const url = new URLSearchParams();
  if (params.topic) url.set("topic", params.topic);
  if (params.unit) url.set("unit", params.unit);
  const fetchUrl = `/api/question${url.toString() ? "?" + url.toString() : ""}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
            Adaptive practice
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
            Practice
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {selectedTopic ? (
              <>
                Focused on{" "}
                <span className="font-medium text-neutral-900">
                  {selectedTopic.section} {selectedTopic.name}
                </span>
                <Link
                  href="/practice"
                  className="ml-3 text-neutral-900 underline underline-offset-2 hover:no-underline"
                >
                  clear filter
                </Link>
              </>
            ) : selectedUnit ? (
              <>
                Filtered to{" "}
                <span className="font-medium text-neutral-900">Unit {selectedUnit}</span>
                <Link
                  href="/practice"
                  className="ml-3 text-neutral-900 underline underline-offset-2 hover:no-underline"
                >
                  clear filter
                </Link>
              </>
            ) : (
              "High-yield and weakness-targeted across all test-scope topics."
            )}
          </p>
        </div>
      </div>

      {!params.topic && (
        <div className="glass-subtle rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
            Filter by unit
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((u) => {
              const active = selectedUnit === u;
              return (
                <Link
                  key={u}
                  href={`/practice?unit=${u}`}
                  className={
                    active
                      ? "rounded-full bg-blue-800 px-4 py-1.5 text-sm font-medium text-white shadow-sm"
                      : "rounded-full border border-white/80 bg-white/60 px-4 py-1.5 text-sm text-neutral-800 hover:bg-white/85 transition-colors"
                  }
                >
                  Unit {u}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <McqPlayer fetchUrl={fetchUrl} />
    </div>
  );
}
