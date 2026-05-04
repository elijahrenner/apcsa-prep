"""Stage 3  -  generate ~25 MCQ candidates per topic in parallel.

For each of the 53 topics, dispatch one async worker that reads the format spec,
the topic's notes excerpt, and 3 PR examples tagged to this topic, then asks
the configured LLM for 25 candidate MCQs. Results land in
`data/raw_mcqs/{topic_id}.json`.

Idempotent: skips topics that already have a non-empty output file.
"""
from __future__ import annotations

import asyncio
import json
import random
from pathlib import Path
from typing import Any

from .shared.parse_notes import parse as parse_topics
from .shared.paths import (
    FORMAT_SPEC, PRINCETON_CHAPTERS, PRINCETON_EXAMS, PROMPTS, RAW_MCQ_DIR,
)
from .shared.sdk_client import SONNET, ask_json

CONCURRENCY = 4
TARGET_PER_TOPIC = 25
CHUNK_SIZE = 6  # request this many per LLM call; persist after each chunk


def _samples_for_topic(topic_id: str, format_spec: dict, all_pr_items: list[dict]) -> list[dict]:
    """Pick up to 3 PR items the format_spec aligned to this topic."""
    align = format_spec.get("topic_alignment", {}).get(topic_id, {})
    refs = align.get("pr_exam_item_refs", [])[:3]
    chosen: list[dict] = []
    for ref in refs:
        match = next(
            (it for it in all_pr_items
             if it.get("_exam_id") == ref.get("exam_id")
             and it.get("_section") == ref.get("section")
             and it.get("_index") == ref.get("index")),
            None,
        )
        if match:
            chosen.append(match)
    if len(chosen) < 3:
        # fall back: any 3 random PR MCQs
        pool = [it for it in all_pr_items if it.get("_section") == "mcq"]
        random.shuffle(pool)
        for it in pool:
            if it not in chosen:
                chosen.append(it)
            if len(chosen) >= 3:
                break
    return chosen[:3]


async def _generate_one(
    topic, format_spec: dict, all_pr_items: list[dict], system: str, sem: asyncio.Semaphore
) -> tuple[str, int, str | None]:
    out_path = RAW_MCQ_DIR / f"{topic.id}.json"
    existing: list[dict] = []
    if out_path.exists() and out_path.stat().st_size > 100:
        try:
            existing = json.loads(out_path.read_text()) or []
        except Exception:  # noqa: BLE001
            existing = []
    if len(existing) >= TARGET_PER_TOPIC:
        return topic.id, len(existing), "cached"

    examples = _samples_for_topic(topic.id, format_spec, all_pr_items)
    merged = list(existing)
    last_err: str | None = None
    out_path.parent.mkdir(parents=True, exist_ok=True)

    while len(merged) < TARGET_PER_TOPIC:
        chunk = min(CHUNK_SIZE, TARGET_PER_TOPIC - len(merged))
        user_prompt = _build_user_prompt(topic, format_spec, examples, needed=chunk)
        async with sem:
            try:
                data = await ask_json(user_prompt, system=system, model=SONNET, max_turns=1)
            except Exception as e:  # noqa: BLE001
                last_err = f"error after {len(merged)}/{TARGET_PER_TOPIC}: {e!r}"
                break

        if not isinstance(data, list) or not data:
            last_err = f"empty/non-list after {len(merged)}/{TARGET_PER_TOPIC}"
            break

        added = sum(1 for item in data if isinstance(item, dict))
        merged.extend(item for item in data if isinstance(item, dict))
        out_path.write_text(json.dumps(merged, indent=2))
        print(f"[chunk] {topic.id}: +{added} → {len(merged)}/{TARGET_PER_TOPIC}", flush=True)

        if added == 0:
            last_err = f"no valid items in chunk at {len(merged)}/{TARGET_PER_TOPIC}"
            break

    return topic.id, len(merged), last_err


def _build_user_prompt(topic, format_spec: dict, examples: list[dict], *, needed: int = TARGET_PER_TOPIC) -> str:
    parts = [
        f"# Topic\n",
        f"id: {topic.id}\n",
        f"unit: {topic.unit}\n",
        f"section: {topic.section}\n",
        f"name: {topic.name}\n\n",
        "# Format spec (authoritative)\n",
        "```json\n",
        json.dumps(format_spec, indent=2),
        "\n```\n\n",
        "# Three example MCQs from Princeton Review 2025 (match this style)\n",
    ]
    for i, ex in enumerate(examples, 1):
        parts.append(f"\n## Example {i}\n")
        parts.append("```json\n")
        slim = {k: ex[k] for k in ("stem", "options", "answer") if k in ex}
        parts.append(json.dumps(slim, indent=2))
        parts.append("\n```\n")
    parts.append(
        "\n# Topic notes excerpt (the student's study notes)\n\n"
        + topic.notes_excerpt
        + f"\n\n# Task\n\nGenerate exactly **{needed}** candidate MCQs as a JSON array. "
        "Return only the JSON  -  no commentary, no markdown fences.\n"
    )
    return "".join(parts)


async def _main_async() -> None:
    topics = parse_topics()
    format_spec = json.loads(FORMAT_SPEC.read_text())
    chapters = json.loads(PRINCETON_CHAPTERS.read_text())
    exams = json.loads(PRINCETON_EXAMS.read_text())

    all_pr_items: list[dict] = []
    for ex in exams:
        for i, m in enumerate(ex.get("mcq_section", [])):
            it = dict(m); it["_exam_id"] = ex["exam_id"]; it["_section"] = "mcq"; it["_index"] = i
            all_pr_items.append(it)
    for c in chapters:
        c2 = dict(c); c2["_section"] = "drill"; c2["_index"] = -1
        all_pr_items.append(c2)

    system = (PROMPTS / "system_mcq_writer.md").read_text()
    sem = asyncio.Semaphore(CONCURRENCY)
    RAW_MCQ_DIR.mkdir(parents=True, exist_ok=True)

    tasks = [
        asyncio.create_task(_generate_one(t, format_spec, all_pr_items, system, sem))
        for t in topics
    ]
    n_ok = n_cached = n_err = 0
    for fut in asyncio.as_completed(tasks):
        topic_id, count, err = await fut
        if err == "cached":
            n_cached += 1
            print(f"[cache] {topic_id}: {count}", flush=True)
        elif err:
            n_err += 1
            print(f"[ERR ] {topic_id}: {err}", flush=True)
        else:
            n_ok += 1
            print(f"[ok  ] {topic_id}: now {count}", flush=True)

    print(f"\nstage 3 done. ok={n_ok} cached={n_cached} err={n_err}")


def main() -> None:
    asyncio.run(_main_async())


if __name__ == "__main__":
    main()
