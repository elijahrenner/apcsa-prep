"""Stage 2  -  synthesize `format_spec.json` from PR 2025 sources.

Two passes:

1. **Core spec**  -  one LLM call producing the parts that need LLM judgment:
   `exam_overview`, `unit_weights`, `frq_archetypes` (with rubric patterns),
   `mcq_stem_patterns`, `distractor_patterns`, `stem_format`, `hard_rules`,
   `removed_from_new_ced`, `added_in_new_ced`. Output is small (~6–10 KB).

2. **topic_alignment**  -  built programmatically from the 53-topic taxonomy.
   Each entry gets the topic name and empty PR-source lists for now (the LLM
   doesn't need to fill these; downstream stages don't depend on them).

The previous version asked the LLM to emit topic_alignment for all 53 topics in
one shot, which blew the output budget and stalled. This split fixes that.
"""
from __future__ import annotations

import asyncio
import json
import random
import statistics
import sys
from datetime import datetime, timezone

from .shared.parse_notes import TOPICS, topic_id
from .shared.paths import (
    FORMAT_SPEC,
    PRINCETON_CHAPTERS,
    PRINCETON_EXAMS,
    PRINCETON_FORMAT_MD,
)
from .shared.sdk_client import SONNET, _extract_json, ask


REQUIRED_ARCHETYPE_IDS = ["methods_control", "class_writing", "arraylist", "array_2d"]


SYSTEM_PROMPT = """You are an expert AP Computer Science A teacher with deep familiarity with the new 2025-26 College Board Course and Exam Description (CED). You will read the Princeton Review 2025 prep book's format/strategy chapters plus a sample of its drills and full practice tests. Your job is to produce a JSON document that codifies the EXACT format that questions on the May 15, 2026 exam follow, so a downstream LLM can generate questions that pass for real ones. Be specific, concrete, and grounded in the source  -  never invent format conventions not visible in the source. Output ONLY the JSON document, with no prose before or after, no markdown fences."""


