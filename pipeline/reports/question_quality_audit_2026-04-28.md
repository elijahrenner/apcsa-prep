# Question Quality Audit 2026-04-28

Scope: all loaded app questions in `app/data/apcsa.db`, mirrored `pipeline/data/apcsa.db`, and Princeton practice-test JSON sources.

## Inventory

- Total loaded questions: 1,265
- MCQ generated: 1,079
- MCQ Princeton: 126
- FRQ generated: 48
- FRQ Princeton: 12

## Audit Checks

The audit checked for:

- Missing shared stimulus context in Princeton questions
- MCQ option JSON parse failures
- Wrong MCQ option count
- Invalid MCQ answer keys
- Blank correct options
- Unbalanced code fences
- Smart quotes inside code/options
- Split comment markers such as `/ * missing code * /`
- Spaced method calls from extraction, such as `. equals`
- Soft hyphens inside Java identifiers
- Suspicious short stems with no context
- Suspicious repeated method signatures

## Fixes Applied

- Restored all 12 Princeton shared-stimulus ranges:
  - Test 1: Questions 5-6, 18-20, 29-30, 33-37
  - Test 2: Questions 4-5, 20-22, 32-33, 36-37
  - Test 3: Questions 6-7, 12-13, 18-19, 21-23
- Fixed Constellation, Tile, sorting, Instrument, SalesRep, Car, Performance/Play, PostOffice, DiningRoomSet, insertSort, and Fraction shared context in app DB and JSON.
- Normalized smart quotes in code/options.
- Fixed split comment markers.
- Removed soft hyphens from Java identifiers.
- Fixed `TravelPlan` sample calls from `p1.add(...)` to `p1.addTour(...)`.
- Cleaned the `SeatingChart` random sample output so it no longer shows impossible duplicated output.
- Fixed `PigLatin.convertPhrase` examples to call the zero-argument instance method on constructed objects.
- Clarified `Factors` wording so only the two requested methods are named as student tasks.
- Added missing `schedule` context to `mcq_pr_2_32`.
- Restored labeled I, II, III statements in `mcq_pr_3_20`.
- Corrected the `mcq_pr_3_20` explanation so it matches the source code and Java semantics.

## Current Result

Hard failures remaining: 0

Verified zero instances of:

- Invalid MCQ option JSON
- MCQs with option count other than 4
- Orphan Princeton stems starting with `refer to`
- Split `/ *` comment markers
- Smart quotes in loaded app questions
- Soft hyphens in loaded app questions
- Missing shared-stimulus prefixes for known Princeton ranges

Remaining review-level flags: 14

These are not current blockers. They are deterministic false positives from repeated method names in valid class/API descriptions or short conceptual MCQs that are answerable from their options.

Remaining review-only IDs:

- `frq_pr_1_42`
- `frq_pr_1_44`
- `frq_pr_1_45`
- `frq_pr_2_42`
- `frq_pr_2_44`
- `frq_pr_3_42`
- `frq_pr_3_45`
- `mcq_pr_2_31`
- `mcq_pr_2_32`
- `mcq_pr_2_9`
- `mcq_pr_3_16`
- `mcq_pr_3_19`
- `mcq_pr_3_20`
- `mcq_pr_3_35`

Supporting files:

- Deterministic flags: `pipeline/reports/question_quality_flags_2026-04-28.json`
- Model review trace: `pipeline/reports/question_quality_model_review_2026-04-28.md`
