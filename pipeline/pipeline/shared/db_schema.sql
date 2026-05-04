-- AP CSA prep app  -  SQLite schema. Authoritative source of truth.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS topics (
    id              TEXT PRIMARY KEY,
    unit            INTEGER NOT NULL,
    section         TEXT NOT NULL,
    name            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
    id              TEXT PRIMARY KEY,
    topic_id        TEXT NOT NULL REFERENCES topics(id),
    type            TEXT NOT NULL CHECK (type IN ('mcq', 'frq')),
    archetype       TEXT,                          -- only set for FRQs
    stem            TEXT NOT NULL,
    parts_json      TEXT,                          -- only set for FRQs
    options_json    TEXT,                          -- only set for MCQs
    correct         TEXT,                          -- 'A'..'D' for MCQs
    reference_solution TEXT,                       -- only set for FRQs
    rubric_json     TEXT,                          -- only set for FRQs
    total_points    INTEGER,                       -- only set for FRQs
    explanation     TEXT,
    difficulty      INTEGER,
    source          TEXT NOT NULL DEFAULT 'generated',
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);

CREATE TABLE IF NOT EXISTS practice_exams (
    id              INTEGER PRIMARY KEY,
    source          TEXT NOT NULL,                 -- 'princeton-2025'
    label           TEXT NOT NULL                  -- 'Practice Test 1'
);

CREATE TABLE IF NOT EXISTS practice_exam_items (
    exam_id         INTEGER NOT NULL REFERENCES practice_exams(id),
    seq             INTEGER NOT NULL,
    section         TEXT NOT NULL CHECK (section IN ('mcq', 'frq')),
    question_id     TEXT NOT NULL REFERENCES questions(id),
    PRIMARY KEY (exam_id, seq)
);

CREATE TABLE IF NOT EXISTS attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id     TEXT NOT NULL REFERENCES questions(id),
    user_answer     TEXT,
    correct         INTEGER NOT NULL CHECK (correct IN (0, 1)),
    points_earned   REAL,                          -- for FRQs (raw points)
    time_ms         INTEGER,
    ts              INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_ts ON attempts(ts);

CREATE TABLE IF NOT EXISTS skill (
    topic_id        TEXT PRIMARY KEY REFERENCES topics(id),
    elo             REAL NOT NULL DEFAULT 1200,
    n_seen          INTEGER NOT NULL DEFAULT 0,
    n_correct       INTEGER NOT NULL DEFAULT 0,
    ema_accuracy    REAL NOT NULL DEFAULT 0.5,
    last_seen       INTEGER
);

CREATE TABLE IF NOT EXISTS exams (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT NOT NULL CHECK (type IN ('mcq_full', 'frq_full', 'official')),
    practice_exam_id INTEGER REFERENCES practice_exams(id),
    started_at      INTEGER NOT NULL,
    completed_at    INTEGER,
    raw_score       REAL,
    scaled_score    INTEGER                        -- 1..5
);

CREATE TABLE IF NOT EXISTS exam_items (
    exam_id         INTEGER NOT NULL REFERENCES exams(id),
    seq             INTEGER NOT NULL,
    question_id     TEXT NOT NULL REFERENCES questions(id),
    user_answer     TEXT,                          -- MCQ letter or full FRQ code
    correct         INTEGER,
    points_earned   REAL,
    criteria_json   TEXT,                          -- per-criterion award array (FRQ only)
    feedback        TEXT,                          -- grader's prose feedback (FRQ only)
    PRIMARY KEY (exam_id, seq)
);