CORE_SCHEMA_SKELETON = """{
  "schema_version": 1,
  "exam_overview": {
    "mcq_count": 42, "mcq_minutes": 90, "mcq_choices_per_q": 4, "mcq_weight_pct": 55,
    "frq_count": 4, "frq_minutes": 90, "frq_total_points": 25, "frq_weight_pct": 45,
    "calculator_allowed": false,
    "java_quick_reference_methods": ["String.length()", "..."]
  },
  "unit_weights": {"1": [low, high], "2": [low, high], "3": [low, high], "4": [low, high]},
  "frq_archetypes": [
    {
      "id": "methods_control", "name": "Methods and Control Structures",
      "frq_position": 1, "total_points": 7,
      "typical_topics": ["..."],
      "rubric_pattern": [
        {"point_label": "Header / signature", "what_to_award": "..."},
        {"point_label": "Loop bounds", "what_to_award": "..."},
        {"point_label": "...", "what_to_award": "..."}
      ],
      "common_pitfalls": ["..."]
    },
    {"id": "class_writing", "name": "...", "frq_position": 2, "total_points": 7, "typical_topics": ["..."], "rubric_pattern": [{"point_label": "...", "what_to_award": "..."}], "common_pitfalls": ["..."]},
    {"id": "arraylist", "name": "...", "frq_position": 3, "total_points": 5, "typical_topics": ["..."], "rubric_pattern": [{"point_label": "...", "what_to_award": "..."}], "common_pitfalls": ["..."]},
    {"id": "array_2d", "name": "...", "frq_position": 4, "total_points": 6, "typical_topics": ["..."], "rubric_pattern": [{"point_label": "...", "what_to_award": "..."}], "common_pitfalls": ["..."]}
  ],
  "mcq_stem_patterns": [
    {"id": "code_trace_output", "description": "...", "frequency_weight": 0.25, "examples_from_pr": ["exam1.mcq#17"]},
    {"id": "code_trace_value", "description": "...", "frequency_weight": 0.20, "examples_from_pr": ["..."]},
    {"id": "identify_bug", "description": "...", "frequency_weight": 0.10, "examples_from_pr": ["..."]},
    {"id": "vocabulary", "description": "...", "frequency_weight": 0.05, "examples_from_pr": ["..."]},
    {"id": "boolean_short_circuit", "description": "...", "frequency_weight": 0.10, "examples_from_pr": ["..."]}
  ],
  "distractor_patterns": [
    {"id": "off_by_one", "description": "answer based on iterating one too many times", "applicability": ["loops", "arrays"]},
    {"id": "string_index_vs_length", "description": "...", "applicability": ["..."]},
    {"id": "==_vs_equals_strings", "description": "...", "applicability": ["..."]},
    {"id": "int_division_truncation", "description": "...", "applicability": ["..."]},
    {"id": "nextInt_nextLine_buffer", "description": "...", "applicability": ["..."]}
  ],
  "stem_format": {
    "code_block_language": "java",
    "median_stem_chars": <int>,
    "p90_stem_chars": <int>,
    "uses_inline_backticks_for_identifiers": true,
    "options_use_backticks_for_code": true
  },
  "hard_rules": [
    "Exactly 4 options labeled A, B, C, D  -  never 5.",
    "No `extends`, `super`, or `interface` (removed from new CED).",
    "Recursion: trace only, do not require WRITING recursive methods (writing was removed).",
    "No `String.charAt()` (not on the Java Quick Reference)  -  use `substring(i, i+1)`.",
    "Java Quick Reference is the ONLY allowed standard-library surface area.",
    "FRQ 1 = methods/control (7 pts). FRQ 2 = class writing (7 pts). FRQ 3 = ArrayList ONLY, no arrays (5 pts). FRQ 4 = 2D array (6 pts). 25 raw total."
  ],
  "removed_from_new_ced": [
    "Inheritance, polymorphism, abstract classes, interfaces",
    "extends, super, instanceof",
    "Writing recursive methods (tracing still in)"
  ],
  "added_in_new_ced": [
    "Reading text files with File and Scanner",
    "Scanner methods: hasNext, hasNextInt, nextLine, nextInt, nextDouble"
  ]
}"""


def _format_mcq(q: dict, exam_id: int, idx: int) -> str:
    opts = q.get("options", [])
    opts_lines = "\n".join(
        f"      {chr(ord('A') + i)}. {opt}" for i, opt in enumerate(opts)
    )
    return (
        f"  [exam{exam_id}.mcq#{idx}] (answer={q.get('answer')})\n"
        f"    stem: {q.get('stem')}\n"
        f"    options:\n{opts_lines}"
    )


def _format_frq(frq: dict, exam_id: int, idx: int) -> str:
    parts_str = ""
    for part in frq.get("parts", []) or []:
        parts_str += f"\n    PART ({part.get('label')}): {part.get('prompt')}"
    rubric_str = ""
    for crit in frq.get("rubric", []) or []:
        rubric_str += f"\n      {crit.get('point')} {crit.get('criterion')}"
    return (
        f"  [exam{exam_id}.frq#{idx}] total_points={frq.get('total_points')}\n"
        f"    PROMPT: {frq.get('prompt')}"
        f"{parts_str}\n"
        f"    RUBRIC:{rubric_str}"
    )


def _stem_char_stats(exams: list[dict]) -> tuple[int, int]:
    lengths = []
    for e in exams:
        for q in e.get("mcq_section", []):
            lengths.append(len(q.get("stem", "")))
    if not lengths:
        return 0, 0
    lengths.sort()
    median = int(statistics.median(lengths))
    p90 = int(lengths[int(0.9 * (len(lengths) - 1))])
    return median, p90


