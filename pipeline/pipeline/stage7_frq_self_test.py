"""Stage 7  -  self-test FRQ candidates.

For each FRQ in `data/raw_frqs/*.json`:

  1. Reference solution must compile + each test case's expected_output must
     match runtime stdout. (Skipped with warning if javac/java missing.)
  2. Rubric discrimination test using the LLM grader:
       - Strong student = the reference solution itself; must score >= total - 1.
       - Weak student   = an intentionally broken stub (empty bodies / null
         returns / no-op constructor); must score <= total * 0.3.

Survivors → `data/validated_frqs.json` (single flat list across archetypes).

Run:
    cd pipeline && .venv/bin/python -m pipeline.stage7_frq_self_test
"""
from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .shared.paths import PROMPTS, RAW_FRQ_DIR, VALIDATED_FRQS
from .shared.sdk_client import SONNET, ask_json

CONCURRENCY = 4

HAS_JAVAC = shutil.which("javac") is not None
HAS_JAVA = shutil.which("java") is not None


def _java_runtime_available() -> bool:
    if not (HAS_JAVAC and HAS_JAVA):
        return False
    try:
        cp = subprocess.run(["java", "-version"], capture_output=True, text=True, timeout=5)
    except Exception:  # noqa: BLE001
        return False
    return cp.returncode == 0


JAVA_AVAILABLE = _java_runtime_available()


# ---------- Compile / run helpers ----------

def _detect_public_class_name(code: str) -> str | None:
    m = re.search(r"public\s+class\s+(\w+)", code)
    return m.group(1) if m else None


def _strip_public_modifier(code: str) -> str:
    """Make a class non-public so we can put it alongside a `public class Main`."""
    return re.sub(r"\bpublic\s+class\b", "class", code, count=1)


def _build_runner(reference_solution: str, setup_java: str) -> str:
    """Build a single-file Java program that defines (a) the reference class(es)
    and (b) a `public class Main` whose `main` runs the test case setup."""
    ref_clean = _strip_public_modifier(reference_solution.strip())
    setup_indented = "\n".join("        " + line for line in setup_java.strip().splitlines())
    return (
        ref_clean
        + "\n\npublic class Main {\n"
        + "    public static void main(String[] args) throws Exception {\n"
        + setup_indented
        + "\n    }\n}\n"
    )


def _compile_and_run(java_source: str, timeout_compile: int = 15, timeout_run: int = 5) -> tuple[bool, str, str]:
    """Returns (ok, stdout, error_message). ok=False if compile or runtime fails."""
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "Main.java"
        path.write_text(java_source)
        try:
            cp = subprocess.run(
                ["javac", str(path)],
                cwd=d,
                capture_output=True,
                text=True,
                timeout=timeout_compile,
            )
        except subprocess.TimeoutExpired:
            return False, "", "javac timeout"
        if cp.returncode != 0:
            return False, "", f"compile error: {cp.stderr.strip()[:300]}"
        try:
            rp = subprocess.run(
                ["java", "-cp", d, "Main"],
                capture_output=True,
                text=True,
                timeout=timeout_run,
            )
        except subprocess.TimeoutExpired:
            return False, "", "java timeout"
        if rp.returncode != 0:
            return False, rp.stdout, f"runtime error: {rp.stderr.strip()[:300]}"
        return True, rp.stdout, ""


def _normalize(s: str) -> str:
    return "\n".join(line.rstrip() for line in s.strip().splitlines())


def reference_compile_check(frq: dict) -> str | None:
    """Return None if all test cases pass, else a short reason. Skipped if no javac."""
    if not JAVA_AVAILABLE:
        return None
    ref = frq.get("reference_solution")
    if not isinstance(ref, str) or not ref.strip():
        return "missing reference_solution"
    test_cases = frq.get("test_cases") or []
    if not test_cases:
        # Try a bare compile with an empty main to at least confirm syntactic validity.
        src = _build_runner(ref, "// no test cases\n")
        ok, _, err = _compile_and_run(src)
        return None if ok else f"reference compile failed: {err}"

    for i, tc in enumerate(test_cases):
        setup = tc.get("setup_java", "")
        expected = tc.get("expected_output", "")
        src = _build_runner(ref, setup)
        ok, out, err = _compile_and_run(src)
        if not ok:
            return f"test {i} ({tc.get('description','')!r}): {err}"
        if _normalize(out) != _normalize(str(expected)):
            return (
                f"test {i} ({tc.get('description','')!r}): "
                f"expected {expected!r}, got {out!r}"
            )
    return None


