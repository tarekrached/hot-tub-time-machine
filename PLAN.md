# Migration Plan: React Router v7 + Cloudflare Workers + D1

## Overview

Migrate from Val Town + Hono + Val Town SQLite → React Router v7 (Remix) + Cloudflare Workers + D1 + Cloudflare Access.

**Why this stack:**
- React Router v7 = Remix renamed. Full-stack React with loaders/actions, great forms, no separate API layer needed
- Cloudflare D1 = SQLite at the edge. Your existing SQL queries work with minimal changes
- Cloudflare Workers = fast, no cold starts, generous free tier (100k req/day)
- Cloudflare Access = zero-code auth in front of the app (free for up to 50 users)

**What stays the same:**
- React components (with minor adaptation)
- All chemistry logic (`shared/chemistry.ts`) — copy as-is
- All TypeScript types (`shared/types.ts`) — copy as-is
- Database schema — D1 is SQLite, so same SQL
- Mobile-first CSS — copy as-is

---

## Step 1: Scaffold React Router v7 + Cloudflare Project

Create a new React Router v7 project using the Cloudflare template:

```bash
npx create-react-router@latest hot-tub-v2 --template cloudflare
```

This gives us:
- `app/` directory with routes, components, root layout
- `wrangler.toml` for Cloudflare config
- `vite.config.ts` with React Router + Cloudflare plugin
- `package.json` with all dependencies
- Dev server with HMR

**New project structure:**
```
hot-tub-v2/
├── app/
│   ├── routes/              # File-based routing
│   │   ├── home.tsx         # Dashboard (GET /)
│   │   ├── api.sessions.ts  # REST endpoints (if needed)
│   │   └── ...
│   ├── components/          # React components (migrated)
│   │   ├── Dashboard.tsx
│   │   ├── TestSession.tsx
│   │   ├── TestHistory.tsx
│   │   ├── MaintenanceLog.tsx
│   │   └── DosingCalculator.tsx
│   ├── lib/
│   │   ├── chemistry.ts     # Shared chemistry (copied)
│   │   ├── types.ts         # Shared types (copied)
│   │   └── db.server.ts     # D1 database queries
│   ├── root.tsx             # App shell, layout, CSS
│   └── app.css              # Styles (migrated)
├── migrations/              # D1 SQL migrations
│   └── 0001_initial.sql
├── wrangler.toml            # Cloudflare config
├── vite.config.ts
└── package.json
```

---

## Step 2: Set Up D1 Database

### 2a. Create D1 database

```bash
npx wrangler d1 create hot-tub-db
```

Add binding to `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "hot-tub-db"
database_id = "<from-creation-output>"
```

### 2b. Create migration file

File: `migrations/0001_initial.sql`

Same schema as current, with one small change — D1 uses standard SQLite syntax:

```sql
CREATE TABLE test_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  notes TEXT
);

CREATE TABLE test_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES test_sessions(id),
  test_type TEXT NOT NULL,
  phase TEXT NOT NULL,
  value_ppm REAL,
  raw_drops INTEGER,
  sample_size_ml INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE chemical_additions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES test_sessions(id),
  chemical TEXT NOT NULL,
  amount_oz REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE maintenance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
```

Run migration:
```bash
npx wrangler d1 migrations apply hot-tub-db
```

### 2c. Create database query module

File: `app/lib/db.server.ts`

Rewrite `backend/database/queries.ts` to use D1's API instead of Val Town SQLite. Key difference: D1 uses `db.prepare(sql).bind(...args).all()` instead of Val Town's batch execute. The queries themselves stay the same — it's the same SQLite dialect.

---

## Step 3: Migrate Shared Code

### 3a. Types (`app/lib/types.ts`)

Direct copy of `shared/types.ts`. Only change: remove URL import syntax, use normal TypeScript exports. No logic changes needed.

### 3b. Chemistry (`app/lib/chemistry.ts`)

Direct copy of `shared/chemistry.ts`. Same change: normal imports instead of URL imports. All calculation logic stays identical.

---

## Step 4: Set Up Routes & Data Loading

React Router v7 replaces the separate Hono API + React SPA with unified route modules that handle both data loading (server) and rendering (client).

### 4a. Dashboard route (`app/routes/home.tsx`)

```typescript
// loader runs on server — replaces GET /api/dashboard
export async function loader({ context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  return getDashboardData(db);
}

// Component renders on client — replaces Dashboard.tsx
export default function Home({ loaderData }: Route.ComponentProps) {
  return <Dashboard data={loaderData} />;
}
```

This replaces:
- The `GET /` route that bootstraps `window.__INITIAL_DATA__`
- The `GET /api/dashboard` endpoint
- The SSR data injection hack

### 4b. API routes for mutations

For the SPA-style interactions (test session flow with multiple sequential API calls), keep lightweight API routes:

- `app/routes/api.sessions.ts` — POST (create), GET (list)
- `app/routes/api.sessions.$id.ts` — GET (detail), PUT (complete)
- `app/routes/api.readings.ts` — POST (add reading)
- `app/routes/api.additions.ts` — POST (add addition)
- `app/routes/api.maintenance.ts` — POST (add), GET (list)

