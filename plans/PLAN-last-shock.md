# Plan: "last shocked" card on the dashboard

Status: queued 2026-10-24, not started. Revisit once bleach has been logged for a few weeks, so the card has real data behind it.

## Why

The bromine 3-step method (`docs/bromine-3-step-method.md`, maintenance table) calls for a weekly bleach shock. The app only suggests bleach when a bromine reading comes in under 4 ppm, and never shows when the tub was last shocked. Bleach additions are already logged (`chemical_additions.chemical = '7.5% Bleach'`, via the wizard's "Applied" button or the "+ Add chemical" picker), so the data exists; nothing reads it.

## Open decision (Tarek)

- What counts as a shock: any bleach addition, or only one at least some fraction of `BLEACH_SHOCK_OZ` (6.6 oz)? Suggested: at least half (3.3 oz), so a top-up doesn't reset the clock. The 2026-10-22 entry (4 oz) would count.

## Steps

1. **Cadence constant** (`shared/chemistry.ts`): add `SHOCK_CADENCE_DAYS = 7` next to the other cadences, and the threshold from the decision above.
2. **Query** (`server/db.ts`, `getDashboardData`): `SELECT MAX(created_at) FROM chemical_additions WHERE chemical = '7.5% Bleach' AND amount_oz >= ?`, returned as `lastShock: string | null` on `DashboardData` (`shared/types.ts`).
3. **Card** (`app/routes/_layout._index.tsx`): a "Shock" card in the same grid as the Filter Change / Water Change cards, using the existing `getUrgency(lastShock, SHOCK_CADENCE_DAYS)` and `timeSinceLabel`, with a "Due" badge at 7+ days. No action button; shocks are logged through the wizard.
4. **Tests**: the threshold check and the urgency at 0 / 5 / 7 / 10 days, as pure functions where possible.

## Out of scope

- Schema changes; chemical names stay the display strings (see `PLAN-editable-additions.md`).
- Changing the bromine < 4 ppm recommendation or the wizard flow.
- The HA summary endpoint (it already exposes additions).
- Deploying or touching `--remote`.
