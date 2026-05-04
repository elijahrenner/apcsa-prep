"""Pydantic schemas for items that flow through the pipeline."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Topic(BaseModel):
    id: str                  # e.g. "u1_strings"
    unit: int                # 1..4
    section: str             # e.g. "1.15"
    name: str                # e.g. "Strings"
    notes_excerpt: str       # the slice of apcsa_notes.md for this topic


class MCQOption(BaseModel):
    label: Literal["A", "B", "C", "D"]
    text: str


class MCQ(BaseModel):
    id: str | None = None
    topic_id: str
    stem: str
    options: list[MCQOption] = Field(min_length=4, max_length=4)
    answer: Literal["A", "B", "C", "D"]
    explanation: str
    difficulty: int = Field(ge=1, le=5)
    source: Literal["generated", "princeton-2025"] = "generated"


class FRQRubricCriterion(BaseModel):
    point_label: str         # e.g. "Header" / "Loop bounds" / "Return value"
    criterion: str           # what must be present to award the point
    points: int = 1


class FRQ(BaseModel):
    id: str | None = None
    archetype: Literal["methods_control", "class_writing", "arraylist", "array_2d"]
    prompt: str
    parts: list[dict] = Field(default_factory=list)
    reference_solution: str
    rubric: list[FRQRubricCriterion]
    total_points: int
    source: Literal["generated", "princeton-2025"] = "generated"


class PracticeExam(BaseModel):
    exam_id: int
    source: Literal["princeton-2025"] = "princeton-2025"
    mcq_section: list[MCQ]
    frq_section: list[FRQ]
