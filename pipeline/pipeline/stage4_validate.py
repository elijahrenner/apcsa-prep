"""Stage 4  -  validate raw MCQ candidates per topic.

Three layers per question:
  A. Deterministic schema / sanity / banned-token checks (no LLM).
  B. Java compile-and-run check for "what prints" style stems (best-effort,
     skipped entirely if `javac` isn't installed).
  C. LLM judge using `prompts/system_mcq_validator.md`.

Survivors of all three layers are written to `data/validated_mcqs/{topic_id}.json`.
If a topic ends up with < 20 survivors, a warning is logged but Stage 4 does
NOT regenerate or re-queue.

Run:
    cd pipeline && .venv/bin/python -m pipeline.stage4_validate
    # or, single topic:
    cd pipeline && .venv/bin/python -m pipeline.stage4_validate u1_s1_15
"""
from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from .shared.paths import PROMPTS, RAW_MCQ_DIR, VALIDATED_MCQ_DIR
from .shared.sdk_client import SONNET, ask_json
from .shared.test_scope import item_is_test_scope

CONCURRENCY = 8
PRINCETON_BACKED_SKIP_LLM_TOPICS = {"u4_s4_2", "u4_s4_6", "u4_s4_16"}

# Banned tokens (CED removals + APIs not on the Java Quick Reference).
BANNED_TOKEN_RE = re.compile(
    r"\b(extends|super|interface|implements|instanceof|abstract|charAt)\b"
)

# Heuristic for "what prints" style questions.
WHAT_PRINTS_RE = re.compile(
    r"\b(what (is )?(printed|the output|prints)|what is the output|what will be printed|"
    r"prints what|output of the (code|program|following))\b",
    re.IGNORECASE,
)
JAVA_FENCE_RE = re.compile(r"```java\s*\n(.*?)```", re.DOTALL)
LITERAL_STRING_RE = re.compile(r'^["“](.*?)["”]$', re.DOTALL)


def _has_banned_tokens(*texts: str) -> str | None:
    for t in texts:
        if not t:
            continue
        m = BANNED_TOKEN_RE.search(t)
        if m:
            return m.group(0)
    return None


def _normalize_option_text(t: str) -> str:
    return " ".join(t.strip().split()).lower()


def schema_check(q: dict) -> str | None:
    """Return None if OK, else a short reason string."""
    if not isinstance(q, dict):
        return "not a dict"
    stem = q.get("stem")
    options = q.get("options")
    answer = q.get("answer")
    explanation = q.get("explanation", "")
    difficulty = q.get("difficulty")

    if not isinstance(stem, str) or not stem.strip():
        return "missing stem"
    if len(stem) > 600:
        return f"stem too long ({len(stem)} chars)"
    if not isinstance(options, list) or len(options) != 4:
        return "must have exactly 4 options"

    labels = []
    texts = []
    for opt in options:
        if not isinstance(opt, dict):
            return "option not a dict"
        lbl = opt.get("label")
        txt = opt.get("text")
        if lbl not in {"A", "B", "C", "D"}:
            return f"bad option label {lbl!r}"
        if not isinstance(txt, str) or not txt.strip():
            return f"empty option text for {lbl}"
        labels.append(lbl)
        texts.append(txt)
    if sorted(labels) != ["A", "B", "C", "D"]:
        return f"option labels not A-D: {labels}"

    norm = [_normalize_option_text(t) for t in texts]
    if len(set(norm)) != 4:
        return "duplicate option texts"

    if answer not in {"A", "B", "C", "D"}:
        return f"bad answer {answer!r}"

    if not isinstance(explanation, str) or not explanation.strip():
        return "missing explanation"

    if not isinstance(difficulty, int) or not (1 <= difficulty <= 5):
        return f"bad difficulty {difficulty!r}"

    hit = _has_banned_tokens(stem, explanation, *texts)
    if hit:
        return f"banned token: {hit}"

    if not item_is_test_scope(q):
        return "outside Princeton practice-test scope"

    return None


