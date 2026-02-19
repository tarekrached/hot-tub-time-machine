# CLAUDE.md

## Project Overview

Hot Tub Time Machine is a mobile-friendly hot tub chemical tracker deployed on Cloudflare Pages with D1 database. It replaces a printed cheat sheet used to record chemical levels before and after balancing. Built with React Router v7 (framework mode) for SSR, loaders, and actions.

## Architecture

- **Runtime**: Cloudflare Pages (Workers runtime)
- **Framework**: React Router v7 (framework mode) with SSR
- **Database**: Cloudflare D1 (SQLite). Migrations in `migrations/` applied via `wrangler d1 migrations apply`.
- **Styling**: CSS Modules, light theme optimized for outdoor readability
- **Data Pattern**: Server loaders for reads, actions for mutations. No REST API routes.
- **Shared code**: `shared/types.ts` has TypeScript interfaces and constants. `shared/chemistry.ts` has dosing calculations, drop-to-PPM conversions, and test cadence logic.
- **Server code**: `server/db.ts` has all D1 query functions.
- **Testing**: Vitest for chemistry unit tests

## Key Conventions

- Standard npm imports (no URL imports)
- `npm run dev` for local development, `npm run build` for production build
- Chemistry constants are calibrated for a 330-gallon tub using Taylor K-2106 test kit and 7.5% disinfecting bleach
- All dosing functions live in `shared/chemistry.ts` and are shared between frontend and backend
- Test order: TA → Bromine → pH → Calcium (bromine before pH to enforce pH skip when bromine > 10 ppm)
- The app is designed to be used on a phone while standing at the hot tub

## Chemistry Reference

The chemistry and maintenance schedule is based on the [bromine 3-step method](https://www.poolspaforum.com/forum/index.php?/topic/53410-how-to-use-bromine-3-step-method/). A full copy of the source material is saved in `docs/bromine-3-step-method.md`.

Key design decisions from the source:
- **Titrating tests**: The app supports entering raw drop counts instead of PPM values. The bromine test has two sample size options (10ml vs 25ml) with different PPM-per-drop ratios.
- **Test order matters**: TA should be adjusted before pH. pH cannot be accurately tested when sanitizer is above 10 ppm (Taylor kit limit).
- **Shock dosing**: Uses bleach to oxidize the bromide bank. No additional sodium bromide is needed for weekly shock — only on drain/refill.
- **Maintenance cadence**: The app tracks time since last test and proposes appropriate tests on open. Weekly: pH & bromine. Every 2–4 weeks: TA & calcium. Every 3–4 months: drain, refill, rebalance, re-add sodium bromide.

## Deployment

Deployment is via GitHub Actions (`.github/workflows/deploy.yml`):
1. Triggers on push to `main`
2. Installs Node 22, runs `npm ci`, tests, and build
3. Applies D1 migrations via `wrangler d1 migrations apply --remote`
4. Deploys to Cloudflare Pages via `wrangler pages deploy`

Required GitHub repo secrets:
- **`CLOUDFLARE_API_TOKEN`** — Cloudflare API token with Workers/Pages/D1 permissions
- **`CLOUDFLARE_ACCOUNT_ID`** — Cloudflare account ID

## Project Structure

```
app/
├── routes/           # React Router v7 route modules
├── components/       # Shared UI components (Toast, StepDots, Timer, Sparkline)
├── styles/           # CSS Modules
├── root.tsx          # Root document
└── routes.ts         # Route configuration
shared/
├── chemistry.ts      # Dosing calculations, drop-to-PPM, test cadence
└── types.ts          # TypeScript interfaces, constants, ranges
server/
└── db.ts             # D1 query functions
migrations/
└── 0001_initial.sql  # D1 migration
tests/
└── chemistry.test.ts # Vitest unit tests
```

## Database Schema

- `test_sessions` — id, started_at, completed_at, notes
- `test_readings` — id, session_id (FK), test_type, phase (before/after), value_ppm, raw_drops, sample_size_ml, created_at
- `chemical_additions` — id, session_id (FK), chemical, amount_oz, created_at
- `maintenance_events` — id, event_type, created_at, notes

## Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — status cards with urgency coloring, sparkline trends |
| `/test` | Test wizard — per-test sequential flow with session recovery |
| `/settings/log` | Combined timeline of test sessions and maintenance events |
| `/settings/maintenance` | Action buttons to log maintenance + drain/refill bromide reminder |
| `/settings/reference` | Static dosing tables, drop-to-PPM reference, test schedule |

## Test Types and Ranges

| Type | Key | Ideal Range | Test Cadence |
|------|-----|-------------|-------------|
| pH | `ph` | 7.4 – 7.8 | 7 days |
| Bromine | `bromine` | 4 – 6 ppm | 7 days |
| Total Alkalinity | `ta` | 50 – 70 ppm | 21 days |
| Calcium Hardness | `calcium` | 130 – 150 ppm | 21 days |

## Chemical Types

`bleach_7.5`, `baking_soda`, `dry_acid`, `borax`, `sodium_bromide`, `calcium_chloride`

## Maintenance Types

`filter_change` (30 days), `water_change` (30 days), `drain_refill` (105 days)
