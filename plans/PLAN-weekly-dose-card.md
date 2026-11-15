# Plan: weekly dose card, linear wizard, filter-change steps, research docs

Status: built 2026-11-14 on branch worktree-agent-afa1fb63b5246447e (fe159ee, 4aebe6c, 3b6686a); review APPROVE-WITH-NITS, nits folded in; awaiting merge/deploy go.

## Why

Tarek's routine: after testing he adds **2 bromine tablets and a 6.6 oz bleach shock, once a week**. He never shocks midweek and never retests bromine (the bromine reading is how he calibrates the floater/tablets). The app today only suggests bleach (6.6 oz + 2 tablets) when bromine < 4, then runs a timer and a bromine retest, and splits the flow (bromine read → pH → `bromine_fix`) so bleach doesn't skew pH. None of that matches the routine. The weekly dose should be logged in one place, at the end, prefilled.

## Decided (do not re-litigate)

1. **The summary step is the only place the weekly bleach and tablets are prefilled and logged.** The bromine step no longer recommends a dose; it shows an advisory (no `amountOz`, like TA "Aeration").
2. **Remove `bromine_fix`.** With no bleach mid-test, the split flow is unnecessary; the wizard becomes linear TA → bromine → pH → calcium. There is no bromine retest/timer path anymore. The pH soft-skip when bromine > 10 stays exactly as is (`> 10`, Taylor kit limit). The AGENTS.md "Test order matters" bullet must be rewritten in the same change.
3. **Keep the 6.6 oz dose** (`BLEACH_SHOCK_OZ`). Dose size is an open measurement, not a code change.
4. **Bleach line skip rule:** skip (with a stated reason) when the session's latest bromine reading (`after ?? before`) is **≥ 10**, or bleach was already logged this session, or bleach was logged in the last 3 days (DB). Tablets line: skip with reason if tablets were logged this session or in the last 3 days; otherwise prefill 2. No half-dose threshold anywhere (the 3.3 oz idea is dead).
5. Filter-change steps go into the app; soak/rinse/dry steps go on the reference page; step text lives in one shared constant.
6. Research is preserved in two new docs, tagged per claim.
7. Low-bromine advisory points to the summary card rather than promising a shock (the card may skip it under the 3-day rule). Sessions with no bromine reading still get the shock prefilled (weekly dose; 3-day guard prevents doubles) — known limit, by decision 2026-11-14.

## Steps

### 1. Pure logic in `shared/chemistry.ts` (+ tests)
- `SHOCK_SKIP_BROMINE_PPM = 10` and `shouldSkipShock(bromine: number | null): boolean` (`>= 10`; null → false).
- `BLEACH_FC_PPM_PER_OZ ≈ 1.75` with a comment showing the derivation (6.6 fl oz = 195 mL into 1,249 L; 7.5% NaOCl ≈ 7.1% available chlorine; 11–12 ppm FC per 6.6 oz) and `BROMINE_PER_FC = 2.25` (Br2/Cl2 = 159.81/70.91). `bromineRiseFromBleach(oz)` → ≈ 26 ppm for 6.6 oz.
- `WEEKLY_DOSE_RECENT_DAYS = 3`.
- `getWeeklyDose({ bromine, bleachLoggedThisSession, tabletsLoggedThisSession, lastBleachAt, lastTabletsAt, now })` → `{ tablets: { include: boolean; count: number; skipReason?: string; floaterHint: string }, bleach: { include: boolean; oz: number; skipReason?: string; expectedBromine?: number } }`. Floater hint by reading: always "Check the floater's holes aren't blocked and its setting hasn't shifted."; plus bromine < 4 → "Bromine was low: if it's low again next week, open the floater a notch."; bromine ≥ 10 → "Bromine was high: close the floater down a notch."
- Bromine recommendation in `getRecommendations`: bromine < 4 → advisory only, no `amountOz`/`unit`: chemical "Weekly shock", amount "Covered by today's shock", reason "Bromine is low (N ppm). If it's low two weeks running, open the floater a notch." Bromine ≥ 10 → advisory "Skip this week's shock; close the floater down a notch; leave the cover open until it's under 10." 4–<10 → no recs.
- Fix the tablet comment: tablets are **HTH Spa bromine tablets** (BCDMH-based, carry their own chlorine); `BROMINE_TABLET_OZ = 0.7` is still unmeasured, say so.
- Tests in `tests/chemistry.test.ts`: update the existing bleach-rec assertions (~lines 126–136, 194); add tests for `shouldSkipShock` (9.5/10/14/null), `bromineRiseFromBleach(6.6)` ≈ 25–28, and `getWeeklyDose` cases: normal (both included), bromine 10 (bleach skipped), bleach logged this session, bleach logged 2 days ago (skipped) vs 4 days ago (included), tablets logged this session.

