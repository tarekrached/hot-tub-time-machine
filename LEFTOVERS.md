# Leftovers

- **Push/deploy the input-step layout + timer fix** (2026-11-14): committed locally on `main`, waiting on Tarek's go to push (push = deploy via CI).
- **Measure how long pH takes to settle after borax** (2026-11-14): next borax dose, read pH at 3 min and at 10 min on the low pump. If they match, shorten the pH re-test timer (`RETEST_SECONDS` in `app/routes/_layout.test.tsx`, currently 15 min) to 3–5 min. Also read at 20–30 min, sample elbow-deep away from the filter well, and repeat on two occasions; if it holds, make the retest timer per-test.
- **Read bromine 24 h and 48 h after a shock** (2026-11-14): how long until it's under 10. Feeds the dose-size question in `docs/weekly-routine.md`.
- **Weigh one HTH tablet** (2026-11-14): replace `BROMINE_TABLET_OZ` (0.7, unmeasured) in `shared/chemistry.ts`.
- **Copy the HTH tablet label's ppm range and re-entry line** into `docs/weekly-routine.md` (2026-11-14).
- **Drain & Refill doesn't log its sodium bromide/bleach as additions** (2026-11-14): the flow on the maintenance page uses hardcoded strings, so a last-shock query misses refill shocks.
