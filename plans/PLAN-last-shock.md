# Plan: "last shocked" card on the dashboard

Status: queued 2026-10-24, not started. Revisit once bleach has been logged for a few weeks, so the card has real data behind it.

## Why

The bromine 3-step method (`docs/bromine-3-step-method.md`, maintenance table) calls for a weekly bleach shock. The app only suggests bleach when a bromine reading comes in under 4 ppm, and never shows when the tub was last shocked. Bleach additions are already logged (`chemical_additions.chemical = '7.5% Bleach'`, via the wizard's "Applied" button or the "+ Add chemical" picker), so the data exists; nothing reads it.

## Decision (resolved 2026-11-14)

- Any bleach addition counts as a shock: Tarek only ever doses 6.6 oz, weekly, so there is no threshold (the 3.3 oz half-dose idea is dropped). `getLastAdditionTimes()` in `server/db.ts` already returns the last bleach time, and the wizard's summary card is now where the weekly shock is logged (see `PLAN-weekly-dose-card.md`). Drain & Refill doesn't log its bleach as an addition yet, so a refill shock won't show (see LEFTOVERS).

## Steps

1. **Cadence constant** (`shared/chemistry.ts`): add `SHOCK_CADENCE_DAYS = 7` next to the other cadences.
2. **Query** (`server/db.ts`, `getDashboardData`): reuse `getLastAdditionTimes(db).lastBleachAt`, returned as `lastShock: string | null` on `DashboardData` (`shared/types.ts`).
3. **Card** (`app/routes/_layout._index.tsx`): a "Shock" card in the same grid as the Filter Change / Water Change cards, using the existing `getUrgency(lastShock, SHOCK_CADENCE_DAYS)` and `timeSinceLabel`, with a "Due" badge at 7+ days. No action button; shocks are logged through the wizard.
4. **Tests**: the urgency at 0 / 5 / 7 / 10 days, as pure functions where possible.

## Out of scope

- Schema changes; chemical names stay the display strings (see `PLAN-editable-additions.md`).
- Changing the bromine < 4 ppm recommendation or the wizard flow.
- The HA summary endpoint (it already exposes additions).
- Deploying or touching `--remote`.
