"""Publish step  -  flatten pipeline scratch (raw_*, validated_*) into the
canonical tree under data/{mcqs,frqs,practice_tests}/.

Layout produced:

    data/mcqs/{topic_id}.json          -  one file per topic, list of MCQs
    data/frqs/{archetype}.json         -  one file per archetype, list of FRQs
    data/practice_tests/
        official/test_{1,2,3}.json     -  the 3 Princeton Review 2025 practice exams
        synthetic/test_{1,2,3}.json    -  3 NEW practice exams assembled from the
                                        generated MCQ + FRQ banks; same format
                                        as PR (42 MCQ matching CED unit weights,
                                        4 FRQ one per archetype, 90 + 90 min).

Idempotent. Safe to run multiple times. Picks validated_* if available, else
falls back to raw_*.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

from .shared.parse_notes import parse as parse_topics, topic_id
from .shared.paths import (
    DATA, PRINCETON_EXAMS, RAW_FRQ_DIR, RAW_MCQ_DIR, VALIDATED_FRQS,
    VALIDATED_MCQ_DIR,
)
from .shared.test_scope import item_is_test_scope, in_test_scope_topic

MCQS_DIR = DATA / "mcqs"
FRQS_DIR = DATA / "frqs"
TESTS_OFFICIAL = DATA / "practice_tests" / "official"
TESTS_SYNTH = DATA / "practice_tests" / "synthetic"

# CED unit weights for the new (2025-26) AP CSA exam.
UNIT_WEIGHTS_PCT: dict[int, tuple[int, int]] = {1: (15, 25), 2: (25, 35), 3: (10, 18), 4: (30, 40)}
EXAM_MCQ_TOTAL = 42
ARCHETYPE_ORDER = ["methods_control", "class_writing", "arraylist", "array_2d"]
ARCHETYPE_TOPIC = {
    "methods_control": "u2_s2_8",
    "class_writing":   "u3_s3_4",
    "arraylist":       "u4_s4_10",
    "array_2d":        "u4_s4_13",
}


def _publish_mcqs() -> int:
    MCQS_DIR.mkdir(parents=True, exist_ok=True)
    for old in MCQS_DIR.glob("*.json"):
        old.unlink()
    src = VALIDATED_MCQ_DIR if VALIDATED_MCQ_DIR.exists() and any(VALIDATED_MCQ_DIR.iterdir()) else RAW_MCQ_DIR
    n = 0
    for f in sorted(src.glob("*.json")):
        if not in_test_scope_topic(f.stem):
            continue
        dest = MCQS_DIR / f.name
        items = json.loads(f.read_text())
        if isinstance(items, list):
            items = [item for item in items if isinstance(item, dict) and item_is_test_scope(item)]
        dest.write_text(json.dumps(items, indent=2))
        n += 1
    print(f"  mcqs: published {n} topic files from {src.relative_to(DATA)}")
    return n


def _publish_frqs() -> int:
    FRQS_DIR.mkdir(parents=True, exist_ok=True)
    for old in FRQS_DIR.glob("*.json"):
        old.unlink()
    n = 0
    if VALIDATED_FRQS.exists():
        # one big list  -  split by archetype for the canonical layout
        frqs = json.loads(VALIDATED_FRQS.read_text())
        by_arche: dict[str, list] = {}
        for f in frqs:
            by_arche.setdefault(f.get("archetype", "unknown"), []).append(f)
        for arche, items in by_arche.items():
            (FRQS_DIR / f"{arche}.json").write_text(json.dumps(items, indent=2))
            n += len(items)
        print(f"  frqs: published {n} FRQs across {len(by_arche)} archetypes (validated)")
    else:
        for f in sorted(RAW_FRQ_DIR.glob("*.json")):
            dest = FRQS_DIR / f.name
            dest.write_text(f.read_text())
            try:
                n += len(json.loads(dest.read_text()))
            except Exception:  # noqa: BLE001
                pass
        print(f"  frqs: published {n} FRQs across {len(list(FRQS_DIR.glob('*.json')))} archetype files (raw)")
    return n


def _publish_official_tests() -> int:
    TESTS_OFFICIAL.mkdir(parents=True, exist_ok=True)
    for old in TESTS_OFFICIAL.glob("*.json"):
        old.unlink()
    if not PRINCETON_EXAMS.exists():
        print("  practice_tests/official: no princeton_exams.json  -  skipped")
        return 0
    exams = json.loads(PRINCETON_EXAMS.read_text())
    n = 0
    for ex in exams:
        frq_section = []
        for idx, item in enumerate(ex.get("frq_section", [])):
            frq = dict(item)
            archetype = frq.get("archetype") or ARCHETYPE_ORDER[min(idx, len(ARCHETYPE_ORDER) - 1)]
            frq.setdefault("archetype", archetype)
            frq.setdefault("topic_id", ARCHETYPE_TOPIC.get(archetype))
            frq_section.append(frq)
        out = {
            "label": f"Princeton Review 2025  -  Practice Test {ex['exam_id']}",
            "source": "princeton-2025",
            "format": "new-2025-26-ced",
            "mcq_section": ex.get("mcq_section", []),
            "frq_section": frq_section,
        }
        (TESTS_OFFICIAL / f"test_{ex['exam_id']}.json").write_text(json.dumps(out, indent=2))
        n += 1
    print(f"  practice_tests/official: wrote {n} exams")
    return n


def _load_mcq_bank() -> dict[str, list[dict]]:
    """All MCQs grouped by topic_id, drawn from the canonical mcqs/ tree."""
    out: dict[str, list[dict]] = {}
    for f in sorted(MCQS_DIR.glob("*.json")):
        try:
            items = json.loads(f.read_text())
            if isinstance(items, list):
                out[f.stem] = items
        except Exception:  # noqa: BLE001
            pass
    return out


def _load_frq_bank() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for f in sorted(FRQS_DIR.glob("*.json")):
        try:
            items = json.loads(f.read_text())
            if isinstance(items, list):
                out[f.stem] = items
        except Exception:  # noqa: BLE001
            pass
    return out


def _build_synthetic_tests(n_tests: int = 3, seed: int = 1) -> int:
    """Assemble n_tests synthetic practice exams from the generated bank.

    Each test mirrors the PR (and real 2026) format: 42 MCQs respecting CED
    unit weights, then 4 FRQs (one per archetype in 1-2-3-4 order). Sampling is
    deterministic given `seed`. Tests don't share questions across each other
    when the bank is large enough; if a topic has fewer MCQs than requested for
    a single test, sampling falls back to with-replacement across tests.
    """
    TESTS_SYNTH.mkdir(parents=True, exist_ok=True)
    for old in TESTS_SYNTH.glob("*.json"):
        old.unlink()
    mcq_bank = _load_mcq_bank()
    frq_bank = _load_frq_bank()
    if not mcq_bank:
        print("  practice_tests/synthetic: empty MCQ bank  -  skipped")
        return 0

    topics = parse_topics()
    by_unit: dict[int, list[str]] = {1: [], 2: [], 3: [], 4: []}
    for t in topics:
        if t.id in mcq_bank:
            by_unit[t.unit].append(t.id)

    rng = random.Random(seed)
    used_mcq_ids: set[tuple[str, int]] = set()  # (topic_id, index_in_bank)
    n_built = 0

    for test_idx in range(1, n_tests + 1):
        # pick per-unit counts in CED ranges that sum to 42
        targets: dict[int, int] = {}
        remaining = EXAM_MCQ_TOTAL
        for i, u in enumerate([1, 2, 3, 4]):
            if i == 3:
                targets[u] = remaining
                continue
            lo, hi = UNIT_WEIGHTS_PCT[u]
            lo_n = round((lo / 100) * EXAM_MCQ_TOTAL)
            hi_n = round((hi / 100) * EXAM_MCQ_TOTAL)
            n = rng.randint(lo_n, hi_n)
            targets[u] = min(n, remaining)
            remaining -= targets[u]

        mcq_section: list[dict] = []
        for unit, count in targets.items():
            unit_topics = list(by_unit[unit])
            if not unit_topics:
                continue
            # collect candidates: each MCQ tagged with its source topic+index
            pool: list[tuple[str, int, dict]] = []
            for tid in unit_topics:
                for i, m in enumerate(mcq_bank[tid]):
                    if (tid, i) not in used_mcq_ids:
                        pool.append((tid, i, m))
            if len(pool) < count:
                # fall back: refill with already-used items
                pool = [(tid, i, m) for tid in unit_topics for i, m in enumerate(mcq_bank[tid])]
            rng.shuffle(pool)
            picks = pool[:count]
            for tid, i, m in picks:
                used_mcq_ids.add((tid, i))
                item = dict(m)
                item.setdefault("topic_id", tid)
                mcq_section.append(item)

        frq_section: list[dict] = []
        for arche in ARCHETYPE_ORDER:
            items = list(frq_bank.get(arche, []))
            if not items:
                continue
            f = dict(rng.choice(items))
            f.setdefault("archetype", arche)
            f.setdefault("topic_id", ARCHETYPE_TOPIC.get(arche))
            frq_section.append(f)

        out = {
            "label": f"Synthetic Practice Test {test_idx}",
            "source": "synthetic",
            "format": "new-2025-26-ced",
            "based_on": "Princeton Review 2025 practice tests (same 42-MCQ + 4-FRQ structure)",
            "mcq_section": mcq_section,
            "frq_section": frq_section,
        }
        (TESTS_SYNTH / f"test_{test_idx}.json").write_text(json.dumps(out, indent=2))
        n_built += 1

    print(f"  practice_tests/synthetic: built {n_built} exams from bank "
          f"({sum(len(v) for v in mcq_bank.values())} MCQs, "
          f"{sum(len(v) for v in frq_bank.values())} FRQs)")
    return n_built


def main() -> None:
    print("[publish] writing canonical layout under data/...")
    _publish_mcqs()
    _publish_frqs()
    _publish_official_tests()
    _build_synthetic_tests()
    print("[publish] done.")
    print("\nlayout:")
    for p in sorted(DATA.iterdir()):
        if p.is_dir() and p.name in ("mcqs", "frqs", "practice_tests"):
            count = sum(1 for _ in p.rglob("*.json"))
            print(f"  data/{p.name}/  ({count} JSON files)")


if __name__ == "__main__":
    main()
