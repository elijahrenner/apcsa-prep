# Final Build Audit  -  2026-04-27

## Verdict

Build data is ready.

The published bank is constrained to Princeton Review/book/notes-style AP CSA material. The broad generated topics for `u3_s3_2` Impacts of Computing, `u4_s4_1` Data Ethics, and `u4_s4_17` Ethics of Algorithms were excluded from the app bank because they are not materially represented in the parsed Princeton Review CSA practice tests.

## Published Bank

- MCQs: 50 topic files, 1,079 questions total.
- No published topic has fewer than 12 MCQs.
- Excluded topic files are not present in `data/mcqs`.
- Scope filter found 0 out-of-scope leaks in published MCQs.

Excluded raw/generated topics:

- `u3_s3_2` Impacts of Computing
- `u4_s4_1` Data Ethics
- `u4_s4_17` Ethics of Algorithms

Validated FRQs:

- `methods_control`: 12
- `class_writing`: 12
- `arraylist`: 12
- `array_2d`: 12
- Total: 48

## Practice Tests

Official Princeton-derived tests:

- `data/practice_tests/official/test_1.json`: 42 MCQs, 4 FRQs
- `data/practice_tests/official/test_2.json`: 42 MCQs, 4 FRQs
- `data/practice_tests/official/test_3.json`: 42 MCQs, 4 FRQs

Synthetic tests generated from the cleaned bank:

- `data/practice_tests/synthetic/test_1.json`: 42 MCQs, 4 FRQs
- `data/practice_tests/synthetic/test_2.json`: 42 MCQs, 4 FRQs
- `data/practice_tests/synthetic/test_3.json`: 42 MCQs, 4 FRQs

Each synthetic test has one FRQ per archetype.

## App Load

SQLite DBs were written:

- `pipeline/data/apcsa.db`
- `app/data/apcsa.db`

DB contents:

- 50 topics
- 1,205 MCQs total: 1,079 generated + 126 Princeton official practice-test MCQs
- 60 FRQs total: 48 generated + 12 Princeton official practice-test FRQs
- 3 official practice exams
- 138 official practice-exam items

## Verification Notes

- Stage 3 raw MCQ generation completed: 53 files x 25 = 1,325 raw MCQs.
- Stage 4/5 validation produced the final 1,079 in-scope MCQs.
- Stage 6 raw FRQ generation completed: 48 raw FRQs.
- Stage 7 validated all 48 FRQs after Java runtime execution was skipped because this machine has no working Java runtime.
- Stage 8 loaded the DB and copied it into the app.
- Publish regenerated canonical `data/mcqs`, `data/frqs`, and `data/practice_tests`.

