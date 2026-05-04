# AP CSA Pipeline Coverage Audit  -  2026-04-27

## Source Materials

- AP CSA notes: `sources/apcsa_notes.md`
- Princeton Review EPUB: `pipeline/Princeton Review AP Computer Science a Premium Prep_ For the -- The Princeton Review -- 2025 -- Random House Children's Books -- f4a4c6759cf2ba1ea372aa03e1a17a71 -- Anna’s Archive.epub`
- Parsed Princeton artifacts:
  - `pipeline/data/princeton_format_chapters.md`
  - `pipeline/data/princeton_chapters.json`
  - `pipeline/data/princeton_exams.json`
- Practice tests in the working corpus:
  - `pipeline/data/practice_tests/official/test_1.json`
  - `pipeline/data/practice_tests/official/test_2.json`
  - `pipeline/data/practice_tests/official/test_3.json`
  - `pipeline/data/practice_tests/synthetic/test_1.json`
  - `pipeline/data/practice_tests/synthetic/test_2.json`
  - `pipeline/data/practice_tests/synthetic/test_3.json`

## Generated Corpus Counts

Stage 3 raw MCQs are complete:

- 53 topic files
- 25 raw MCQs per topic
- 1,325 raw MCQs total

By unit:

- Unit 1: 15 topics, 375 raw MCQs
- Unit 2: 12 topics, 300 raw MCQs
- Unit 3: 9 topics, 225 raw MCQs
- Unit 4: 17 topics, 425 raw MCQs

Stage 6 raw FRQs are complete:

- `methods_control`: 12
- `class_writing`: 12
- `arraylist`: 12
- `array_2d`: 12
- 48 raw FRQs total

Curated corpus before the current downstream run:

- `data/mcqs`: 41 topic files, 492 validated MCQs, 12 per file
- `data/frqs`: 9 curated FRQs, 3 each for `class_writing`, `arraylist`, and `array_2d`; no curated `methods_control` file yet

## Practice Test Counts

Official Princeton-derived practice tests:

- Test 1: 42 MCQs, 4 FRQs
- Test 2: 42 MCQs, 4 FRQs
- Test 3: 42 MCQs, 4 FRQs
- Total: 126 MCQs, 12 FRQs

Synthetic practice tests:

- Test 1: 42 MCQs, 3 FRQs
- Test 2: 42 MCQs, 3 FRQs
- Test 3: 42 MCQs, 3 FRQs
- Total: 126 MCQs, 9 FRQs

The synthetic tests currently have only 3 FRQs each, so they do not yet match the stated 4-FRQ exam structure.

## Princeton Review Comparison

The parsed Princeton Review book provides:

- 55 chapter drill items in `princeton_chapters.json`
- 3 full practice exams in `princeton_exams.json`
- 126 practice-exam MCQs and 12 practice-exam FRQs
- 1,159 lines of format/strategy material in `princeton_format_chapters.md`

The parsed XHTML filenames referenced by `stage1_parse_princeton.py` match files present in the actual EPUB, so the parsed artifacts appear to derive from the local book.

The book's real practice-test questions are mostly Java/programming questions. Direct broad computing-impact or data-ethics testing is minimal:

- One official PR MCQ asks what cannot be determined from a population data set without extra fields. This tests knowledge that can be extracted from data.
- No official PR practice-test FRQ appears to test privacy, consent, legal issues, or social impacts directly.
- The format chapter says AP CSA students should understand ethical and social implications of computer use.
- A larger block on computing innovations, legal/ethical factors, and responsible computing appears in a comparison with AP Computer Science Principles, so it should not be treated as strong evidence that the PR CSA tests heavily drill those topics.

The synthetic tests currently contain algorithmic-bias and broad data-quality questions. Those should be removed before the app is built because the working bank is now constrained to Princeton Review practice-test/book concepts, not broader current-framework edge topics.

## Notes Coverage

`sources/apcsa_notes.md` is structurally complete for the parser:

- It has all four unit sections.
- `parse_notes.py` currently maps all 53 topic IDs to full unit-level excerpts.
- It does not have explicit topic-ID headings, so topics within a unit share the same notes excerpt.

Strengths:

- Java basics, methods, control flow, classes, arrays, ArrayLists, 2D arrays, sorting, and recursion tracing are covered.
- File input with `File` and `Scanner(File)` is covered.
- Recursion is framed correctly for current scope: trace recursive code, do not write recursive methods from scratch.
- Removed inheritance-heavy topics are mostly avoided.

Changes from this audit:

- Updated the Princeton EPUB path fallback so Stage 1 can locate the actual local EPUB if `sources/princeton_review_2025.epub` is absent.
- Added a scope filter excluding `u3_s3_2`, `u4_s4_1`, `u4_s4_17`, and broad algorithmic-bias/privacy/legal/ethics/social-impact generated items from validation, publishing, and DB loading.

Remaining caveats:

- The notes are comprehensive enough for the current generated materials, but explicit topic-ID headings would make future per-topic generation and audits cleaner.
- Synthetic practice tests should be regenerated or republished with 4 FRQs each if they are meant to fully simulate the current AP CSA exam format.
- MCQ stem-pattern distribution is not enforced by Stage 3; raw output is skewed toward code tracing and conceptual/vocabulary patterns.
