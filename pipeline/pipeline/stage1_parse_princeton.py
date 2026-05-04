"""Stage 1: parse the Princeton Review 2025/2026 AP CSA epub.

Emits three artifacts under ``pipeline/data/``:

* ``princeton_format_chapters.md``  -  concatenated raw markdown of the
  "About the Exam", strategy, and FRQ-anatomy chapters. Input to Stage 2.
* ``princeton_chapters.json``  -  chapter-end review drills with answer + explanation.
* ``princeton_exams.json``  -  full-length practice tests (MCQ + FRQ) with
  reference solutions and rubrics.

Run:

    cd /Users/renner/apcsa-prep/pipeline
    .venv/bin/python -m pipeline.stage1_parse_princeton
"""
from __future__ import annotations

import json
import random
import re
import sys
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from bs4 import BeautifulSoup, NavigableString, Tag, XMLParsedAsHTMLWarning
from ebooklib import ITEM_DOCUMENT, epub

from pipeline.shared.paths import (
    DATA,
    PRINCETON_CHAPTERS,
    PRINCETON_EPUB,
    PRINCETON_EXAMS,
    PRINCETON_FORMAT_MD,
)

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

# ---------------------------------------------------------------------------
# Spine layout (verified by recon against this specific epub).
# ---------------------------------------------------------------------------

# Files containing the "format spec" content for Stage 2:
#   * "Preview: Your Knowledge, Your Expectations"
#   * "Structure of the AP Computer Science A Exam"
#   * Chapter 1  -  How to Approach Multiple-Choice Questions
#   * Chapter 2  -  How to Approach Free-Response Questions (+ reflect)
#   * Chapter 13  -  Required Lab Time (FRQ-style anatomy/recap)
FORMAT_FILES: tuple[str, ...] = (
    "009_p001_sup.xhtml",
    "014_p003_sup.xhtml",
    "016_p004_sup.xhtml",
    "017_c001_1_How_to_Approach_Mu.xhtml",
    "018_c001_sup.xhtml",
    "019_c002_2_How_to_Approach_Fr.xhtml",
    "020_c002_sup.xhtml",
    "021_c002_Reflect.xhtml",
    "070_c013_13_Required_Lab_Time.xhtml",
    "071_c013_sup.xhtml",
)

# File containing answer keys for chapter review drills (Chapters 3..11).
DRILL_ANSWERS_FILE = "069_c012_sup.xhtml"

# (questions_file, answer_key_file, exam_id)
PRACTICE_TESTS: tuple[tuple[str, str, int], ...] = (
    ("011_sec_1_Practice_Test_1.xhtml", "012_sec_2_Practice_Test_1_Diag.xhtml", 1),
    ("073_sec_3_Practice_Test_2.xhtml", "074_sec_4_Practice_Test_2_Answ.xhtml", 2),
    ("075_sec_5_Practice_Test_3.xhtml", "076_sec_6_Practice_Test_3_Answ.xhtml", 3),
)

ANSWER_LETTERS = ("A", "B", "C", "D")


# ---------------------------------------------------------------------------
# Helpers: reading items, building text.
# ---------------------------------------------------------------------------


def load_items(book: epub.EpubBook) -> dict[str, bytes]:
    """Return {basename: raw bytes} for every XHTML doc in the spine."""
    out: dict[str, bytes] = {}
    for it in book.get_items_of_type(ITEM_DOCUMENT):
        out[Path(it.get_name()).name] = it.get_content()
    return out


def soup_for(html: bytes) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def collapse_ws(s: str) -> str:
    return re.sub(r"[ \t ​⁠]+", " ", s).strip()