### 2. DB: last bleach / tablet times (`server/db.ts`)
- `getLastAdditionTimes(db)` → `{ lastBleachAt: string | null; lastTabletsAt: string | null }` via `MAX(created_at)` from `chemical_additions` for chemical `'7.5% Bleach'` and `BROMINE_TABLET`. Return from the test route loader. (Same query `plans/PLAN-last-shock.md` will need.)

### 3. Wizard (`app/routes/_layout.test.tsx`)
- Remove `bromine_fix`, `WizardStep` virtual-step plumbing, `effectiveTest`, the bromine-deferred-recommendation branches. Linear order.
- Bromine "before" reading → recommendation step showing the advisory (or "in range") → next test. No timer/retest offered for bromine (advisories have no "Applied" buttons, matching TA aeration).
- Saved sessionStorage state from before this deploy may contain `"bromine_fix"` in `selectedTests`: on load, filter it out (or discard such state) so resume doesn't crash.
- Summary step: a **"Before you close the lid"** card above "+ Add something else", built from `getWeeklyDose`:
  - Tablets row: editable count (default 2), remove (×) control, floater hint text under it; or the skip reason.
  - Bleach row: editable amount (oz, default 6.6), remove control; or the skip reason. When included, a note: "Adds about 25–28 ppm bromine (expect ~N). Pour into open water with the pump running. Leave the cover off 20 min; soak when bromine tests under 10." (N = latest bromine + rise; omit "expect" if no reading.)
  - One "Log these" button → existing `saveAdditions` intent; on success the card shows the logged items (✓) and the rows can't be logged twice. If nothing is included, the card shows only the reasons and the floater check.
  - "This session" means `state.additions` by chemical name (covers "+ Add something else" too).
- Timer hint text: "Run jets to mix chemicals" → "Keep the pump running to mix" (he runs the pump on low).
- Keep the layout work from commits e2b6b61/0df34df intact (sticky actions, compact card). Optional nit from review: reuse `daysSince` from `shared/chemistry.ts` in `daysAgoShort` instead of its own date parse.

### 4. Guidance text (`shared/types.ts`)
- Bromine guidance: replace "If low, shock with bleach." with something true under the new flow, e.g. "Weekly shock is logged at the end.\nAbove 10: remove floater, leave cover open." Keep it to ≤ 2 short lines (it must not wrap at 393px; see 0df34df).

### 5. Filter change steps
- New `shared/maintenance.ts`: `FILTER_CHANGE_STEPS` (at the tub) and `FILTER_CLEANING_STEPS` (over the next day). Content:
  - At the tub: 1. Pump off, pull the dirty filter. 2. Put in the clean, dry spare; pump on. 3. Rinse the dirty one with the Filter Flosser, top to bottom, turning it, until the water runs clear (no pressure washer or stiff brush).
  - Cleaning: 4. Soak fully submerged overnight (3 h minimum) in filter cleaner: TSP 1 cup per 5 gal, or Leisure Time Filter Clean 16 oz per 4 gal. 5. Rinse until no suds or slick feel. 6. Dry completely; store out of the sun. 7. No routine bleach soak; never mix bleach or filter cleaner with an acid cleaner. 8. Replace when pleats flatten or fray, end caps crack, or bands break (about 12–24 months).
- `app/routes/_layout.settings.maintenance.tsx`: tapping Filter Change shows the at-tub steps and the cleaning steps as a short checklist/flow, ending in the existing log action ("Done — Log it"), with a "Just log it" shortcut. Reuse the existing drain & refill pattern on that page.
- `app/routes/_layout.settings.reference.tsx`: a "Filter cleaning" section rendering both lists.

### 6. Docs (research preservation)
- `docs/weekly-routine.md` and `docs/filter-care.md` from the appendix below. Tag each claim: **sourced** (link), **computed**, **inferred**, or **measured (date)**. Include an "Open measurements" section in weekly-routine.md.
- `AGENTS.md` "Chemistry conventions": rewrite the test-order bullet for the linear flow (bromine read before pH still; no mid-test bleach so no split; pH soft-skip > 10 unchanged); add the weekly-dose bullet (logged from the summary card, no bromine retest, 6.6 oz ≈ +12 ppm FC ≈ +26 ppm bromine, skip at ≥ 10); point to both new docs.
- `README.md` Features + Chemistry: replace the split-flow description; link both docs.
- `plans/PLAN-last-shock.md`: mark the open decision resolved (any bleach addition counts; Tarek only ever doses 6.6 oz weekly).
- `LEFTOVERS.md`: keep existing items; add "read bromine 24 h and 48 h after a shock (how long until < 10)", "weigh one HTH tablet to replace BROMINE_TABLET_OZ", "copy the HTH tablet label's ppm range and re-entry line into docs/weekly-routine.md", "Drain & Refill flow doesn't log its sodium bromide/bleach as additions (hardcoded strings), so a last-shock query misses refill shocks". For the borax item, add: also read at 20–30 min, sample elbow-deep away from the filter well, repeat twice; if it holds, make the retest timer per-test.

