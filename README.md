# Hot Tub Time Machine

A hot tub chemical tracker and maintenance app built on [Val Town](https://val.town). Track water chemistry test sessions, log chemical additions, and get dosing recommendations — all from a simple web UI.

## Features

- **Test Sessions** — Record before/after readings for pH, bromine, total alkalinity, and calcium hardness
- **Drop-to-PPM Conversion** — Automatic conversion for Taylor K-2106 titration tests
- **Dosing Recommendations** — Calculates chemical amounts based on current readings for a 330-gallon tub
- **Maintenance Log** — Track filter changes, water changes, and drain/refill events
- **Dashboard** — See last test dates, suggested tests based on cadence, and recent session history

## Tech Stack

- **Backend**: [Hono](https://hono.dev/) web framework on Val Town
- **Frontend**: React (TSX) served as static files
- **Database**: Val Town SQLite (`@std/sqlite`)
- **Deployment**: GitHub Actions → Val Town via the `vt` CLI

## Project Structure

```
index.ts                  # Entry point (re-exports backend)
backend/
  index.ts                # Hono API routes
  database/
    migrations.ts         # SQLite table creation
    queries.ts            # Database query functions
frontend/
  index.html              # Main HTML shell
  index.tsx               # React entry point
  style.css               # Styles
  components/
    App.tsx               # Root component with routing
    Dashboard.tsx         # Home dashboard
    TestSession.tsx       # Test session workflow
    TestHistory.tsx       # Past session browser
    MaintenanceLog.tsx    # Maintenance event tracker
    DosingCalculator.tsx  # Chemical dosing calculator
shared/
  types.ts                # TypeScript interfaces and constants
  chemistry.ts            # Chemistry calculations and dosing logic
docs/
  bromine-3-step-method.md  # Reference: bromine maintenance method
.github/workflows/
  deploy.yml              # CI/CD: deploy to Val Town on push to main
```

## Chemistry

Configured for a **330-gallon** hot tub using the [bromine 3-step method](https://www.poolspaforum.com/forum/index.php?/topic/53410-how-to-use-bromine-3-step-method/) with **7.5% disinfecting bleach** and a **Taylor K-2106** drop-based test kit. See [`docs/bromine-3-step-method.md`](docs/bromine-3-step-method.md) for the full reference.

| Test | Ideal Range | Cadence |
|------|-------------|---------|
| pH | 7.4 – 7.8 | Weekly |
| Bromine | 4 – 6 ppm | Weekly |
| Total Alkalinity | 50 – 70 ppm | Every 3 weeks |
| Calcium Hardness | 130 – 150 ppm | Every 3 weeks |

## Deployment

The app deploys to Val Town automatically when you push to `main` via GitHub Actions.

### Required GitHub repo settings

- **Secret** `VAL_TOWN_API_KEY` — Val Town API token with **user:read**, **val:read+write**, and **telemetry:read** scopes. Generate at [val.town/settings/api](https://www.val.town/settings/api).
- **Variable** `VT_PROJECT` — The name of your Val Town project (e.g. `username/hot-tub-time-machine`).

### Manual deploy

```bash
# Install the vt CLI
deno install --global --force --allow-read --allow-write --allow-env --allow-net jsr:@valtown/vt

# Clone, copy files, and push
vt clone <your-vt-project> vt-project
cp -r backend frontend shared index.ts vt-project/
cd vt-project && vt push
```