def build_user_prompt() -> str:
    rng = random.Random(7)
    format_md = PRINCETON_FORMAT_MD.read_text()
    exams = json.loads(PRINCETON_EXAMS.read_text())
    median, p90 = _stem_char_stats(exams)

    all_mcqs: list[tuple[int, int, dict]] = []
    for e in exams:
        for i, q in enumerate(e.get("mcq_section", []), start=1):
            all_mcqs.append((e["exam_id"], i, q))
    sampled_mcqs = rng.sample(all_mcqs, k=min(15, len(all_mcqs)))
    sampled_mcqs.sort(key=lambda t: (t[0], t[1]))

    all_frqs: list[tuple[int, int, dict]] = []
    for e in exams:
        for i, f in enumerate(e.get("frq_section", []), start=1):
            all_frqs.append((e["exam_id"], i, f))

    jqr = """Java Quick Reference (2025-26 CED):
  - String:   length(); substring(int from); substring(int from, int to); indexOf(String s); equals(String other); compareTo(String other); concat (via +)
    NOTE: charAt is NOT included; use substring(i, i+1).
  - Math:     abs(int); abs(double); pow(double, double); sqrt(double); random()
  - Integer:  Integer(int); intValue(); Integer.MIN_VALUE; Integer.MAX_VALUE; Integer.parseInt(String)
  - Double:   Double(double); doubleValue(); Double.parseDouble(String)
  - Object:   equals(Object); toString()
  - ArrayList<E>: size(); add(E); add(int, E); get(int); set(int, E); remove(int); contains(E); indexOf(E)
  - File / Scanner (NEW for 2025-26):
      File: new File(String pathname)
      Scanner: new Scanner(File f); new Scanner(String s); hasNext(); hasNextInt(); hasNextDouble(); next(); nextInt(); nextDouble(); nextLine(); close()"""

    sections: list[str] = []
    sections.append("# JAVA QUICK REFERENCE (allowed surface area)\n" + jqr)
    sections.append("\n# PRINCETON REVIEW FORMAT/STRATEGY CHAPTERS (full text)\n" + format_md)
    sections.append(f"\n# {len(sampled_mcqs)} SAMPLED MCQs from the 3 PR practice exams")
    for exam_id, idx, q in sampled_mcqs:
        sections.append(_format_mcq(q, exam_id, idx))
    sections.append(f"\n# ALL {len(all_frqs)} FRQs (4 per exam × 3 exams)\nThese are critical for rubric_pattern. Note position 1 = methods/control, 2 = class writing, 3 = ArrayList, 4 = 2D array.")
    for exam_id, idx, f in all_frqs:
        sections.append(_format_frq(f, exam_id, idx))
    sections.append(f"\n# STEM-LENGTH STATS\n  median_stem_chars = {median}\n  p90_stem_chars    = {p90}\n  Use these EXACTLY in stem_format.")
    sections.append("\n# OUTPUT CONTRACT\n" + CORE_SCHEMA_SKELETON)
    sections.append(
        "\n# REQUIREMENTS\n"
        "1. Output ONLY valid JSON, no markdown fences, no prose.\n"
        "2. `frq_archetypes` MUST have exactly 4 entries with ids "
        "[methods_control, class_writing, arraylist, array_2d] in that order. "
        "Their total_points must sum to 25 (7+7+5+6).\n"
        "3. Each archetype's `rubric_pattern` ≥ 4 entries  -  ground in the 12 PR FRQ rubrics above.\n"
        "4. `mcq_stem_patterns` ≥ 5 entries; each `examples_from_pr` references the sampled "
        "MCQs above by their `exam{N}.mcq#{IDX}` id.\n"
        "5. `distractor_patterns` ≥ 5 entries.\n"
        "6. `hard_rules` MUST include the 'no extends/super/interface' rule and the "
        "'no String.charAt()' rule explicitly.\n"
        "7. Use the median_stem_chars and p90_stem_chars values from above.\n"
        "8. DO NOT include `topic_alignment`  -  it is built separately. Just emit the keys "
        "shown in the contract."
    )
    return "\n".join(sections)


def build_topic_alignment() -> dict:
    """Programmatic  -  one entry per topic, name only."""
    out = {}
    for unit, section, name in TOPICS:
        out[topic_id(unit, section)] = {
            "name": name,
            "unit": unit,
            "section": section,
            "pr_drill_ids": [],
            "pr_exam_item_refs": [],
            "key_concepts_for_questions": [],
        }
    return out