## Required behaviour (done =)
- Wizard with bromine + pH selected runs linearly; bromine shows an advisory, never a dose, never a timer/retest; pH skip >10 unchanged.
- Summary card prefills 2 tablets + 6.6 oz bleach on a normal session; skips bleach with a reason at bromine ≥ 10, or when bleach was logged this session / in the last 3 days; same recency rule for tablets; one tap logs; can't double-log; floater-hole check always shown.
- Filter Change on the maintenance page shows the steps and still logs the event; reference page shows the cleaning steps.
- Old saved wizard state containing `bromine_fix` doesn't crash.
- `npm test` green; no new `tsc` errors in `app/`, `shared/`, `server/` (legacy `frontend/` errors are pre-existing).
- Docs, AGENTS.md, README, LEFTOVERS, PLAN-last-shock updated.

## Budget (direction, not a cap)
Production ~300 lines changed (net may be negative in the wizard from removing `bromine_fix`), tests ~80, docs ~250.

## Out of scope
- Changing the shock dose, the pH timer length, or the pH skip threshold.
- Drain & Refill logging additions (leftover only).
- Last-shock dashboard card (separate plan).
- Notifications, PWA, schema changes/migrations.
- Pushing, merging to main, deploying, touching `--remote`.

## Executor stops at
Commits on the local branch in its worktree with gate 0 results. No push, no merge, no deploy.

---

## Appendix: research facts for the docs (from the 2026-11-14 session and a Fable consult)

