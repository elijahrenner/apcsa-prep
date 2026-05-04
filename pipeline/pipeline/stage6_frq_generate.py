"""Stage 6  -  generate FRQ candidates per archetype.

4 archetypes × 12 variants = 48 raw candidates total. Each archetype is
generated in chunks by the configured LLM. Output →
`data/raw_frqs/{archetype}.json`.

Idempotent: skips an archetype whose output file already exists and is non-trivial.

Run:
    cd pipeline && .venv/bin/python -m pipeline.stage6_frq_generate
    cd pipeline && .venv/bin/python -m pipeline.stage6_frq_generate methods_control
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from .shared.paths import FORMAT_SPEC, PROMPTS, RAW_FRQ_DIR
from .shared.sdk_client import OPUS, ask_json

ARCHETYPES: dict[str, dict] = {
    "methods_control": {
        "total_points": 7,
        "default_topic": "u2_s2_8",
        "blurb": (
            "Write one or more methods that use control structures (if/else, "
            "while, for) and basic String operations. Typical of FRQ #1."
        ),
    },
    "class_writing": {
        "total_points": 7,
        "default_topic": "u3_s3_3",
        "blurb": (
            "Write a complete class with private instance variables, a "
            "constructor, and 1-2 instance methods. No inheritance."
        ),
    },
    "arraylist": {
        "total_points": 5,
        "default_topic": "u4_s4_8",
        "blurb": (
            "Manipulate an ArrayList<T>: add, remove, traverse, transform "
            "in place, or build a new list."
        ),
    },
    "array_2d": {
        "total_points": 6,
        "default_topic": "u4_s4_11",
        "blurb": (
            "Process a 2D array (int[][], double[][], or String[][]): "
            "row/column traversal, neighborhood scan, or transposition."
        ),
    },
}

CONCURRENCY = 2
TARGET_PER_ARCHETYPE = 12
CHUNK_SIZE = 2  # request this many per LLM call; persist after each chunk


def _load_format_spec() -> dict:
    if FORMAT_SPEC.exists():
        try:
            return json.loads(FORMAT_SPEC.read_text())
        except Exception:  # noqa: BLE001
            pass
    return {}


def _build_user_prompt(archetype: str, format_spec: dict, *, needed: int) -> str:
    spec = ARCHETYPES[archetype]
    archetypes_list = format_spec.get("frq_archetypes") or []
    archetype_match = next(
        (a for a in archetypes_list if isinstance(a, dict) and a.get("id") == archetype),
        {},
    )
    archetype_note = json.dumps(archetype_match, indent=2)
    return (
        f"# Archetype\n\n"
        f"id: `{archetype}`\n"
        f"total_points: {spec['total_points']}\n"
        f"default_topic_id: `{spec['default_topic']}`\n"
        f"description: {spec['blurb']}\n\n"
        f"# Format spec slice (if available)\n\n"
        f"```json\n{archetype_note}\n```\n\n"
        f"# Task\n\n"
        f"Generate exactly **{needed}** FRQ variants for the `{archetype}` archetype, "
        f"each worth **{spec['total_points']}** points. Diversify scenarios  -  "
        f"do not repeat the same problem with renamed variables. Each must include "
        f"3 `test_cases` whose `setup_java` snippets, when concatenated after the "
        f"`reference_solution` inside `Main.main`, produce the `expected_output` to stdout.\n\n"
        f"CRITICAL JSON ESCAPING: every newline inside a JSON string value (Java code, "
        f"prompts, etc.) MUST be encoded as `\\n`  -  never a literal newline character. "
        f"Tabs as `\\t`. Quote marks as `\\\"`. The output must parse with `json.loads()` "
        f"with no preprocessing.\n\n"
        f"Return ONLY the JSON array  -  no commentary, no markdown fences.\n"
    )


async def _generate_one(
    archetype: str, format_spec: dict, system: str, sem: asyncio.Semaphore
) -> tuple[str, int, str | None]:
    out_path = RAW_FRQ_DIR / f"{archetype}.json"
    existing: list[dict] = []
    if out_path.exists() and out_path.stat().st_size > 200:
        try:
            data = json.loads(out_path.read_text())
            if isinstance(data, list):
                existing = data
        except Exception:  # noqa: BLE001
            existing = []
    if len(existing) >= TARGET_PER_ARCHETYPE:
        return archetype, len(existing), "cached"

    expected_pts = ARCHETYPES[archetype]["total_points"]
    cleaned = list(existing)
    last_err: str | None = None
    out_path.parent.mkdir(parents=True, exist_ok=True)

    while len(cleaned) < TARGET_PER_ARCHETYPE:
        chunk = min(CHUNK_SIZE, TARGET_PER_ARCHETYPE - len(cleaned))
        prompt = _build_user_prompt(archetype, format_spec, needed=chunk)
        async with sem:
            try:
                data = await ask_json(prompt, system=system, model=OPUS, max_turns=1)
            except Exception as e:  # noqa: BLE001
                last_err = f"error after {len(cleaned)}/{TARGET_PER_ARCHETYPE}: {e!r}"
                break

        if not isinstance(data, list) or not data:
            last_err = f"empty/non-list after {len(cleaned)}/{TARGET_PER_ARCHETYPE}"
            break

        added = 0
        for item in data:
            if not isinstance(item, dict):
                continue
            item.setdefault("archetype", archetype)
            item.setdefault("total_points", expected_pts)
            item.setdefault("topic_id", ARCHETYPES[archetype]["default_topic"])
            cleaned.append(item)
            added += 1

        out_path.write_text(json.dumps(cleaned, indent=2))
        print(f"[chunk] {archetype}: +{added} → {len(cleaned)}/{TARGET_PER_ARCHETYPE}")

        if added == 0:
            last_err = f"no valid items in chunk at {len(cleaned)}/{TARGET_PER_ARCHETYPE}"
            break

    return archetype, len(cleaned), last_err


async def _main_async(only_archetype: str | None = None) -> None:
    if only_archetype and only_archetype not in ARCHETYPES:
        print(f"[stage6] unknown archetype {only_archetype!r}; valid: {list(ARCHETYPES)}")
        return

    format_spec = _load_format_spec()
    system = (PROMPTS / "system_frq_writer.md").read_text()

    archetypes = [only_archetype] if only_archetype else list(ARCHETYPES)
    sem = asyncio.Semaphore(CONCURRENCY)
    RAW_FRQ_DIR.mkdir(parents=True, exist_ok=True)

    tasks = [
        asyncio.create_task(_generate_one(a, format_spec, system, sem))
        for a in archetypes
    ]

    n_ok = n_cached = n_err = 0
    total_items = 0
    for fut in asyncio.as_completed(tasks):
        archetype, count, err = await fut
        if err == "cached":
            n_cached += 1
            total_items += count
            print(f"[cache] {archetype}: {count} items")
        elif err:
            n_err += 1
            print(f"[ERR ] {archetype}: {err}")
        else:
            n_ok += 1
            total_items += count
            print(f"[ok  ] {archetype}: {count} candidates")

    print(
        f"\nstage 6 done. archetypes={len(archetypes)} "
        f"ok={n_ok} cached={n_cached} err={n_err} total_items={total_items}"
    )


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(_main_async(only))


if __name__ == "__main__":
    main()
