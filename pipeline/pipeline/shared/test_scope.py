"""Scope rules for the local Princeton Review-focused question bank."""

from __future__ import annotations

import re
from collections.abc import Iterable

# These broader-current-CED topics are not materially represented in the parsed
# Princeton Review CSA practice tests, so they stay out of the app bank.
EXCLUDED_TOPIC_IDS = frozenset({
    "u3_s3_2",   # Impacts of Computing
    "u4_s4_1",   # Data Ethics
    "u4_s4_17",  # Ethics of Algorithms
})

EXCLUDED_TEXT_RE = re.compile(
    r"\b("
    r"algorithmic bias|biased training data|training data|fairness|unfair|"
    r"data quality|incomplete data|inaccurate data|off-topic data|"
    r"privacy|consent|legal|ethical|ethics|social impact|society|culture|"
    r"responsible computing|inclusive|intellectual property"
    r")\b",
    re.IGNORECASE,
)


def in_test_scope_topic(topic_id: str | None) -> bool:
    return bool(topic_id) and topic_id not in EXCLUDED_TOPIC_IDS


def text_is_test_scope(texts: Iterable[str]) -> bool:
    return not EXCLUDED_TEXT_RE.search("\n".join(t for t in texts if t))


def item_is_test_scope(item: dict) -> bool:
    if not in_test_scope_topic(item.get("topic_id")):
        return False

    texts = [item.get("stem", ""), item.get("explanation", ""), item.get("prompt", "")]
    for opt in item.get("options", []) or []:
        if isinstance(opt, dict):
            texts.append(opt.get("text", ""))
        elif isinstance(opt, str):
            texts.append(opt)
    return text_is_test_scope(texts)