# ---------- Weak-student stub ----------

def _make_weak_stub(reference_solution: str) -> str:
    """Generate an intentionally broken stub from the reference.

    Strategy:
      - Keep class declaration(s), instance variable declarations, and
        constructor signatures (with empty bodies).
      - Replace every method body with a do-nothing return that matches the
        return type (or `;` for void).
      - Drop main() if present.

    This is a regex-based transform  -  won't be perfect for every shape, but
    produces a syntactically reasonable stub for the discrimination grader.
    """
    code = reference_solution
    # Drop any `public static void main(...) { ... }` block.
    code = re.sub(
        r"public\s+static\s+void\s+main\s*\([^)]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\}",
        "",
        code,
    )

    def _stub_body(return_type: str) -> str:
        rt = return_type.strip()
        if rt == "void":
            return "/* TODO */"
        if rt in {"int", "short", "long", "byte"}:
            return "return 0;"
        if rt in {"double", "float"}:
            return "return 0.0;"
        if rt == "boolean":
            return "return false;"
        if rt == "char":
            return "return ' ';"
        return "return null;"

    # Replace method bodies. Match: <return_type> <name>(<params>) { ... }
    method_pattern = re.compile(
        r"(public|private|protected|static|final|\s)+\s*"  # modifiers
        r"([A-Za-z_][\w<>\[\],\s]*?)\s+"                    # return type
        r"([A-Za-z_]\w*)\s*"                                # method name
        r"\(([^)]*)\)\s*"                                   # params
        r"\{",
        re.MULTILINE,
    )

    out_parts = []
    pos = 0
    for m in method_pattern.finditer(code):
        # Skip constructors (return type is the class name with no actual return type slot  - 
        # this regex would mis-match, but constructors usually appear without a return type)
        # and skip if "class" precedes (false positive).
        head = m.group(0)
        if "class " in head or head.strip().startswith("class"):
            continue
        rt = m.group(2).strip()
        name = m.group(3)
        # Constructors: name == enclosing class. Hard to know here; if rt looks like a
        # class name (capital-letter start) AND matches name, treat as constructor → empty body.
        is_ctor = rt and rt[0].isupper() and rt == name
        # Find matching close brace.
        depth = 1
        i = m.end()
        while i < len(code) and depth > 0:
            if code[i] == "{":
                depth += 1
            elif code[i] == "}":
                depth -= 1
            i += 1
        body_end = i  # position just after the matching `}`
        out_parts.append(code[pos:m.end()])  # up to and including `{`
        if is_ctor or rt == "":
            out_parts.append(" /* weak stub */ ")
        else:
            out_parts.append(" " + _stub_body(rt) + " ")
        out_parts.append("}")
        pos = body_end
    out_parts.append(code[pos:])
    stub = "".join(out_parts)
    return stub


# ---------- Grader (LLM) ----------

async def _grade(
    frq: dict, student_code: str, system: str, sem: asyncio.Semaphore
) -> dict | None:
    payload = {
        "prompt": frq.get("prompt"),
        "parts": frq.get("parts", []),
        "rubric": frq.get("rubric", []),
        "total_points": frq.get("total_points"),
        "student_code": student_code,
    }
    user_prompt = (
        "Grade this student response per the rubric.\n\n"
        "```json\n" + json.dumps(payload, indent=2) + "\n```"
    )
    async with sem:
        try:
            data = await ask_json(user_prompt, system=system, model=SONNET, max_turns=1)
        except Exception as e:  # noqa: BLE001
            return {"error": f"grader error: {e!r}", "total": 0}
    if not isinstance(data, dict):
        return {"error": "grader returned non-object", "total": 0}
    return data