**Dose arithmetic (computed).** "7.5%" bleach is sodium hypochlorite by weight; the Clorox label says it yields 7.1% available chlorine ([EPA label 5813-120](https://www3.epa.gov/pesticides/chem_search/ppls/005813-00120-20190725.pdf)). 6.6 fl oz = 195 mL into 330 gal = 1,249 L → 11.1 ppm FC ignoring density, ~12.2 ppm at density ~1.10 (density inferred). With a bromide bank, bromine = 2.25 × FC (Br2 159.81 / Cl2 70.91) → **+25 to +28 ppm bromine, on top of the current reading**. 1 tbsp ≈ +0.9 ppm FC ≈ +2.1 ppm bromine. The bromide bank (1.65 oz NaBr at refill ≈ 29 ppm bromide) isn't a limit; the shock consumes ~14.

**Targets (sourced).** CDC: hot tub bromine 4–8 ppm, pH 7.2–7.8 ([Legionella toolkit](https://www.cdc.gov/control-legionella/php/toolkit/hot-tub-module.html)); consumer page pH 7.0–7.8 ([CDC](https://www.cdc.gov/healthy-swimming/safety/what-you-can-do-to-stay-healthy-in-hot-tubs.html)). APSP-11 (2019) raised the public spa bromine minimum from 2.0 to 4.0 ppm ([Pool & Spa News](https://www.poolspanews.com/?p=26641)). These are public-facility standards; nothing official covers home tubs. App target 4–6 sits inside them.

**Weekly shock (sourced).** Manufacturers say shock about weekly: [Sundance](https://www.sundancespas.com/blog-articles/hot-tub-shock-treatments-complete-guide) (cover off 20+ min with pumps running; re-enter when back in range), [Cal Spas manual](https://www.manualslib.com/manual/2557947/Cal-Spas-Les.html?page=32) (cover open ≥ 20 min; let sanitizer fall to range). [Leslie's](https://lesliespool.com/blog/how-to-brominate-a-spa-or-hot-tub.html) also says weekly. **No manufacturer source gives a bleach dose for a bromine tub**; 6.6 oz rests on the forum method in `docs/bromine-3-step-method.md` (3 oz per 100 gal at 5.25% scaled). Manufacturer MPS weekly shocks are ~1–2 oz ≈ 5 ppm FC-equivalent, so 6.6 oz bleach is 2–3× that (inferred) — why the tub sits above 10 for a while.

**Skip at ≥ 10 (sourced + inferred).** The 3-step doc: above 10, remove floater, open the spa until < 10, close the floater down. Shocking on top of ≥ 10 pushes it to ~35+. ≥ (not >) because the 25 mL drop slider tops out at 20 drops = 10 ppm, so "10" can mean "10 or more". From `seeds/historical.sql` (38 most recent "before" readings, 2025-11-03 to 2026-10-10): 8 below 4, 6 in 4–6, 12 in 8–9.5, 8 at ≥ 10 → the rule skips about 1 session in 5 (measured). Readings swing 0–16; the lever for that is the floater opening, not bleach. Soak when < 10 (3-step doc); CDC's ceiling is 8.

**Kit (sourced, weaker).** Taylor K-2106's FAS-DPD bromine titration reads up to ~20 ppm chlorine (≈ 45 ppm bromine) on a 10 mL sample without bleaching out; if pink fades, add more R-0870 (Taylor documents, search snippet). The ~22.5 ppm "bleach-out" figure applies to color-match DPD, not this kit. The bromine retest after a shock is still pointless: result is known to be far above 10 and changes no decision; and the 10 mL slider caps at 16 drops = 20 ppm.

**Tablets (sourced).** [HTH Spa Bromine Tablets SDS](https://images.thdstatic.com/catalog/pdfImages/0a/0aa4e279-bfda-4be1-b644-b3abd1e43fad.pdf): BCDMH 50–60%, DCDMH 25–35%, DCEMH 10–20% — they carry their own chlorine. The label on his container is the binding source for ppm range and re-entry (not yet copied).

**Where to pour (inferred).** Borax dissolved in tub water via the filter well is mild. Bleach and dry acid go into open water with the pump running, not through the cartridge. Bleach must be plain (not splash-less or scented) and loses strength with age.

**Mixing time (open).** Tarek doses borax pre-dissolved into the filter well, pump on low (two-speed pump, no circulation pump). Estimate 3–5 min (inferred, no source); the 3-step doc says ~30 min, an [HTH dealer tip sheet](https://cdn.shopify.com/s/files/1/2720/2188/files/HTH-Bromine-Tip-Sheet.pdf) says ≥ 30. Measurement: read pH at 3, 10 and 20–30 min, air valves closed, sample elbow-deep away from the filter well and jets, on two occasions.

**Shock decay (open).** Only back-to-back pair: 16.25 → 11.25 ppm in 3 h 20 min (2026-03-05, conditions unknown). Measure 24 h and 48 h after a shock.

**Filter care (sourced).** Bleach is a poor cleaner and harsh on media: [Sundance](https://www.sundancespas.com/blog-articles/how-to-clean-a-hot-tub-filter-using-sundance-r-spa-filters-the-right-way) ("too harsh — eats away at filter media"), Pleatco FilterWash FAQ (snippet; [page](https://www.pleatco.com/filterwash) now redirects), [Bath and Spa Parts guide](https://www.bathandspaparts.com/blogs/news/spa-pool-filter-cartridge-cleaning-guide). [Hot Spring's sheet](https://www.hotspring.com/wp-content/uploads/2022/07/hot-spring-spas-how-to-clean-hot-tub-spa-filter.pdf) says rinse, spray with filter cleaner/degreaser, soak overnight (no mention of bleach). No manufacturer manual found prescribing a bleach soak. Degreaser soak then rinse: Hot Spring (overnight), Sundance (8–12 h), Leisure Time (3 h min, overnight best). Never combine with acid (Unicel warning, snippet; retailer guide). Unicel's older instructions allow dishwasher detergent; Sundance says avoid it. Filter: POOLPURE C-5345 (Unicel C-5345 equivalent, pleated polyester), two rotated; rinse tool: Filter Flosser.
- Products: **Savogran TSP** (10621 1 lb / 10622 4.5 lb, [Home Depot](https://homedepot.com/p/SAVOGRAN-4-5-lbs-Box-TSP-Heavy-Duty-Cleaner-10622/202935862)) — Unicel's instructions name TSP at 1 cup per 5 gal (snippet); non-sudsing, cheapest; not "TSP-PF" (10611/90612, a different product); gloves and eye protection. Tarek already owns a 1 lb box (bought 2015). **[Leisure Time Filter Clean](https://shop.leisuretimeinc.com/products/filter-clean)** (Amazon) — 16 oz per 4 gal, 3 h min, overnight best; alkaline (pH 12–13, snippet).

**Owner's own facts (measured/stated 2026-11-14).** Never shocks midweek; 6.6 oz weekly only; 2 tablets almost every session; never retests bromine (uses the reading to calibrate tablets/floater); floater holes shift and can get blocked, so check them each time.
