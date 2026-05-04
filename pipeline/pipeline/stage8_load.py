"""Stage 8  -  Load validated MCQs + FRQs + parsed PR practice exams into SQLite.

Pure Python; no LLM calls. Idempotent  -  drops + recreates `apcsa.db`.
After it runs, copies the DB into the Next.js app at app/data/apcsa.db.
"""
from __future__ import annotations

import json
import shutil
import sqlite3
import uuid
from pathlib import Path

from .shared.parse_notes import parse as parse_topics, topic_id as make_topic_id, TOPICS
from .shared.paths import (
    DATA, DB_PATH, PRINCETON_EXAMS, REPO,
    VALIDATED_FRQS, VALIDATED_MCQ_DIR,
)
from .shared.test_scope import in_test_scope_topic, item_is_test_scope

SCHEMA_SQL = (Path(__file__).parent / "shared" / "db_schema.sql").read_text()
APP_DB = Path.home() / "apcsa-prep" / "app" / "data" / "apcsa.db"
FRQ_ARCHETYPE_ORDER = ["methods_control", "class_writing", "arraylist", "array_2d"]


def main() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    DATA.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQL)

    # 1. topics
    topics = [t for t in parse_topics() if in_test_scope_topic(t.id)]
    conn.executemany(
        "INSERT INTO topics (id, unit, section, name) VALUES (?, ?, ?, ?)",
        [(t.id, t.unit, t.section, t.name) for t in topics],
    )
    conn.executemany(
        "INSERT INTO skill (topic_id) VALUES (?)",
        [(t.id,) for t in topics],
    )

    # 2. validated MCQs
    mcq_count = 0
    if VALIDATED_MCQ_DIR.exists():
        for f in sorted(VALIDATED_MCQ_DIR.glob("*.json")):
            for mcq in json.loads(f.read_text()):
                if not item_is_test_scope(mcq):
                    continue
                qid = mcq.get("id") or f"mcq_{uuid.uuid4().hex[:12]}"
                conn.execute(
                    """INSERT INTO questions
                       (id, topic_id, type, stem, options_json, correct,
                        explanation, difficulty, source)
                       VALUES (?, ?, 'mcq', ?, ?, ?, ?, ?, ?)""",
                    (
                        qid, mcq["topic_id"], mcq["stem"],
                        json.dumps(mcq["options"]),
                        mcq["answer"],
                        mcq.get("explanation", ""),
                        mcq.get("difficulty", 3),
                        mcq.get("source", "generated"),
                    ),
                )
                mcq_count += 1

    # 3. validated FRQs
    frq_count = 0
    if VALIDATED_FRQS.exists():
        for frq in json.loads(VALIDATED_FRQS.read_text()):
            qid = frq.get("id") or f"frq_{uuid.uuid4().hex[:12]}"
            conn.execute(
                """INSERT INTO questions
                   (id, topic_id, type, archetype, stem, parts_json,
                    reference_solution, rubric_json, total_points, source)
                   VALUES (?, ?, 'frq', ?, ?, ?, ?, ?, ?, ?)""",
                (
                    qid,
                    frq.get("topic_id", _archetype_to_topic(frq["archetype"])),
                    frq["archetype"], frq["prompt"],
                    json.dumps(frq.get("parts", [])),
                    frq["reference_solution"],
                    json.dumps(frq["rubric"]),
                    frq["total_points"],
                    frq.get("source", "generated"),
                ),
            )
            frq_count += 1

    # 4. PR practice exams
    exam_count = 0
    if PRINCETON_EXAMS.exists():
        exams = json.loads(PRINCETON_EXAMS.read_text())
        for exam in exams:
            cur = conn.execute(
                "INSERT INTO practice_exams (source, label) VALUES (?, ?)",
                (exam["source"], f"Practice Test {exam['exam_id']}"),
            )
            db_exam_id = cur.lastrowid
            seq = 0
            for it in exam.get("mcq_section", []):
                qid = f"mcq_pr_{db_exam_id}_{seq}"
                conn.execute(
                    """INSERT INTO questions
                       (id, topic_id, type, stem, options_json, correct,
                        explanation, difficulty, source)
                       VALUES (?, ?, 'mcq', ?, ?, ?, ?, ?, 'princeton-2025')""",
                    (
                        qid,
                        it.get("topic_id", topics[0].id),
                        it["stem"],
                        json.dumps(it["options"]),
                        it["answer"],
                        it.get("explanation", ""),
                        it.get("difficulty", 3),
                    ),
                )
                conn.execute(
                    """INSERT INTO practice_exam_items (exam_id, seq, section, question_id)
                       VALUES (?, ?, 'mcq', ?)""",
                    (db_exam_id, seq, qid),
                )
                seq += 1
            for frq_idx, it in enumerate(exam.get("frq_section", [])):
                qid = f"frq_pr_{db_exam_id}_{seq}"
                archetype = it.get("archetype") or FRQ_ARCHETYPE_ORDER[min(frq_idx, len(FRQ_ARCHETYPE_ORDER) - 1)]
                conn.execute(
                    """INSERT INTO questions
                       (id, topic_id, type, archetype, stem, parts_json,
                        reference_solution, rubric_json, total_points, source)
                       VALUES (?, ?, 'frq', ?, ?, ?, ?, ?, ?, 'princeton-2025')""",
                    (
                        qid,
                        it.get("topic_id", _archetype_to_topic(archetype)),
                        archetype,
                        it["prompt"],
                        json.dumps(it.get("parts", [])),
                        it.get("reference_solution", ""),
                        json.dumps(it.get("rubric", [])),
                        it.get("total_points", 7),
                    ),
                )
                conn.execute(
                    """INSERT INTO practice_exam_items (exam_id, seq, section, question_id)
                       VALUES (?, ?, 'frq', ?)""",
                    (db_exam_id, seq, qid),
                )
                seq += 1
            exam_count += 1

    conn.commit()
    conn.close()

    APP_DB.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(DB_PATH, APP_DB)

    print(f"loaded {len(topics)} topics, {mcq_count} MCQs, {frq_count} FRQs, "
          f"{exam_count} practice exams → {DB_PATH}")
    print(f"copied to {APP_DB}")


def _archetype_to_topic(archetype: str) -> str:
    mapping = {
        "methods_control": make_topic_id(2, "2.8"),
        "class_writing":   make_topic_id(3, "3.4"),
        "arraylist":       make_topic_id(4, "4.10"),
        "array_2d":        make_topic_id(4, "4.13"),
    }
    return mapping.get(archetype, make_topic_id(4, "4.5"))


if __name__ == "__main__":
    main()
