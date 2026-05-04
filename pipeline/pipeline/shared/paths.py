from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[2]   # …/apcsa-prep/pipeline
REPO = PIPELINE_ROOT.parent                            # …/apcsa-prep
DATA = PIPELINE_ROOT / "data"
PROMPTS = PIPELINE_ROOT / "prompts"
SOURCES = REPO / "sources"

NOTES = SOURCES / "apcsa_notes.md"

_PRINCETON_EPUB_CANDIDATES = (
    SOURCES / "princeton_review_2025.epub",
    PIPELINE_ROOT / "Princeton Review AP Computer Science a Premium Prep_ For the -- The Princeton Review -- 2025 -- Random House Children's Books -- f4a4c6759cf2ba1ea372aa03e1a17a71 -- Anna’s Archive.epub",
)
PRINCETON_EPUB = next(
    (path for path in _PRINCETON_EPUB_CANDIDATES if path.exists()),
    _PRINCETON_EPUB_CANDIDATES[0],
)

PRINCETON_CHAPTERS = DATA / "princeton_chapters.json"
PRINCETON_EXAMS = DATA / "princeton_exams.json"
PRINCETON_FORMAT_MD = DATA / "princeton_format_chapters.md"
FORMAT_SPEC = DATA / "format_spec.json"
RAW_MCQ_DIR = DATA / "raw_mcqs"
VALIDATED_MCQ_DIR = DATA / "validated_mcqs"
RAW_FRQ_DIR = DATA / "raw_frqs"
VALIDATED_FRQS = DATA / "validated_frqs.json"
DB_PATH = DATA / "apcsa.db"
