# Plan: editable chemical-addition amounts in the test wizard

Status: implemented and reviewed 2026-10-09 (APPROVE-WITH-NITS after one fix round); awaiting Tarek's review, not merged or deployed

## Why

The wizard records a chemical dose only when the user taps "Applied — Start Timer", and then it saves the *recommended* amount by regex-matching `oz` out of the display string (`app/routes/_layout.test.tsx`, `handleApplyAndTimer`). Since commit 98ffbc3 (2026-03-06), baking soda and borax recommendations are written in tbsp only, so the regex never matches and nothing is saved: the last logged baking soda is 2026-03-05. Even when it does save, it records the recommendation rather than what the user actually added, and there is no way to log anything off-script (an extra chemical, a bromine tablet). The Log page doesn't show additions at all, so none of this is visible.

## Decided (do not re-litigate)

- Amounts stay stored in ounces in `chemical_additions.amount_oz`. **No schema migration.**
- Chemical names stay stored as the display names the app already writes (`"Baking Soda"`, `"Dry Acid (sodium bisulfate)"`, `"7.5% Bleach"`, `"Borax"`, `"Calcium Chloride"`). Do not switch to the `ChemicalType` slugs in `shared/types.ts` (that type is out of sync with stored data; leave it alone).
- The user enters the amount in the unit the recommendation shows first (tbsp for baking soda and borax, oz for bleach, dry acid and calcium chloride) and can switch units. Conversions are the existing ones: 1 oz = 2 tbsp = 6 tsp.

## Steps

1. **Structured dose on recommendations** (`shared/chemistry.ts`)
   - Add `amountOz?: number` and `unit?: "oz" | "tbsp"` (the unit the display amount leads with) to `DosingRecommendation`. Every recommendation that is an actual dose sets `amountOz` to the same quantity the `amount` string describes (the string must not change). Non-dose advice (TA-high "Aeration") leaves both unset.
   - Add pure helpers: `toOz(value: number, unit: "oz" | "tbsp" | "tsp"): number` and `fromOz(oz: number, unit): number`, rounded to 2 decimals.
   - Tests (`tests/chemistry.test.ts`): `amountOz` for bleach (6.6), baking soda at TA 40 (0.75 oz = the 1.5 tbsp shown), borax at pH 7.3 (1.5 oz = the 3 tbsp shown), dry acid at pH 8.0, calcium chloride at CH 110; aeration has no `amountOz`; for every dosing case the `amount` string's leading number equals `fromOz(amountOz, unit)`; `toOz`/`fromOz` round-trip.

2. **Save action accepts several additions and validates** (`app/routes/_layout.test.tsx` action)
   - `saveAddition` keeps working for one addition. Validate: `sessionId` a positive integer, `chemical` non-empty after trim (max 60 chars), `amountOz` finite and > 0 (max 100). Invalid input returns `{ error }` without writing.
   - Add `saveAdditions` taking a JSON array of `{ chemical, amountOz }` with the same validation (reject the whole batch if any item is invalid), so one "Applied" tap is one request.

3. **Editable amount on the recommendation step** (wizard UI)
   - Each recommendation card with `amountOz` shows a number input prefilled with the recommended amount in its `unit`, plus a small unit toggle (oz / tbsp / tsp). `inputMode="decimal"`, large tap targets: this is used one-handed at the tub on a phone.
   - "Applied — Start Timer" saves every dose card whose entered amount is > 0 via `saveAdditions`, using the **entered** amount converted to oz. A blank or 0 amount means "not added" for that card. No regex parsing of display strings anywhere.
   - Use a dedicated `useFetcher` (or a keyed one) for additions so it can't cancel or be cancelled by the reading/session submissions on the existing shared `fetcher`.
   - Track saved additions in `WizardState` (e.g. `additions: { chemical, amountOz }[]`), persisted with the rest of the state in sessionStorage. Old saved state without the field must still load (default to `[]`).

4. **"+ Add chemical" for off-script doses**
   - Available on the recommendation step (in range or not) and on the summary step. Opens an inline form: chemical picker (7.5% Bleach, Baking Soda, Borax, Dry Acid (sodium bisulfate), Calcium Chloride, Sodium Bromide, Other → free-text name), amount, unit (oz / tbsp / tsp). Save posts one addition to the current session and appends to `state.additions`.
   - Summary step lists this session's additions (chemical + amount in oz and tbsp).

5. **Show additions in the Log** (`app/routes/_layout.settings.log.tsx`, and `server/db.ts` only if the timeline query doesn't already include them)
   - Under each session entry, list its additions ("Baking Soda · 1 oz (2 tbsp)"). Sessions without additions render as today.

## Tests and gate 0

- `npm test` green, with the new tests from step 1 plus tests for the action's validation if it can be exercised without D1 (extract the validation into a pure function, e.g. `parseAdditionInput`, and test that).
- `npm run build` succeeds and `npx react-router typegen && npx tsc --noEmit` reports no errors in touched files (legacy `backend/`, `frontend/` and `workers/app.ts` errors are pre-existing; ignore them).

## Out of scope

- Schema changes, a unit column, or storing counts (bromine tablets have no oz amount; a tablet can be logged as "Other" with an approximate weight, or skipped).
- Editing or deleting additions after they are saved.
- Changing dosing math or the recommendation strings.
- The HA summary endpoint and `server/ha-summary.ts`.
- The wizard's test order / bromine-pH split flow.
- Anything outside this repo; no deploy, no migrations run against any database.

## Where the executor stops

Changes made in the worktree at `/Users/sparky/code/tries/2026-10-09-hottub-additions` on branch `feat/editable-additions`, tests and build run, results reported. The executor does not commit (sandbox can't write git metadata), push, deploy, or touch `--remote` anything.
