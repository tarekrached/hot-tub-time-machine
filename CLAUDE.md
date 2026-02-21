# CLAUDE.md

## Project Overview

Hot Tub Time Machine is a mobile-friendly hot tub chemical tracker deployed on Cloudflare Workers with D1 database. It replaces a printed cheat sheet used to record chemical levels before and after balancing. Built with React Router v7 (framework mode) for SSR, loaders, and actions.

## Architecture

- **Runtime**: Cloudflare Workers with static assets
- **Framework**: React Router v7 (framework mode) with SSR, using `@cloudflare/vite-plugin` and `v8_viteEnvironmentApi`
- **Database**: Cloudflare D1 (SQLite). Migrations in `migrations/` applied via `wrangler d1 migrations apply`.
- **Styling**: CSS Modules, light theme optimized for outdoor readability
- **Data Pattern**: Server loaders for reads, actions for mutations. No REST API routes.
- **Worker entry**: `workers/app.ts` is the Cloudflare Worker entry point. It wires up React Router's `createRequestHandler` and provides `context.cloudflare.env` (with D1 binding) to loaders/actions.
- **Server rendering**: `app/entry.server.tsx` uses `renderToReadableStream` (Web Streams API, Cloudflare-compatible).
- **Shared code**: `shared/types.ts` has TypeScript interfaces and constants. `shared/chemistry.ts` has dosing calculations, drop-to-PPM conversions, and test cadence logic.
- **Server code**: `server/db.ts` has all D1 query functions.
- **Testing**: Vitest for chemistry unit tests (separate `vitest.config.ts` to avoid Cloudflare plugin conflicts)

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
4. Deploys to Cloudflare Workers via `wrangler deploy --config build/server/wrangler.json`

The build (`react-router build`) produces `build/client/` (static assets) and `build/server/` (worker bundle + generated `wrangler.json` with `no_bundle: true`). The generated config points the worker at the pre-bundled output and the static assets directory.

Required GitHub repo secrets:
- **`CLOUDFLARE_API_TOKEN`** — Cloudflare API token with Workers Scripts:Edit, Workers Routes:Edit, D1:Edit, and Account Settings:Read permissions
- **`CLOUDFLARE_ACCOUNT_ID`** — Cloudflare account ID

## Project Structure

```
workers/
└── app.ts                      # Cloudflare Worker entry point (fetch handler)
app/
├── entry.server.tsx            # SSR entry using renderToReadableStream
├── root.tsx                    # Root document (html, head, body, Scripts)
├── routes.ts                   # Route configuration
├── routes/
│   ├── _layout.tsx             # Root layout: bottom tab bar, error boundary, toast
│   ├── _layout._index.tsx      # Dashboard (/)
│   ├── _layout.test.tsx        # Test wizard (/test)
│   ├── _layout.settings.tsx    # Settings layout with sub-tabs
│   ├── _layout.settings._index.tsx       # Redirect to /settings/log
│   ├── _layout.settings.log.tsx          # Combined timeline (/settings/log)
│   ├── _layout.settings.maintenance.tsx  # Maintenance actions (/settings/maintenance)
│   └── _layout.settings.reference.tsx    # Dosing reference (/settings/reference)
├── components/
│   ├── SparklineChart.tsx      # SVG sparkline for dashboard trend cards
│   ├── StepDots.tsx            # Step progress indicator (● ○ ○ ○)
│   ├── Timer.tsx               # 15-minute countdown timer
│   └── ToastProvider.tsx       # Toast notification context provider
└── styles/                     # CSS Modules
    ├── global.css
    ├── layout.module.css
    ├── dashboard.module.css
    ├── test-wizard.module.css
    ├── timeline.module.css
    ├── settings.module.css
    ├── maintenance.module.css
    ├── reference.module.css
    ├── step-dots.module.css
    ├── timer.module.css
    └── toast.module.css
shared/
├── chemistry.ts                # Dosing calculations, drop-to-PPM, test cadence
└── types.ts                    # TypeScript interfaces, constants, ranges
server/
└── db.ts                       # D1 query functions
migrations/
└── 0001_initial.sql            # D1 migration
tests/
└── chemistry.test.ts           # Vitest unit tests
docs/
└── bromine-3-step-method.md    # Bromine 3-step method reference
```

**Legacy directories** (`backend/`, `frontend/`) contain the original Val Town app code that served as a specification for the Cloudflare rebuild. They are not used at runtime.

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

## Keeping Docs Up to Date

When making changes to the project, update the documentation in the same commit:

- **CLAUDE.md** — Update if you change architecture, add/remove files or directories, modify deployment, change database schema, add routes, or alter conventions. This is the primary source of truth for how the project works.
- **README.md** — Update if changes affect the tech stack description, development commands, deployment instructions, or feature list. This is the public-facing overview.

Do not let documentation drift from the code. If you add a new route, file, dependency, or config change, reflect it in the relevant sections of both files.