def verify(spec: dict) -> list[str]:
    errors: list[str] = []
    overview = spec.get("exam_overview") or {}
    if overview.get("mcq_count") != 42:
        errors.append(f"exam_overview.mcq_count must be 42, got {overview.get('mcq_count')!r}")
    if overview.get("frq_count") != 4:
        errors.append(f"exam_overview.frq_count must be 4, got {overview.get('frq_count')!r}")

    archetypes = spec.get("frq_archetypes") or []
    ids = [a.get("id") for a in archetypes]
    if ids != REQUIRED_ARCHETYPE_IDS:
        errors.append(f"frq_archetypes ids must be {REQUIRED_ARCHETYPE_IDS}, got {ids}")
    for a in archetypes:
        rp = a.get("rubric_pattern") or []
        if len(rp) < 4:
            errors.append(f"archetype {a.get('id')!r} rubric_pattern must have ≥4 entries, got {len(rp)}")
    arche_total = sum(int(a.get("total_points", 0) or 0) for a in archetypes)
    if arche_total != 25:
        errors.append(f"frq_archetypes total_points must sum to 25, got {arche_total}")

    if len(spec.get("mcq_stem_patterns") or []) < 5:
        errors.append(f"mcq_stem_patterns must have ≥5 entries, got {len(spec.get('mcq_stem_patterns') or [])}")
    if len(spec.get("distractor_patterns") or []) < 5:
        errors.append(f"distractor_patterns must have ≥5 entries, got {len(spec.get('distractor_patterns') or [])}")

    rules_blob = " ".join(spec.get("hard_rules") or []).lower()
    if "extends" not in rules_blob or "interface" not in rules_blob:
        errors.append("hard_rules must include the 'no extends/super/interface' rule")
    if "charat" not in rules_blob:
        errors.append("hard_rules must include the 'no String.charAt' rule")

    expected = {topic_id(u, s) for u, s, _ in TOPICS}
    actual = set((spec.get("topic_alignment") or {}).keys())
    missing = expected - actual
    if missing:
        errors.append(f"topic_alignment missing {len(missing)} topic ids (programmatic step failed)")

    return errors


async def main_async() -> int:
    print("[stage2] building user prompt...", flush=True)
    user_prompt = build_user_prompt()
    print(f"[stage2] user prompt size: {len(user_prompt):,} chars", flush=True)

    print(f"[stage2] calling {SONNET}...", flush=True)
    raw = await ask(user_prompt, system=SYSTEM_PROMPT, model=SONNET, timeout_s=480.0)
    print(f"[stage2] response size: {len(raw):,} chars", flush=True)

    try:
        spec = _extract_json(raw)
    except json.JSONDecodeError as e:
        print(f"[stage2] FATAL: response did not parse as JSON: {e}", flush=True)
        bad = FORMAT_SPEC.with_suffix(".bad.txt")
        bad.write_text(raw)
        print(f"[stage2] raw response written to {bad}", flush=True)
        return 1

    spec["topic_alignment"] = build_topic_alignment()
    spec["generated_at"] = datetime.now(timezone.utc).isoformat()

    errors = verify(spec)
    if errors:
        print("[stage2] FATAL: verification failed:", flush=True)
        for e in errors:
            print(f"  - {e}", flush=True)
        bad = FORMAT_SPEC.with_suffix(".bad.json")
        bad.write_text(json.dumps(spec, indent=2))
        print(f"[stage2] partial spec written to {bad}", flush=True)
        return 1

    FORMAT_SPEC.parent.mkdir(parents=True, exist_ok=True)
    FORMAT_SPEC.write_text(json.dumps(spec, indent=2))
    size = FORMAT_SPEC.stat().st_size
    print(f"[stage2] OK: wrote {FORMAT_SPEC} ({size:,} bytes)", flush=True)
    return 0


def main() -> None:
    sys.exit(asyncio.run(main_async()))


if __name__ == "__main__":
    main()