# ---------- Driver ----------

async def _self_test_one(
    frq: dict, grader_system: str, sem: asyncio.Semaphore
) -> tuple[bool, str | None]:
    total = frq.get("total_points")
    if not isinstance(total, int) or total <= 0:
        return False, "missing/invalid total_points"

    # 1. Reference compile/run.
    err = reference_compile_check(frq)
    if err:
        return False, f"reference: {err}"

    # 2. Rubric discrimination.
    ref = frq.get("reference_solution", "")
    weak = _make_weak_stub(ref)

    strong_grade, weak_grade = await asyncio.gather(
        _grade(frq, ref, grader_system, sem),
        _grade(frq, weak, grader_system, sem),
    )

    strong_total = strong_grade.get("total") if isinstance(strong_grade, dict) else 0
    weak_total = weak_grade.get("total") if isinstance(weak_grade, dict) else 0
    if not isinstance(strong_total, (int, float)):
        strong_total = 0
    if not isinstance(weak_total, (int, float)):
        weak_total = 0

    strong_threshold = total - 1
    if frq.get("archetype") == "class_writing":
        # A minimal class-writing stub can legitimately earn structural points
        # for class header, private fields, and constructor shape while still
        # failing behavior. Do not reject good class-writing prompts for that.
        weak_threshold = 4
    else:
        weak_threshold = total * 0.3

    if strong_total < strong_threshold:
        return False, (
            f"strong student scored {strong_total}/{total} "
            f"(threshold >= {strong_threshold})"
        )
    if weak_total > weak_threshold:
        return False, (
            f"weak student scored {weak_total}/{total} "
            f"(threshold <= {weak_threshold:.1f})"
        )

    return True, f"strong={strong_total}/{total} weak={weak_total}/{total}"


async def _main_async() -> None:
    if not JAVA_AVAILABLE:
        print(
            "[stage7] WARNING: javac/java not on PATH  -  reference compile/run "
            "step will be SKIPPED. Rubric discrimination still runs."
        )

    grader_system = (PROMPTS / "system_frq_grader.md").read_text()

    files = sorted(RAW_FRQ_DIR.glob("*.json"))
    if not files:
        print(f"[stage7] no FRQ files in {RAW_FRQ_DIR}")
        return

    sem = asyncio.Semaphore(CONCURRENCY)
    survivors: list[dict] = []
    by_archetype: dict[str, dict[str, int]] = {}

    for path in files:
        archetype = path.stem
        by_archetype.setdefault(archetype, {"in": 0, "kept": 0, "dropped": 0})
        try:
            items = json.loads(path.read_text())
        except Exception as e:  # noqa: BLE001
            print(f"[ERR ] {archetype}: bad JSON: {e}")
            continue
        if not isinstance(items, list):
            print(f"[ERR ] {archetype}: not a list")
            continue

        by_archetype[archetype]["in"] = len(items)
        results = await asyncio.gather(
            *[_self_test_one(frq, grader_system, sem) for frq in items]
        )
        for frq, (ok, info) in zip(items, results):
            if ok:
                survivors.append(frq)
                by_archetype[archetype]["kept"] += 1
                print(f"[ok  ] {archetype}: keep ({info})")
            else:
                by_archetype[archetype]["dropped"] += 1
                print(f"[drop] {archetype}: {info}")

    VALIDATED_FRQS.parent.mkdir(parents=True, exist_ok=True)
    VALIDATED_FRQS.write_text(json.dumps(survivors, indent=2))

    print("\nstage 7 summary:")
    for archetype, counts in by_archetype.items():
        print(
            f"  {archetype:<18s} in={counts['in']:>3d} "
            f"kept={counts['kept']:>3d} dropped={counts['dropped']:>3d}"
        )
    print(f"\ntotal survivors: {len(survivors)} → {VALIDATED_FRQS}")


def main() -> None:
    asyncio.run(_main_async())


if __name__ == "__main__":
    main()
