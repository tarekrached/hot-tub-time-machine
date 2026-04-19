# Hot Tub Time Machine

A mobile-friendly hot tub chemical tracker deployed on Cloudflare Workers with D1 database, at https://hot-tub-time-machine.tarek-rached.workers.dev/ . Track water chemistry test sessions, log chemical additions, and get dosing recommendations — all from your phone while standing at the hot tub.

## Features

- **Test Wizard** — Per-test sequential flow (TA → Bromine → pH → Calcium) with session recovery, 15-minute retest timers, and dosing recommendations. When bromine and pH are both selected, bromine is read first, pH is fully fixed, then bromine is fixed — preventing bleach from skewing the pH reading.
- **Drop-to-PPM Conversion** — Automatic conversion for Taylor K-2106 titration tests (supports 10ml and 25ml sample sizes); pH uses a swipe slider with out-of-range `<7.0` / `>8.0` support
- **Dosing Recommendations** — Calculates chemical amounts based on current readings for a 330-gallon tub
- **Dashboard** — Status cards with urgency coloring (green/yellow/red), sparkline trends, and overdue test badges
- **Maintenance Log** — Track filter changes, water changes, and drain/refill events with sodium bromide reminders
- **pH Enforcement** — Soft auto-skip when bromine > 10 ppm (Taylor kit limit) with manual override

## Tech Stack

- **Runtime**: Cloudflare Workers with static assets
- **Framework**: [React Router v7](https://reactrouter.com/) (framework mode) with SSR via `@cloudflare/vite-plugin`
- **Database**: Cloudflare D1 (SQLite)
- **Styling**: CSS Modules, light theme optimized for outdoor readability
- **Testing**: Vitest for chemistry unit tests
- **Deployment**: GitHub Actions → Cloudflare Workers via Wrangler

## Development

```bash
npm install
npm run dev       # Local dev server with HMR
npm test          # Run chemistry unit tests
npm run build     # Production build
```

## Chemistry

Configured for a **330-gallon** hot tub using the [bromine 3-step method](https://www.poolspaforum.com/forum/index.php?/topic/53410-how-to-use-bromine-3-step-method/) with **7.5% disinfecting bleach** and a **Taylor K-2106** drop-based test kit. See [`docs/bromine-3-step-method.md`](docs/bromine-3-step-method.md) for the full reference and [`docs/cheatsheet.pdf`](docs/cheatsheet.pdf) for the original printed cheat sheet this app replaced.

| Test | Ideal Range | Cadence |
|------|-------------|---------|
| pH | 7.4 – 7.8 | Weekly |
| Bromine | 4 – 6 ppm | Weekly |
| Total Alkalinity | 50 – 70 ppm | Every 3 weeks |
| Calcium Hardness | 130 – 150 ppm | Every 3 weeks |

## Deployment

The app deploys to Cloudflare Workers automatically on push to `main` via GitHub Actions.

### Required GitHub repo secrets

- **`CLOUDFLARE_API_TOKEN`** — Cloudflare API token with Workers Scripts:Edit, Workers Routes:Edit, D1:Edit, and Account Settings:Read permissions
- **`CLOUDFLARE_ACCOUNT_ID`** — Cloudflare account ID

### Manual deploy

```bash
npm run build
npx wrangler d1 migrations apply hot-tub-time-machine --remote
npx wrangler deploy --config build/server/wrangler.json
```

## Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — status cards with urgency coloring, sparkline trends |
| `/test` | Test wizard — per-test sequential flow with session recovery |
| `/settings/log` | Combined timeline of test sessions and maintenance events |
| `/settings/maintenance` | Action buttons to log maintenance + drain/refill bromide reminder |
| `/settings/reference` | Static dosing tables, drop-to-PPM reference, test schedule |
