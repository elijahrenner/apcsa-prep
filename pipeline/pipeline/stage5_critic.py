"""Stage 5  -  LLM realism critic on validated MCQs.

For each topic in `data/validated_mcqs/`, sample up to 5 questions and ask
the configured LLM to rate each on a 1-5 "would this fit on a real May 2026 AP
CSA exam?" scale. Drop questions scoring <= 2 in place (rewrite the validated
file with survivors only).

Run:
    cd pipeline && .venv/bin/python -m pipeline.stage5_critic
    # single topic:
    cd pipeline && .venv/bin/python -m pipeline.stage5_critic u1_s1_15
"""
from __future__ import annotations

import asyncio
import json
import random
import sys
from pathlib import Path

from .shared.paths import PROMPTS, VALIDATED_MCQ_DIR
from .shared.sdk_client import OPUS, ask_json
from .stage4_validate import PRINCETON_BACKED_SKIP_LLM_TOPICS

CONCURRENCY = 4
SAMPLE_SIZE = 5
DROP_AT_OR_BELOW = 2


async def _critique_one(
    q: dict, system: str, sem: asyncio.Semaphore
) -> tuple[int, str]:
    payload = {
        "topic_id": q.get("topic_id"),
        "stem": q.get("stem"),
        "options": q.get("options"),
        "answer": q.get("answer"),
        "explanation": q.get("explanation"),
        "difficulty": q.get("difficulty"),
    }
    user_prompt = (
        "Rate this candidate MCQ for May 2026 AP CSA exam realism.\n\n"
        "```json\n" + json.dumps(payload, indent=2) + "\n```"
    )
    async with sem:
        try:
            data = await ask_json(user_prompt, system=system, model=OPUS, max_turns=1)
        except Exception as e:  # noqa: BLE001
            # Be conservative on judge failure: keep the question (score=3, neutral).
            return 3, f"critic error: {e!r}"

    score = data.get("score") if isinstance(data, dict) else None
    reason = data.get("reason", "") if isinstance(data, dict) else ""
    if not isinstance(score, int) or not (1 <= score <= 5):
        return 3, f"bad score from critic: {score!r}"
    return score, reason


async def _critique_topic(
    topic_id: str, path: Path, system: str, sem: asyncio.Semaphore
) -> None:
    if topic_id in PRINCETON_BACKED_SKIP_LLM_TOPICS:
        print(f"[skip] {topic_id}: Princeton-backed topic kept after deterministic validation")
        return

    items = json.loads(path.read_text())
    if not isinstance(items, list) or not items:
        print(f"[skip] {topic_id}: no validated items")
        return

    sample_n = min(SAMPLE_SIZE, len(items))
    indices = random.sample(range(len(items)), sample_n)
    samples = [items[i] for i in indices]

    results = await asyncio.gather(
        *[_critique_one(q, system, sem) for q in samples]
    )

    drop_indices: set[int] = set()
    reasons_kept: list[str] = []
    for idx, (score, reason) in zip(indices, results):
        if score <= DROP_AT_OR_BELOW:
            drop_indices.add(idx)
            reasons_kept.append(f"score={score}: {reason}")

    if drop_indices:
        survivors = [q for i, q in enumerate(items) if i not in drop_indices]
        path.write_text(json.dumps(survivors, indent=2))
    else:
        survivors = items

    reason_summary = "; ".join(reasons_kept[:3]) if reasons_kept else "-"
    print(
        f"[ok  ] {topic_id:<12s} sampled={sample_n} "
        f"kept={sample_n - len(drop_indices)} dropped={len(drop_indices)} "
        f"final={len(survivors)} reasons={reason_summary}"
    )


async def _main_async(only_topic: str | None = None) -> None:
    system = (PROMPTS / "system_realism_critic.md").read_text()

    files = sorted(VALIDATED_MCQ_DIR.glob("*.json"))
    if only_topic:
        files = [p for p in files if p.stem == only_topic]
        if not files:
            print(f"[stage5] no validated file for topic {only_topic!r}")
            return

    sem = asyncio.Semaphore(CONCURRENCY)
    for path in files:
        await _critique_topic(path.stem, path, system, sem)

    print(f"\nstage 5 done. topics={len(files)}")


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(_main_async(only))


if __name__ == "__main__":
    main()