# ----- Layer B: javac/java check -----

HAS_JAVAC = shutil.which("javac") is not None
HAS_JAVA = shutil.which("java") is not None
JAVA_AVAILABLE = HAS_JAVAC and HAS_JAVA


def _extract_java_block(stem: str) -> str | None:
    m = JAVA_FENCE_RE.search(stem)
    if not m:
        return None
    return m.group(1).strip()


def _is_complete_class(code: str) -> bool:
    return bool(re.search(r"\bclass\s+\w+\s*\{", code)) and "public static void main" in code


def _wrap_main(code: str) -> str:
    return (
        "public class StemRunner {\n"
        "    public static void main(String[] args) {\n"
        + "\n".join("        " + line for line in code.splitlines())
        + "\n    }\n}\n"
    )


def _detect_class_name(code: str) -> str:
    m = re.search(r"public\s+class\s+(\w+)", code) or re.search(r"\bclass\s+(\w+)", code)
    return m.group(1) if m else "StemRunner"


def _normalize_output(s: str) -> str:
    return s.strip().strip("`").strip()


def _answer_literal(option_text: str) -> str | None:
    """If the option is a literal Java string / int / bool, return its expected stdout form."""
    s = option_text.strip()
    # integer
    if re.fullmatch(r"-?\d+", s):
        return s
    # boolean
    if s in {"true", "false"}:
        return s
    # string literal in quotes
    m = LITERAL_STRING_RE.match(s)
    if m:
        return m.group(1)
    return None


