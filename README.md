# APCSA Prep

APCSA practice app and content-generation pipeline.

## Contents

- `app/`: Next.js practice app.
- `app/data/apcsa.db`: app-ready SQLite dataset.
- `pipeline/`: Python pipeline for parsing, generating, validating, auditing, and publishing question data.
- `pipeline/data/`: generated and validated MCQ/FRQ JSON, practice tests, source-derived metadata, and pipeline SQLite database.
- `pipeline/reports/`: quality, coverage, and final build audits.
- `pipeline/prompts/`: prompts used by the generation and validation stages.
- `sources/`: local notes used by the pipeline.

## Local Setup

Run the app:

```bash
cd app
npm install
npm run dev
```

Run pipeline tooling:

```bash
cd pipeline
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
make
```

## Data Notes

The share package includes the project datasets, generated JSON, audit reports, prompts, notes, and checkpointed SQLite databases.

Rebuildable dependency folders and build caches are intentionally excluded: `node_modules`, `.next`, `.venv`, Python bytecode caches, and TypeScript build metadata.

The original third-party EPUB source is intentionally not redistributed. If you rerun source parsing stages, provide your own legally obtained source material.
