# Leftovers

- **Push/deploy the input-step layout + timer fix** (2026-11-14): committed locally on `main`, waiting on Tarek's go to push (push = deploy via CI).
- **Measure how long pH takes to settle after borax** (2026-11-14): next borax dose, read pH at 3 min and at 10 min on the low pump. If they match, shorten the pH re-test timer (`RETEST_SECONDS` in `app/routes/_layout.test.tsx`, currently 15 min) to 3–5 min.
