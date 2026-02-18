# CLAUDE.md

## Project Overview

Hot Tub Time Machine is a hot tub chemical tracker deployed on Val Town. It uses a Hono backend with Val Town's built-in SQLite, a React frontend served as static files, and a GitHub Actions workflow to deploy via the `vt` CLI.

## Architecture

- **Runtime**: Val Town (Deno-based). All imports use URL imports (`https://esm.sh/`, `https://esm.town/`).
- **Backend**: Hono app in `backend/index.ts`. Routes serve the frontend, a REST API for sessions/readings/additions/maintenance, and a dashboard endpoint.
- **Frontend**: React TSX components in `frontend/components/`. Served as static files via Val Town's `serveFile` utility. Initial dashboard data is bootstrapped into the HTML via `window.__INITIAL_DATA__`.
- **Database**: Val Town SQLite (`https://esm.town/v/std/sqlite`). Migrations run lazily on first request. Tables: `test_sessions`, `test_readings`, `chemical_additions`, `maintenance_events`.
- **Shared code**: `shared/types.ts` has all TypeScript interfaces and constants. `shared/chemistry.ts` has dosing calculations, drop-to-PPM conversions, and test cadence logic.

## Key Conventions

- Entry point is `index.ts` which re-exports `backend/index.ts`.
- No build step — TypeScript files are served and executed directly by Val Town/Deno.
- Chemistry constants are calibrated for a 330-gallon tub using Taylor K-2106 test kit and 7.5% bleach.
- All dosing functions live in `shared/chemistry.ts` and are shared between frontend and backend.

## Deployment

Deployment is via GitHub Actions (`.github/workflows/deploy.yml`):
1. Triggers on push to `main`
2. Installs Deno and the `vt` CLI
3. Clones the Val Town project, copies source files over, and runs `vt push`

Required GitHub repo configuration:
- **Secret**: `VAL_TOWN_API_KEY` — Val Town API token with user:read, val:read+write, and telemetry:read scopes
- **Variable**: `VT_PROJECT` — Val Town project name (e.g. `username/hot-tub-time-machine`)

## Database Schema

- `test_sessions` — id, started_at, completed_at, notes
- `test_readings` — id, session_id (FK), test_type, phase (before/after), value_ppm, raw_drops, sample_size_ml, created_at
- `chemical_additions` — id, session_id (FK), chemical, amount_oz, created_at
- `maintenance_events` — id, event_type, created_at, notes

## API Routes

- `GET /` — Serves frontend HTML with bootstrapped dashboard data
- `GET /api/dashboard` — Dashboard summary (last tests, last maintenance, suggested tests, recent sessions)
- `POST /api/sessions` — Create test session
- `PUT /api/sessions/:id` — Complete a session
- `GET /api/sessions` — List sessions (with `?limit=`)
- `GET /api/sessions/:id` — Get session detail with readings and additions
- `POST /api/readings` — Add a test reading
- `POST /api/additions` — Add a chemical addition
- `POST /api/maintenance` — Log maintenance event
- `GET /api/maintenance` — List maintenance events (with `?limit=`)

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
