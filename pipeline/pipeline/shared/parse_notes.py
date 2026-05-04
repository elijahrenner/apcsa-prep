"""Parse /Users/renner/apcsa_notes.md into the 53-topic taxonomy.

The notes file uses `## Unit N` for unit boundaries and `*italic phrase*` lines
as concept headers. We don't need to extract every concept  -  for the topic
taxonomy we only need one entry per CSAwesome 2 section (53 total).

Strategy: the notes file IS organized roughly by section but does not include
section numbers. We pair it with a hard-coded ordered list of (unit, section,
name) tuples taken from the CSAwesome 2 TOC, then for each topic we slice the
notes content corresponding to that topic's concept range. The slicing uses
keyword anchors derived from the topic name.

Output: list[Topic].
"""
from __future__ import annotations

import re
from pathlib import Path

from .schemas import Topic
from .paths import NOTES

# The 53 topics from the new (2025-26) AP CSA CED, as covered by CSAwesome 2.
TOPICS: list[tuple[int, str, str]] = [
    # Unit 1
    (1, "1.1", "Why Programming?"),
    (1, "1.2", "Variables"),
    (1, "1.3", "Expressions and Assignment"),
    (1, "1.4", "Compound Assignment"),
    (1, "1.5", "Casting and Ranges of Variables"),
    (1, "1.6", "Increment / Decrement"),
    (1, "1.7", "APIs and Libraries"),
    (1, "1.8", "Comments"),
    (1, "1.9", "Method Signatures"),
    (1, "1.10", "Calling Class (Static) Methods"),
    (1, "1.11", "The Math Class"),
    (1, "1.12", "Objects: Instances of Classes"),
    (1, "1.13", "Creating and Initializing Objects: Constructors"),
    (1, "1.14", "Calling Instance Methods"),
    (1, "1.15", "Strings"),
    # Unit 2
    (2, "2.1", "If Statements"),
    (2, "2.2", "If/Else Statements"),
    (2, "2.3", "Else If"),
    (2, "2.4", "Comparison Operators"),
    (2, "2.5", "Compound Booleans"),
    (2, "2.6", "Comparing Booleans / De Morgan's"),
    (2, "2.7", "While Loops"),
    (2, "2.8", "For Loops"),
    (2, "2.9", "Loop Algorithms (count, sum, avg, max/min)"),
    (2, "2.10", "Strings and Loops"),
    (2, "2.11", "Nested Loops"),
    (2, "2.12", "Informal Code Analysis (run-time)"),
    # Unit 3
    (3, "3.1", "Abstraction and Program Design"),
    (3, "3.2", "Impacts of Computing"),
    (3, "3.3", "Anatomy of a Class"),
    (3, "3.4", "Constructors"),
    (3, "3.5", "Methods"),
    (3, "3.6", "Method References (call chains, parameter passing)"),
    (3, "3.7", "Static Variables and Methods"),
    (3, "3.8", "Scope and Access"),
    (3, "3.9", "this Keyword"),
    # Unit 4
    (4, "4.1", "Data Ethics"),
    (4, "4.2", "Working with Data Sets"),
    (4, "4.3", "Array Basics"),
    (4, "4.4", "Array Traversal"),
    (4, "4.5", "Array Algorithms"),
    (4, "4.6", "Reading Input Files"),
    (4, "4.7", "Wrapper Classes (Integer, Double)"),
    (4, "4.8", "ArrayLists"),
    (4, "4.9", "ArrayList Traversal"),
    (4, "4.10", "ArrayList Algorithms"),
    (4, "4.11", "2D Arrays"),
    (4, "4.12", "2D Array Traversal"),
    (4, "4.13", "2D Array Algorithms"),
    (4, "4.14", "Searching (linear / binary)"),
    (4, "4.15", "Sorting (selection / insertion / merge)"),
    (4, "4.16", "Recursion (tracing)"),
    (4, "4.17", "Ethics of Algorithms"),
]


def topic_id(unit: int, section: str) -> str:
    """e.g. (1, '1.15') → 'u1_s1_15'."""
    return f"u{unit}_s{section.replace('.', '_')}"


def parse(notes_path: Path = NOTES) -> list[Topic]:
    """Slice the notes file into 53 topic excerpts.

    Strategy: split notes by `## Unit N` headers, then within each unit chunk
    the body across the section names using fuzzy keyword anchoring against the
    CSAwesome topic name. Since the notes are dense and may not perfectly align
    1:1 with topic boundaries, we just hand each topic the full unit chunk
    (small enough  -  Unit 1 is ~300 lines). Stage 3 (generation) doesn't need
    perfect alignment; the topic name itself anchors the question content.
    """
    text = notes_path.read_text()

    unit_chunks: dict[int, str] = {}
    splits = re.split(r"^## Unit (\d+)\s*$", text, flags=re.MULTILINE)
    # splits: [preamble, "1", body1, "2", body2, ...]
    for i in range(1, len(splits), 2):
        unit_chunks[int(splits[i])] = splits[i + 1].strip()

    topics: list[Topic] = []
    for unit, section, name in TOPICS:
        body = unit_chunks.get(unit, "")
        topics.append(
            Topic(
                id=topic_id(unit, section),
                unit=unit,
                section=section,
                name=name,
                notes_excerpt=body,
            )
        )
    return topics


if __name__ == "__main__":
    ts = parse()
    print(f"{len(ts)} topics parsed")
    for t in ts[:5]:
        print(f"  {t.id}  unit={t.unit}  section={t.section}  name={t.name}")
    print("  ...")
    for t in ts[-3:]:
        print(f"  {t.id}  unit={t.unit}  section={t.section}  name={t.name}")
