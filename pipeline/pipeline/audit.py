"""Sample random questions from the validated bank for human review.

Usage:
    .venv/bin/python -m pipeline.audit            # 30 MCQs + 4 FRQs
    .venv/bin/python -m pipeline.audit --mcqs 50
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import textwrap
from pathlib import Path

from .shared.paths import VALIDATED_FRQS, VALIDATED_MCQ_DIR


def _format_mcq(q: dict, topic_id: str) -> str:
    out = [f"\n--- {topic_id} (difficulty {q.get('difficulty')}) ---"]
    out.append(textwrap.fill(q["stem"], width=88, replace_whitespace=False))
    for opt in q["options"]:
        marker = "*" if opt["label"] == q["answer"] else " "
        out.append(f"  {marker} {opt['label']}. {opt['text']}")
    out.append(f"  → {q.get('explanation','')}")
    return "\n".join(out)


def _format_frq(f: dict) -> str:
    out = [f"\n=== FRQ ({f.get('archetype')}, {f.get('total_points')} pts) ==="]
    out.append(textwrap.fill(f["prompt"][:600], width=88))
    out.append("\n[reference solution]")
    out.append(textwrap.indent(f["reference_solution"][:800], "    "))
    out.append("\n[rubric]")
    for r in f.get("rubric", []):
        out.append(f"  +{r.get('points',1)} {r.get('point_label','')}: {r.get('criterion','')}")
    return "\n".join(out)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--mcqs", type=int, default=30)
    p.add_argument("--frqs", type=int, default=4)
    args = p.parse_args()

    if not VALIDATED_MCQ_DIR.exists():
        print("no validated_mcqs/  -  run Stages 3 + 4 first", file=sys.stderr)
        sys.exit(1)

    mcqs: list[tuple[str, dict]] = []
    for f in sorted(VALIDATED_MCQ_DIR.glob("*.json")):
        topic_id = f.stem
        for q in json.loads(f.read_text()):
            mcqs.append((topic_id, q))

    print(f"# MCQ AUDIT  -  {args.mcqs} of {len(mcqs)} validated questions")
    sample = random.sample(mcqs, min(args.mcqs, len(mcqs)))
    for tid, q in sample:
        print(_format_mcq(q, tid))

    if VALIDATED_FRQS.exists():
        frqs = json.loads(VALIDATED_FRQS.read_text())
        print(f"\n\n# FRQ AUDIT  -  {args.frqs} of {len(frqs)} validated FRQs")
        for f in random.sample(frqs, min(args.frqs, len(frqs))):
            print(_format_frq(f))


if __name__ == "__main__":
    main()