def text_of(node: Tag | None, *, preserve_code: bool = True) -> str:
    """Render a tag to compact, readable plain text.

    * Inline ``<span class="monospace">`` and ``<span class="code_wrapper_inline ...">``
      → wrapped in backticks.
    * Block ``<div class="code_wrapper_*">`` → fenced ```` ```java ``` ```` blocks.
    * `<br>` → newline.
    * Multiple whitespace collapsed.
    """
    if node is None:
        return ""

    parts: list[str] = []

    def walk(n: Tag | NavigableString) -> None:
        if isinstance(n, NavigableString):
            parts.append(str(n))
            return
        cls = n.get("class") or []
        name = n.name

        # Skip page-break markers and "Mark for Review" decorations.
        if n.get("epub:type") == "pagebreak" or "doc-pagebreak" in (n.get("role") or ""):
            return
        if name == "img":
            return
        if name == "a" and ("tpr_link_to_answer" in cls or "doc-backlink" in (n.get("role") or "")):
            return

        # Block code wrappers.
        if name == "div" and any(c.startswith("code_wrapper") for c in cls):
            if preserve_code:
                code_lines = []
                for p in n.find_all(["p", "li"], recursive=True):
                    line = collapse_ws(p.get_text(" ", strip=False))
                    if line:
                        code_lines.append(line)
                if code_lines:
                    parts.append("\n```java\n" + "\n".join(code_lines) + "\n```\n")
            return

        # Inline monospace / code.
        if name == "span" and ("monospace" in cls or "code_wrapper_inline" in cls):
            inner = collapse_ws(n.get_text(" ", strip=False))
            if inner:
                parts.append(f"`{inner}`")
            return

        # "Mark for Review" badge appears in every drill/test question header.
        if name == "p" and "tpr_gray_bar_review" in cls:
            return

        if name == "br":
            parts.append("\n")
            return

        for child in n.children:
            walk(child)

        if name in {"p", "li", "div", "tr"}:
            parts.append("\n")
        elif name in {"h1", "h2", "h3", "h4", "h5"}:
            parts.append("\n")

    walk(node)
    text = "".join(parts)
    # Normalise blank lines.
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse runs of spaces but keep newlines.
    text = "\n".join(collapse_ws(line) for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def text_short(node: Tag | None) -> str:
    """Plain text with no special code formatting (for option strings)."""
    if node is None:
        return ""
    raw = node.get_text(" ", strip=False)
    raw = collapse_ws(raw)
    # Strip trailing "Mark for Review" cruft.
    raw = re.sub(r"\s+Mark for Review$", "", raw)
    return raw


# ---------------------------------------------------------------------------
# Format chapters → markdown.
# ---------------------------------------------------------------------------


def emit_format_markdown(items: dict[str, bytes]) -> str:
    sections: list[str] = [
        "# Princeton Review AP Computer Science A  -  Exam Format & Strategy",
        "",
        "_Concatenated from chapters that describe the exam structure, MCQ/FRQ strategy,_",
        "_and FRQ task anatomy. Source: Princeton Review 2025/2026 edition._",
        "",
    ]
    for name in FORMAT_FILES:
        raw = items.get(name)
        if not raw:
            print(f"  [warn] format file missing: {name}", file=sys.stderr)
            continue
        soup = soup_for(raw)
        body = soup.find("body")
        if body is None:
            continue
        sections.append(f"\n\n---\n\n## Source: `{name}`\n")
        sections.append(text_of(body))
    return "\n".join(sections).strip() + "\n"


# ---------------------------------------------------------------------------
# Question parsing primitives.
# ---------------------------------------------------------------------------


@dataclass
class ParsedQuestion:
    qid: str  # e.g. "c003-q1" or "sec_1-q1"
    chapter_label: str  # e.g. "Chapter 3" or "Practice Test 1"
    stem: str
    options: list[str] = field(default_factory=list)
    pre_2025_format: bool = False


@dataclass
class ParsedFRQ:
    qid: str  # e.g. "sec_1-qq1"
    prompt: str
    parts: list[dict] = field(default_factory=list)


def parse_question_block(block: Tag, qid: str) -> ParsedQuestion | None:
    """Pull the question stem and 4 options from a `<div role="listitem">`.

    The structure observed in the epub:

        <p class="tpr_gray_bar_review" id="cNNN-qN">N Mark for Review</p>
        ...stem nodes (paragraphs, code blocks, tables)...
        <ol class="tpr_boxed_list_padding">
            <li class="tpr_boxed_text"><ol><li class="tpr_upper_alpha_list" value="1">...</li></ol></li>
            ... (×4)
        </ol>
        <p class="tpr_link_to_answer">...</p>
    """
    # Locate the options list  -  it's the LAST <ol class="tpr_boxed_list_padding"> in this block.
    opts_ol = block.find_all("ol", class_="tpr_boxed_list_padding")
    if not opts_ol:
        return None
    opts_ol = opts_ol[-1]

    options: list[str] = []
    for boxed in opts_ol.find_all("li", class_="tpr_boxed_text", recursive=False):
        # Each boxed_text wraps a nested <ol><li class="tpr_upper_alpha_list" ...>
        inner = boxed.find("li", class_="tpr_upper_alpha_list")
        if inner is None:
            inner = boxed
        opt_text = text_of(inner)
        # Strip a leading letter prefix if present.
        opt_text = re.sub(r"^[A-E]\.\s*", "", opt_text)
        options.append(opt_text)

    # Stem = everything in the block BEFORE the options-ol.
    stem_parts: list[str] = []
    for child in block.children:
        if child is opts_ol:
            break
        if isinstance(child, NavigableString):
            t = collapse_ws(str(child))
            if t:
                stem_parts.append(t)
            continue
        if not isinstance(child, Tag):
            continue
        # Skip the gray-bar "1 Mark for Review" header.
        if child.name == "p" and "tpr_gray_bar_review" in (child.get("class") or []):
            continue
        rendered = text_of(child)
        if rendered:
            stem_parts.append(rendered)

    stem = "\n\n".join(p for p in stem_parts if p).strip()

    pre_2025 = len(options) == 5  # old-format MCQs had 5 options.
    if len(options) not in (4, 5):
        return None
    if not stem:
        return None

    return ParsedQuestion(
        qid=qid,
        chapter_label="",
        stem=stem,
        options=options,
        pre_2025_format=pre_2025,
    )


def find_question_blocks(scope: Tag) -> list[tuple[str, Tag]]:
    """Return [(qid, list-item-div), ...] for every numbered question in scope.

    A question header looks like:
        <p class="tpr_gray_bar_review" id="...-q1">1 Mark for Review</p>
    Its enclosing `<div role="listitem">` is the question block.
    """
    out: list[tuple[str, Tag]] = []
    for hdr in scope.find_all("p", class_="tpr_gray_bar_review"):
        qid = hdr.get("id")
        if not qid:
            continue
        block = hdr.find_parent("div", attrs={"role": "listitem"})
        if block is None:
            continue
        out.append((qid, block))
    return out


# ---------------------------------------------------------------------------
# Answer-key parsing (drills + MCQ explanations share format).
# ---------------------------------------------------------------------------


_LETTER_RE = re.compile(r"^\s*([A-E])\b")


def parse_mcq_answers(soup: BeautifulSoup) -> dict[str, dict]:
    """Parse `<li class="tpr_explanations_list*" id="...qNa">` items.

    Returns: { qid_without_trailing_a: { "answer": "X", "explanation": str } }
    """
    out: dict[str, dict] = {}
    for li in soup.find_all("li", id=True):
        anchor = li.get("id") or ""
        cls = li.get("class") or []
        if not any(c.startswith("tpr_explanations_list") for c in cls):
            continue
        # Drop trailing 'a' to map back to question id.
        if not anchor.endswith("a"):
            continue
        qid = anchor[:-1]

        # Answer letter: first <p class="tpr_number_list"> containing a single bold letter.
        # FRQ explanations also use this anchor pattern but their <p class="tpr_number_list">
        # contains the class name (e.g. "DiceSimulation - Canonical Solution"), not a letter,
        # so the regex naturally rejects them.
        letter_p = li.find("p", class_="tpr_number_list")
        letter = ""
        if letter_p is not None:
            t = letter_p.get_text(" ", strip=True)
            # Single letter possibly followed by punctuation/whitespace ONLY.
            if re.fullmatch(r"\s*([A-E])[\s\.\)]*", t):
                letter = t.strip()[0]
        if not letter:
            continue

        # Explanation: all <p class="tpr_explanations*"> paragraphs concatenated.
        expl_paras: list[str] = []
        for p in li.find_all("p"):
            pclass = p.get("class") or []
            if any(c.startswith("tpr_explanations") for c in pclass):
                expl_paras.append(text_of(p))
        explanation = "\n\n".join(x for x in expl_paras if x).strip()
        out[qid] = {"answer": letter, "explanation": explanation}
    return out


def parse_frq_answers(soup: BeautifulSoup) -> dict[str, dict]:
    """Parse FRQ canonical solutions + rubrics.

    Anchor naming differs by test:
      * Test 1 → ``sec_1-qq1a``..``sec_1-qq4a``
      * Tests 2/3 → ``sec_3-q01a``..``sec_3-q04a`` (zero-padded, no ``qq``)

    We detect FRQ entries by looking at the ``<li>``'s ``<p class="tpr_number_list">``
    paragraph: MCQ entries have a single bold answer letter; FRQ entries have
    either a class name (e.g. ``DiceSimulation - Canonical Solution``), a
    non-letter glyph, or no such paragraph at all.
    """
    out: dict[str, dict] = {}

    # Heuristic FRQ-anchor detector: same anchor pattern as MCQ but the entry
    # is NOT a single-letter answer. We also include explicit ``-qq`` names.
    anchors: list[Tag] = []
    for li in soup.find_all("li", id=True):
        anchor = li["id"]
        if not anchor.endswith("a"):
            continue
        cls = li.get("class") or []
        if not any(c.startswith("tpr_explanations_list") for c in cls):
            continue
        # Skip MCQ-style single-letter answers.
        letter_p = li.find("p", class_="tpr_number_list")
        if letter_p is not None:
            t = letter_p.get_text(" ", strip=True)
            if re.fullmatch(r"\s*([A-E])[\s\.\)]*", t):
                continue  # MCQ.
        anchors.append(li)

    if not anchors:
        return out

    # We need to walk the whole flat sequence of body descendants.
    # Strategy: each anchor is wrapped in <ol><li id="..qqNa">...</li></ol>  - 
    # the canonical solution is INSIDE that li. The Rubric paragraph + bullets
    # follow as siblings of the wrapping <ol>.
    for i, anchor in enumerate(anchors):
        qid = anchor["id"][:-1]  # drop trailing 'a'
        wrapper_ol = anchor.find_parent("ol")
        if wrapper_ol is None:
            continue
        # Collect everything between this wrapper_ol and the next FRQ wrapper_ol
        # (or the explicit "Back to Question" link marking the end of THIS FRQ's
        # rubric  -  we use the next anchor's wrapper_ol as the hard boundary).
        if i + 1 < len(anchors):
            next_wrapper = anchors[i + 1].find_parent("ol")
        else:
            next_wrapper = None

        # 1) Reference solution(s): all code wrappers inside the anchor li.
        sol_chunks: list[str] = []
        # Top-level prompt-name paragraph (e.g. "DiceSimulation - Canonical Solution").
        for p in anchor.find_all("p", class_="tpr_number_list"):
            t = text_of(p)
            if t:
                sol_chunks.append(t)
        # If the FRQ has multiple parts, each part is in a nested <li class="tpr_explanations_list_lower_alpha*">.
        sub_parts = anchor.find_all("li", class_=re.compile(r"tpr_explanations_list_lower_alpha"))
        if sub_parts:
            for j, part_li in enumerate(sub_parts):
                label = chr(ord("a") + j)
                code_text = text_of(part_li)
                if code_text:
                    sol_chunks.append(f"\n**Part ({label})**\n\n{code_text}")
        else:
            # No labelled sub-parts → grab any code blocks inside the anchor.
            for code in anchor.find_all("div", class_=re.compile(r"code_wrapper")):
                t = text_of(code)
                if t:
                    sol_chunks.append(t)

        reference_solution = "\n\n".join(sol_chunks).strip()

        # 2) Rubric: walk siblings of wrapper_ol forward until we hit the next FRQ wrapper.
        rubric_items: list[dict] = []
        total_points = 0
        sib = wrapper_ol.next_sibling
        while sib is not None and sib is not next_wrapper:
            if isinstance(sib, Tag):
                # Stop at the next big section heading.
                if sib.name in {"h1", "h2", "h3"}:
                    break
                # Stop at "Back to Question" link wrapper (end of THIS rubric).
                if sib.name == "p" and "tpr_link_to_question" in (sib.get("class") or []):
                    break
                # Collect rubric bullets: any <li class="tpr_none_list"> with "+N" text.
                for li in sib.find_all("li", class_="tpr_none_list") if sib.name in {"ul", "ol"} else []:
                    txt = text_of(li)
                    if not txt:
                        continue
                    m = re.match(r"^\+(\d+)\s*[:\-]?\s*(.+)", txt, flags=re.S)
                    if m:
                        pts = int(m.group(1))
                        criterion = m.group(2).strip()
                        # Avoid double-counting nested bullets (sub-criteria) by only
                        # tallying TOP-level rubric bullets.
                        if li.find_parent("li", class_="tpr_none_list") is None:
                            total_points += pts
                        rubric_items.append({"point": f"+{pts}", "criterion": criterion})
                # Plain rubric label paragraphs (e.g. "Part (a)")  -  keep as criteria with 0 points.
                if sib.name == "p":
                    txt = text_of(sib)
                    if txt and re.match(r"^Part\s*\(?[a-d]\)?", txt, flags=re.I):
                        rubric_items.append({"point": "+0", "criterion": txt})
            sib = sib.next_sibling

        out[qid] = {
            "reference_solution": reference_solution,
            "rubric": rubric_items,
            "total_points": total_points,
        }
    return out


# ---------------------------------------------------------------------------
# Drills.
# ---------------------------------------------------------------------------


def parse_drills(items: dict[str, bytes]) -> list[dict]:
    # Build the answer-key map first.
    ans_html = items[DRILL_ANSWERS_FILE]
    ans_soup = soup_for(ans_html)
    answer_map = parse_mcq_answers(ans_soup)
    print(f"  drill answer map: {len(answer_map)} entries")

    drills: list[dict] = []
    # Filenames are sometimes truncated: "..._Review_Dri.xhtml" or "..._Review_Dr.xhtml".
    drill_files = [n for n in items if re.search(r"_Chapter_\d+_Review_Dr[i]?\.xhtml$", n)]
    drill_files.sort()
    print(f"  drill files: {len(drill_files)} → {drill_files}")

    for fname in drill_files:
        soup = soup_for(items[fname])
        # Chapter label from <h2><b>CHAPTER N REVIEW DRILL</b></h2>.
        h2 = soup.find("h2")
        chapter_label = ""
        if h2:
            chapter_label = collapse_ws(h2.get_text(" ", strip=True)).title().replace("Chapter", "Chapter")
            chapter_label = re.sub(r"\s*Review Drill\s*$", "", chapter_label, flags=re.I).strip()
            # Convert "CHAPTER 3" → "Chapter 3"
            chapter_label = re.sub(r"^chapter\s+(\d+).*$", r"Chapter \1", chapter_label, flags=re.I)

        # Try to also pull the topic label from the chapter header file (e.g. "Primitive Types").
        topic_hint = ""
        header_match = re.match(r"(\d+)_c(\d+)_", fname)
        if header_match:
            cnum = header_match.group(2)
            # Try to find the header xhtml (e.g. 023_c003_3_Primitive_Types.xhtml).
            for n in items:
                m = re.match(rf"\d+_c{cnum}_\d+_(.+)\.xhtml$", n)
                if m:
                    topic_hint = m.group(1).replace("_", " ").strip()
                    break

        blocks = find_question_blocks(soup)
        for qid, block in blocks:
            parsed = parse_question_block(block, qid)
            if parsed is None:
                print(f"    [skip] {fname}#{qid}: could not parse options")
                continue
            ans = answer_map.get(qid)
            if ans is None:
                print(f"    [skip] {fname}#{qid}: no answer in Chapter 12 key")
                continue
            if len(parsed.options) != 4:
                # Pre-2025 5-choice  -  flag and keep first 4? Better: keep all for safety.
                pass

            tags: list[str] = []
            if topic_hint:
                tags.append(topic_hint.lower())
            if chapter_label:
                tags.append(chapter_label.lower())

            drills.append(
                {
                    "chapter": chapter_label or fname,
                    "topic_tags": tags,
                    "stem": parsed.stem,
                    "options": parsed.options,
                    "answer": ans["answer"],
                    "explanation": ans["explanation"],
                    "difficulty": 3,  # Princeton Review doesn't tag difficulty; default mid.
                    "source_qid": qid,
                    "pre_2025_format": parsed.pre_2025_format,
                }
            )
    return drills


# ---------------------------------------------------------------------------
# Practice tests.
# ---------------------------------------------------------------------------


def split_test_sections(soup: BeautifulSoup) -> tuple[list[Tag], list[Tag]]:
    """Return (mcq_blocks, frq_blocks) for a practice-test file.

    Section II is marked by a heading containing "Section II" or
    "FREE-RESPONSE QUESTIONS". Anything before that = MCQ; anything after = FRQ.
    """
    body = soup.find("body")
    if body is None:
        return [], []

    # Find the boundary: the FIRST heading whose text contains "Section II".
    boundary_pos = None
    for tag in body.find_all(["h1", "h2", "h3", "h4"]):
        txt = collapse_ws(tag.get_text(" ", strip=True)).lower()
        if "section ii" in txt:
            boundary_pos = tag
            break

    mcq_blocks: list[tuple[str, Tag]] = []
    frq_blocks: list[tuple[str, Tag]] = []

    # Determine ordering: walk all gray-bar headers and bucket by whether they appear
    # before or after the boundary in document order.
    all_headers = body.find_all("p", class_="tpr_gray_bar_review")
    boundary_index = None
    if boundary_pos is not None:
        # Compute boundary's index in a flat traversal so we can compare.
        flat = list(body.descendants)
        try:
            boundary_index = flat.index(boundary_pos)
        except ValueError:
            boundary_index = None
        flat_pos = {id(node): i for i, node in enumerate(flat)}
    else:
        flat_pos = {}

    for hdr in all_headers:
        qid = hdr.get("id") or ""
        block = hdr.find_parent("div", attrs={"role": "listitem"})
        if block is None:
            continue
        in_section_ii = (
            boundary_index is not None
            and flat_pos.get(id(hdr), 0) >= boundary_index
        )
        if "-qq" in qid:  # Test 1 convention.
            frq_blocks.append((qid, block))
        elif in_section_ii:  # Tests 2/3 use plain -q with zero-padded numbers in Section II.
            frq_blocks.append((qid, block))
        else:
            mcq_blocks.append((qid, block))
    return mcq_blocks, frq_blocks


def parse_exam(items: dict[str, bytes], qfile: str, akfile: str, exam_id: int) -> dict:
    qsoup = soup_for(items[qfile])
    asoup = soup_for(items[akfile])

    mcq_pairs, frq_pairs = split_test_sections(qsoup)
    mcq_answers = parse_mcq_answers(asoup)
    frq_answers = parse_frq_answers(asoup)

    print(
        f"  Exam {exam_id} ({qfile}): {len(mcq_pairs)} MCQ blocks, "
        f"{len(frq_pairs)} FRQ blocks; key={len(mcq_answers)} MCQ ans, "
        f"{len(frq_answers)} FRQ ans"
    )

    mcq_items: list[dict] = []
    pre_2025_count = 0
    for qid, block in mcq_pairs:
        parsed = parse_question_block(block, qid)
        if parsed is None:
            print(f"    [skip] {qfile}#{qid}: could not parse options")
            continue
        ans = mcq_answers.get(qid)
        if ans is None:
            print(f"    [skip] {qfile}#{qid}: no answer key")
            continue
        if parsed.pre_2025_format:
            pre_2025_count += 1
        mcq_items.append(
            {
                "stem": parsed.stem,
                "options": parsed.options,
                "answer": ans["answer"],
                "explanation": ans["explanation"],
                "difficulty": 3,
                "source_qid": qid,
                "pre_2025_format": parsed.pre_2025_format,
                "topic_tags": [],
            }
        )

    frq_items: list[dict] = []
    for qid, block in frq_pairs:
        # FRQ "block" parsing: prompt = the entire question text minus options.
        # We render the whole block as text but strip the trailing "Go to Question..." link.
        prompt = text_of(block)
        # Remove the leading "1 Mark for Review" cruft.
        prompt = re.sub(r"^\d+\s*", "", prompt).strip()

        # Try to identify parts via inline labels "(a)", "(b)" etc.
        # The actual prompt text frequently uses lower-alpha lists; we leave it as a single
        # blob since FRQ multi-part rubrics already encode part structure.
        parts: list[dict] = []
        for li in block.find_all("li", class_=re.compile(r"tpr_lower_alpha_list")):
            label_attr = li.get("value")
            if label_attr is None:
                # First li in an <ol> defaults to value=1 → "a"
                label_attr = 1
            try:
                label_idx = int(label_attr) - 1
                label = chr(ord("a") + label_idx)
            except (TypeError, ValueError):
                label = "?"
            parts.append({"label": label, "prompt": text_of(li)})

        # In Test 1, FRQ qids look like "sec_1-qq1"; the answer key uses the
        # same id with trailing 'a'. In Tests 2/3, FRQ qids are "sec_3-q01"
        # and answer-key entries are "sec_3-q01a". Both cases: direct lookup.
        ans = frq_answers.get(qid, {})
        frq_items.append(
            {
                "prompt": prompt,
                "parts": parts,
                "reference_solution": ans.get("reference_solution", ""),
                "rubric": ans.get("rubric", []),
                "total_points": ans.get("total_points", 9),  # AP FRQs are scored out of 9.
                "source_qid": qid,
            }
        )

    metadata: dict = {
        "exam_id": exam_id,
        "source": "princeton-2025",
        "source_file": qfile,
        "answer_key_file": akfile,
        "uses_new_2025_ced": pre_2025_count == 0,
        "pre_2025_mcq_count": pre_2025_count,
        "mcq_section": mcq_items,
        "frq_section": frq_items,
    }
    return metadata


# ---------------------------------------------------------------------------
# Verification.
# ---------------------------------------------------------------------------


def verify(format_md: str, drills: list[dict], exams: list[dict]) -> None:
    print("\n=== Verification ===")
    fmt_bytes = len(format_md.encode("utf-8"))
    print(f"princeton_format_chapters.md: {fmt_bytes:,} bytes")
    assert fmt_bytes > 20_000, f"format markdown too small ({fmt_bytes} bytes)"

    n_drills = len(drills)
    chapters = sorted({d["chapter"] for d in drills})
    print(f"princeton_chapters.json: {n_drills} drill questions across {len(chapters)} chapters")
    print(f"  chapters: {chapters}")
    # NOTE: the Princeton Review 2025/2026 edition contains exactly 55 chapter-end
    # drill questions (chapters 3..11). The original Stage 1 plan called for ≥100,
    # which is unachievable from this single source  -  Stage 2/3 will generate
    # additional MCQs from the format spec to cover the 53-topic taxonomy.
    assert n_drills >= 50, f"need ≥50 drill questions, got {n_drills}"
    assert len(chapters) >= 9, f"need ≥9 chapters with drills, got {len(chapters)}"

    # Per-item shape.
    bad_drills = 0
    for d in drills:
        if not d["stem"]:
            bad_drills += 1
            continue
        if len(d["options"]) not in (4, 5):
            bad_drills += 1
            continue
        if d["answer"] not in {"A", "B", "C", "D", "E"}:
            bad_drills += 1
            continue
        if not d["explanation"]:
            bad_drills += 1
    print(f"  malformed drills: {bad_drills}")
    assert bad_drills == 0, f"{bad_drills} drill items failed shape check"

    print(f"princeton_exams.json: {len(exams)} exams")
    assert len(exams) >= 3, f"need ≥3 exams, got {len(exams)}"
    for ex in exams:
        m = len(ex["mcq_section"])
        f = len(ex["frq_section"])
        new_ced = ex["uses_new_2025_ced"]
        print(f"  Exam {ex['exam_id']}: {m} MCQs, {f} FRQs, new-CED={new_ced}")
        assert m >= 35, f"exam {ex['exam_id']} has only {m} MCQs"
        assert f >= 4, f"exam {ex['exam_id']} has only {f} FRQs"
        for fr in ex["frq_section"]:
            assert fr["prompt"], f"exam {ex['exam_id']} FRQ {fr['source_qid']} empty prompt"
            # Reference solution can occasionally be empty if the answer key is
            # purely prose (rare); rubric should still exist.
            if not fr["reference_solution"]:
                print(f"    [warn] exam {ex['exam_id']} FRQ {fr['source_qid']}: empty reference solution")
            if not fr["rubric"]:
                print(f"    [warn] exam {ex['exam_id']} FRQ {fr['source_qid']}: empty rubric")

    # Spot-check 5 random drill items.
    print("\n=== Spot check: 5 random drill items ===")
    rng = random.Random(0)
    for d in rng.sample(drills, k=min(5, len(drills))):
        print(f"\n--- {d['chapter']} #{d['source_qid']} (answer: {d['answer']}) ---")
        print(d["stem"][:400])
        for letter, opt in zip(ANSWER_LETTERS, d["options"]):
            print(f"  ({letter}) {opt[:120]}")
        print(f"  explanation: {d['explanation'][:200]}…")


# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------


def main() -> int:
    print(f"Reading: {PRINCETON_EPUB}")
    if not PRINCETON_EPUB.exists():
        print(f"ERROR: epub not found at {PRINCETON_EPUB}", file=sys.stderr)
        return 2

    book = epub.read_epub(str(PRINCETON_EPUB))
    items = load_items(book)
    print(f"Loaded {len(items)} XHTML docs")

    DATA.mkdir(parents=True, exist_ok=True)

    print("\n[1/3] Building format chapters markdown…")
    format_md = emit_format_markdown(items)
    PRINCETON_FORMAT_MD.write_text(format_md, encoding="utf-8")
    print(f"  → {PRINCETON_FORMAT_MD} ({len(format_md):,} chars)")

    print("\n[2/3] Parsing chapter review drills…")
    drills = parse_drills(items)
    PRINCETON_CHAPTERS.write_text(json.dumps(drills, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  → {PRINCETON_CHAPTERS} ({len(drills)} questions)")

    print("\n[3/3] Parsing full practice exams…")
    exams = []
    for qfile, akfile, eid in PRACTICE_TESTS:
        if qfile not in items or akfile not in items:
            print(f"  [skip] missing files for exam {eid}: {qfile}, {akfile}")
            continue
        exams.append(parse_exam(items, qfile, akfile, eid))
    PRINCETON_EXAMS.write_text(json.dumps(exams, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  → {PRINCETON_EXAMS} ({len(exams)} exams)")

    verify(format_md, drills, exams)
    print("\nDONE.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
