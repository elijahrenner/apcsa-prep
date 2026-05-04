import { existsSync } from "node:fs";
import path from "node:path";

import { FrqDrillPlayer } from "@/components/FrqDrillPlayer";
import { FRQ_BLUEPRINT } from "@/lib/frqBlueprint";

export const dynamic = "force-dynamic";

const DB_PATH = path.resolve(process.cwd(), "data/apcsa.db");

export default function SpamPage() {
  if (!existsSync(DB_PATH)) {
    return (
      <div className="glass rounded-2xl p-6">
        Run <code className="font-mono">make seed</code> first.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-medium">
          Generated FRQ drill
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          FRQ Spam
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Generates a fresh Princeton-grounded FRQ every round, then grades your response against
          that generated rubric. For MCQs, use Practice Qs.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {FRQ_BLUEPRINT.map((b) => (
          <div key={b.id} className="glass rounded-2xl p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Q{b.position}
              </div>
              <div className="font-mono text-xs text-neutral-500">{b.totalPoints} pts</div>
            </div>
            <div className="mt-2 text-sm font-semibold text-neutral-900">{b.label}</div>
            <div className="mt-2 text-xs leading-relaxed text-neutral-600">
              {b.rubricFocus.join(" · ")}
            </div>
          </div>
        ))}
      </section>
      <FrqDrillPlayer />
    </div>
  );
}