def java_run_check(q: dict) -> str | None:
    """Return None if OK or skipped, else a short failure reason."""
    if not JAVA_AVAILABLE:
        return None  # skipped

    stem = q.get("stem", "")
    if not WHAT_PRINTS_RE.search(stem):
        return None
    code = _extract_java_block(stem)
    if not code:
        return None

    answer_letter = q["answer"]
    answer_text = next(
        (o["text"] for o in q["options"] if o["label"] == answer_letter), None
    )
    if answer_text is None:
        return None
    expected = _answer_literal(answer_text)
    if expected is None:
        return None  # non-literal answer; skip

    src = code if _is_complete_class(code) else _wrap_main(code)
    cls = _detect_class_name(src)

    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / f"{cls}.java"
        path.write_text(src)
        try:
            cp = subprocess.run(
                ["javac", str(path)],
                cwd=d,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except subprocess.TimeoutExpired:
            return None  # don't penalize  -  best-effort
        if cp.returncode != 0:
            return None  # compile failure → can't verify; don't penalize
        try:
            rp = subprocess.run(
                ["java", "-cp", d, cls],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except subprocess.TimeoutExpired:
            return "javac/java run timed out"
        if rp.returncode != 0:
            return None  # runtime failure → can't verify
        actual = _normalize_output(rp.stdout)
        if actual != _normalize_output(expected):
            return f"runtime output {actual!r} != marked answer {expected!r}"
    return None


# ----- Layer C: LLM judge -----

JUDGE_THRESHOLD_AVG = 4.0
JUDGE_THRESHOLD_MIN = 3
JUDGE_AXES = (
    "topic_alignment",
    "ap_style",
    "distractor_quality",
    "clarity_unambiguous",
    "factual_correctness",
)


async def llm_judge(q: dict, system: str, sem: asyncio.Semaphore) -> str | None:
    payload = {
        "topic_id": q.get("topic_id"),
        "stem": q.get("stem"),
        "options": q.get("options"),
        "answer": q.get("answer"),
        "explanation": q.get("explanation"),
        "difficulty": q.get("difficulty"),
    }
    user_prompt = (
        "Evaluate this MCQ candidate.\n\n```json\n"
        + json.dumps(payload, indent=2)
        + "\n```"
    )
    async with sem:
        try:
            data = await ask_json(user_prompt, system=system, model=SONNET, max_turns=1)
        except Exception as e:  # noqa: BLE001
            return f"judge error: {e!r}"

    if not isinstance(data, dict):
        return "judge returned non-object"

    scores = []
    for ax in JUDGE_AXES:
        v = data.get(ax)
        if not isinstance(v, int) or not (1 <= v <= 5):
            return f"judge missing/invalid axis {ax}: {v!r}"
        scores.append(v)
        if v < JUDGE_THRESHOLD_MIN:
            return f"judge {ax}={v} below min ({JUDGE_THRESHOLD_MIN})"
    avg = sum(scores) / len(scores)
    if avg < JUDGE_THRESHOLD_AVG:
        notes = data.get("notes", "")
        return f"judge avg={avg:.2f} below {JUDGE_THRESHOLD_AVG} ({notes})"
    return None


# ----- Driver -----

async def _validate_one(
    q: dict, system: str, sem: asyncio.Semaphore
) -> tuple[bool, str | None]:
    reason = schema_check(q)
    if reason:
        return False, f"schema: {reason}"
    reason = java_run_check(q)
    if reason:
        return False, f"java: {reason}"
    if q.get("topic_id") in PRINCETON_BACKED_SKIP_LLM_TOPICS:
        return True, None
    reason = await llm_judge(q, system, sem)
    if reason:
        return False, reason
    return True, None


async def _validate_topic(
    topic_id: str, raw_path: Path, system: str, sem: asyncio.Semaphore
) -> dict:
    raw = json.loads(raw_path.read_text())
    if not isinstance(raw, list):
        print(f"[ERR ] {topic_id}: raw file is not a list")
        return {"topic_id": topic_id, "kept": 0, "dropped": 0}

    tasks = [_validate_one(q, system, sem) for q in raw]
    results = await asyncio.gather(*tasks)

    survivors: list[dict] = []
    drop_reasons: list[str] = []
    for q, (ok, reason) in zip(raw, results):
        if ok:
            survivors.append(q)
        else:
            drop_reasons.append(reason or "")

    out_path = VALIDATED_MCQ_DIR / f"{topic_id}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(survivors, indent=2))

    if len(survivors) < 20:
        print(
            f"[WARN] {topic_id}: only {len(survivors)} survivors "
            f"(< 20). re-run stage 3 for this topic and re-validate."
        )
    print(
        f"[ok  ] {topic_id}: kept={len(survivors)} dropped={len(drop_reasons)}"
    )
    # show first few drop reasons for visibility
    for r in drop_reasons[:3]:
        print(f"        - {r}")
    if len(drop_reasons) > 3:
        print(f"        ... +{len(drop_reasons) - 3} more")

    return {
        "topic_id": topic_id,
        "kept": len(survivors),
        "dropped": len(drop_reasons),
    }


async def _main_async(only_topic: str | None = None) -> None:
    if not JAVA_AVAILABLE:
        print(
            "[stage4] WARNING: javac/java not on PATH  -  Layer B "
            "(compile-and-run check) will be SKIPPED for all questions."
        )

    system = (PROMPTS / "system_mcq_validator.md").read_text()

    raw_files = sorted(RAW_MCQ_DIR.glob("*.json"))
    if only_topic:
        raw_files = [p for p in raw_files if p.stem == only_topic]
        if not raw_files:
            print(f"[stage4] no raw file for topic {only_topic!r} in {RAW_MCQ_DIR}")
            return

    sem = asyncio.Semaphore(CONCURRENCY)
    summaries = []
    for path in raw_files:
        topic_id = path.stem
        summaries.append(await _validate_topic(topic_id, path, system, sem))

    total_kept = sum(s["kept"] for s in summaries)
    total_dropped = sum(s["dropped"] for s in summaries)
    under = [s["topic_id"] for s in summaries if s["kept"] < 20]
    print(
        f"\nstage 4 done. topics={len(summaries)} kept={total_kept} "
        f"dropped={total_dropped} under_quota={len(under)}"
    )
    if under:
        print(f"  under-quota topics: {under}")


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(_main_async(only))


if __name__ == "__main__":
    main()