These are thin wrappers around the db.server.ts functions. The TestSession component's multi-step flow works best with direct fetch calls rather than form actions, so keeping REST endpoints is the pragmatic choice.

---

## Step 5: Migrate React Components

### 5a. App shell → `app/root.tsx`

The current `App.tsx` manages tab state and renders components. In React Router v7, `root.tsx` provides the shell (HTML head, CSS, scripts) and the tab navigation. The tab routing can either:

- **Option A**: Keep client-side tab state (simpler migration, single route)
- **Option B**: Use React Router nested routes (each tab = a route, enables URL-based navigation)

**Recommendation: Option A** for initial migration (less risk), convert to Option B later if desired.

### 5b. Component migration (minimal changes)

Each component needs these changes:
1. Replace URL imports (`https://esm.sh/react`) with normal imports (`import React from "react"`)
2. Replace `fetch("/api/...")` URLs — these stay the same since we're keeping API routes
3. Remove `window.__INITIAL_DATA__` usage — replaced by loader data passed as props

**Component-specific notes:**

- **Dashboard.tsx**: Remove SSR bootstrap logic. Data comes from loader via props. Otherwise unchanged.
- **TestSession.tsx**: No changes needed beyond imports. Multi-step flow with fetch calls works as-is.
- **TestHistory.tsx**: No changes beyond imports. Fetches session list on mount.
- **MaintenanceLog.tsx**: No changes beyond imports. Fetches/posts maintenance events.
- **DosingCalculator.tsx**: Pure static component. Only import changes.

### 5c. CSS (`app/app.css`)

Direct copy of `frontend/style.css`. No changes needed — it's standard CSS.

---

## Step 6: Update Build & Dev Setup

### 6a. `vite.config.ts`

Already configured by the Cloudflare template. Handles:
- React Router plugin (file-based routing, SSR)
- Cloudflare adapter (Workers runtime)
- HMR for development

### 6b. `wrangler.toml`

```toml
name = "hot-tub-time-machine"
compatibility_date = "2024-11-18"
main = "build/server/index.js"
assets = { directory = "build/client" }

[[d1_databases]]
binding = "DB"
database_name = "hot-tub-db"
database_id = "<id>"
```

### 6c. Local development

```bash
npm run dev        # Vite dev server with D1 local emulation
```

D1 is automatically emulated locally by wrangler — no cloud DB needed for dev.

---

## Step 7: Set Up Cloudflare Access (Auth)

### 7a. Prerequisites
- Domain or Cloudflare Workers subdomain (e.g., `hot-tub.yourdomain.com`)
- Cloudflare Zero Trust dashboard access (free)

### 7b. Configuration (via Cloudflare dashboard)
1. Go to Cloudflare Zero Trust → Access → Applications
2. Create application: "Hot Tub Time Machine"
3. Set application domain to your Workers URL
4. Create access policy:
   - **Allow**: Emails matching your email address
   - **Authentication**: Email OTP, Google, or GitHub (pick one or more)
5. Save

### 7c. Result
- All requests to your app go through Cloudflare Access first
- Unauthenticated users see a login page (hosted by Cloudflare)
- Authenticated users get a JWT cookie and pass through to your app
- **Zero code changes in your app** — auth is handled at the network layer

---

## Step 8: Deployment

### 8a. Manual deploy

```bash
npm run build
npx wrangler deploy
```

### 8b. GitHub Actions (`.github/workflows/deploy.yml`)

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Required secrets:**
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers + D1 permissions

---

## Migration Order (recommended)

1. **Scaffold project** — get React Router + Cloudflare template running locally
2. **Copy shared code** — types.ts, chemistry.ts (zero-risk, no logic changes)
3. **Set up D1** — create database, run migration, write db.server.ts
4. **Migrate dashboard** — loader + Dashboard component (proves the stack works end-to-end)
5. **Migrate API routes** — sessions, readings, additions, maintenance
6. **Migrate remaining components** — TestSession, TestHistory, MaintenanceLog, DosingCalculator
7. **Copy CSS** — drop in style.css
8. **Test locally** — full flow on phone via local network
9. **Deploy to Cloudflare** — wrangler deploy
10. **Enable Cloudflare Access** — lock it down
11. **Set up GitHub Actions** — automate deploys
12. **Migrate data** — export from Val Town SQLite, import to D1 (if historical data matters)

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| D1 SQL incompatibility | Low | D1 is SQLite — same dialect as Val Town |
| React component breakage | Low | Components are simple, mainly import changes |
| TestSession multi-step flow | Low | Keeping REST API routes for this flow |
| Local dev D1 emulation issues | Low | Wrangler's local D1 emulation is mature |
| Cloudflare Access setup confusion | Medium | Dashboard-only config, well-documented |
| Data migration from Val Town | Medium | Small dataset, manual export/import is fine |

---

## What You Gain

- **Normal dev experience**: `npm install`, `npm run dev`, standard TypeScript
- **Auth for free**: Cloudflare Access, zero code
- **No deployment scripting**: `wrangler deploy` or auto via GitHub Actions
- **Fast everywhere**: Edge-deployed, no cold starts
- **Truly free**: Workers free tier = 100k req/day, D1 free tier = 5GB + 5M reads/day
- **URL-based routing** (optional): Can add later for deep links to specific tabs
- **Hot reload**: Vite HMR during development
