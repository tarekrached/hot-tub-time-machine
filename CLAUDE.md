# CLAUDE.md

Hot Tub Time Machine is a mobile-friendly hot tub chemical tracker, replacing a printed cheat sheet used to record chemical levels before and after balancing. Deployed on Cloudflare Workers with a D1 database, built with React Router v7 in framework mode (SSR, loaders, actions — no REST API routes; loaders read, actions mutate).

## Architecture notes

- `workers/app.ts` is the Cloudflare Worker entry point; it wires up React Router's `createRequestHandler` and provides `context.cloudflare.env` (with the D1 binding) to loaders/actions.
- `shared/chemistry.ts` and `shared/types.ts` are imported by both frontend and backend — dosing calculations, drop-to-PPM conversions, test cadence logic, and the DB row types all live there. Read that file for schema and domain constants rather than looking for them duplicated here.
- Vitest has its own `vitest.config.ts`, separate from the main Vite config, to avoid conflicts with the Cloudflare Vite plugin.
- `backend/` and `frontend/` are legacy — the original Val Town app that served as the spec for this rebuild. Not used at runtime.

## Local development

```bash
npm install
npx wrangler d1 migrations apply hot-tub-time-machine --local  # required on first run / new worktree
npx wrangler d1 execute hot-tub-time-machine --local --file=seeds/historical.sql  # load seed data
npm run dev
```

Migrations must be applied before `npm run dev` will serve pages without a 500 error. The local D1 database lives in `.wrangler/state/v3/d1/`; `--remote` targets the production database instead.

## Backup and restore

`seeds/historical.sql` is committed to git and serves as both local dev seed data and a periodic production backup. It's safe to re-run (`INSERT OR IGNORE`).

Update it from production whenever you want a fresh snapshot committed:

```bash
npx wrangler d1 export hot-tub-time-machine --remote --no-schema --output=seeds/historical.sql
git add seeds/historical.sql && git commit -m "chore: update DB seed"
```

Restore locally (after deleting `.wrangler/state/v3/d1/` and re-applying migrations):

```bash
npx wrangler d1 execute hot-tub-time-machine --local --file=seeds/historical.sql
```

Restore to production (after a fresh migration apply on a new database):

```bash
npx wrangler d1 execute hot-tub-time-machine --remote --file=seeds/historical.sql
```

## Chemistry conventions

Chemistry constants in `shared/chemistry.ts` are calibrated for a specific setup: a 330-gallon tub, Taylor K-2106 test kit, 7.5% disinfecting bleach. They won't generalize to a different tub or kit without recalibration.

- **Test order matters**: TA should be adjusted before pH, and pH can't be tested accurately when sanitizer is above 10 ppm (Taylor kit limit). When both bromine and pH are selected in the wizard, the flow splits: bromine reading first (no fix yet), then pH is fully tested and fixed, then the bromine fix/retest runs. This is so bleach added for low bromine doesn't skew the pH reading — don't "simplify" this into a straight linear flow.
- **Titrating vs. non-titrating tests**: the app accepts raw drop counts for titrating tests, converted to PPM. Bromine has two sample sizes (10ml/25ml) with different PPM-per-drop ratios. pH is not titrating — it's a swipe slider with 13 discrete stops from `<7.0` to `>8.0`; the out-of-range ends are stored internally as the sentinel values `6.8` and `8.2`, and `formatPhValue()` in `shared/chemistry.ts` converts those back to the display strings. If you see `6.8` or `8.2` in pH data, that's the sentinel, not a real reading.
- **Shock dosing** uses bleach to oxidize the bromide bank; no additional sodium bromide is needed for weekly shock, only on drain/refill.
- The chemistry write-up this app is based on (the bromine 3-step method) is saved in full at `docs/bromine-3-step-method.md`, sourced from https://www.poolspaforum.com/forum/index.php?/topic/53410-how-to-use-bromine-3-step-method/.

## Deployment

CI (`.github/workflows/deploy.yml`) on push to `main`: installs Node 22, `npm ci`, runs tests and build, applies D1 migrations remotely, then deploys.

The build (`react-router build`) produces `build/client/` (static assets) and `build/server/` (worker bundle + a generated `wrangler.json` with `no_bundle: true`) — the deploy step points wrangler at that generated config, not the repo-root `wrangler.toml`.

Required GitHub repo secrets:
- `CLOUDFLARE_API_TOKEN` — needs Workers Scripts:Edit, Workers Routes:Edit, D1:Edit, and Account Settings:Read
- `CLOUDFLARE_ACCOUNT_ID`

## Keeping this file current

Update this file when a gotcha or manual step changes. README is the public overview.
