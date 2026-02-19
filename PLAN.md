# Hot Tub Time Machine — Cloudflare Build Plan

## Overview

Build a fresh hot tub chemical tracker on Cloudflare infrastructure, using the existing codebase as a specification for chemistry logic and UX requirements. This is **not** a migration of a working app — the existing Val Town app was never successfully deployed. The new app is built from scratch on modern infrastructure with several UX improvements.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Runtime** | Cloudflare Pages | Free PR preview deployments, git-triggered deploys, same Workers runtime under the hood |
| **Framework** | React Router v7 (framework mode) | Server loaders/actions, SSR, eliminates `window.__INITIAL_DATA__` hack |
| **Database** | Cloudflare D1 (US West) | Single-user app, primary region close to user |
| **Auth** | Cloudflare Access on entire domain | Zero-code auth, configured in CF dashboard |
| **Styling** | CSS Modules (from scratch) | Per-component scoped styles, fresh light theme |
| **Bundling** | Vite defaults | App is small enough; let Vite's heuristics handle splitting |
| **Testing** | Vitest | Chemistry unit tests only; integrates naturally with Vite |
| **Data pattern** | Loaders for reads, actions for mutations | Fully idiomatic RR v7. No `/api/*` routes. |
| **Shared code** | `/shared` directory with tsconfig paths | Both Vite and Wrangler resolve the same TypeScript source files |
| **Migrations** | Wrangler D1 migrations | Numbered SQL files, applied via `wrangler d1 migrations apply` during deploy |
| **Existing data** | Fresh start | No data migration from Val Town |
| **Chemistry constants** | Hardcoded | 330-gallon tub, 7.5% bleach, Taylor K-2106 kit. YAGNI. |

---

## UI/UX Design

### Navigation: 3-Tab Layout

No app header bar — maximize screen real estate. Fixed bottom tab bar:

| Tab | Route | Content |
|---|---|---|
| **Dashboard** | `/` | Status/urgency cards + SVG sparkline mini-trends |
| **Test** | `/test` | Per-test sequential wizard (direct entry point, no dashboard button) |
| **Settings** | `/settings` | Sub-navigation: Log \| Maintenance \| Reference |

### Theme: Light

Designed for outdoor readability (bright sunlight, wet/foggy screen). High contrast, generous spacing, large touch targets for wet fingers. Optimize for maximum outdoor readability.

### Settings Sub-Tabs

| Sub-tab | Content |
|---|---|
| **Log** | Combined timeline of test sessions AND maintenance events in chronological order |
| **Maintenance** | Action buttons to log filter change / water change / drain & refill (with sodium bromide reminder flow) |
| **Reference** | Dosing amounts, drop-to-PPM conversions, test schedule, adjustment order |

### Dashboard

- **Status cards** (2-column grid): One card per test type (pH, Bromine, TA, Calcium) + maintenance types (Filter, Water Change, Drain/Refill)
  - Color coding: green (OK), yellow (warning at 75% of cadence), red (urgent at 100%+)
  - "Due" badge when test/maintenance is overdue
  - Time since last test/event (relative: "Today", "3 days ago", etc.)
- **SVG sparkline mini-trends**: Last few sessions showing both before AND after readings as dual lines/dots per test type
- No "Start Test Session" button — the Test tab is the entry point

---

## Test Session Wizard — Per-Test Sequential Flow

### Test Order (reordered for pH enforcement)

**TA → Bromine → pH → Calcium**

Bromine is tested before pH so the app can enforce the soft pH skip when bromine > 10 ppm.

### Flow

```
1. SELECT TESTS
   - Checkboxes for each test type
   - Pre-checked with suggested (overdue) tests
   - "Start" button creates session via action
   - Step dots: ● ○ ○ ○ ... (one dot per selected test + summary)

2. PER-TEST LOOP (repeats for each selected test):

   a. INPUT READING
      - Test name + input field
      - Mode toggle: drops / ppm (for bromine, TA, calcium)
      - Bromine sample size toggle: 25ml / 10ml (in drops mode)
      - Real-time drop ↔ PPM conversion display
      - "Skip" button to skip this test entirely
      - Submit saves reading via RR action

   b. RECOMMENDATION (or "In Range!")
      - If IN RANGE: Show "✅ In range!" with "Next Test" button (manual advance)
      - If OUT OF RANGE: Show chemical, amount (oz + tbsp/tsp), reason
      - "Applied — Start Timer" or "Skip Re-test" buttons

   c. 15-MINUTE TIMER (only if chemicals were applied)
      - Countdown timer (15:00 → 0:00), dismissable via "Continue Early" button
      - Reminder text: "Run jets to mix chemicals"

   d. RE-TEST (optional, only if chemicals were applied)
      - Same input UI as step (a)
      - Saves as phase="after" reading via action

   → Advance to next test

3. PH ENFORCEMENT (soft)
   - When pH comes up in the loop and bromine was > 10 ppm:
     Auto-skip with explanation: "pH skipped: bromine is above 10 ppm
     (Taylor kit limit). Re-test pH when bromine drops below 10."
   - User can override: "Test pH anyway" button

4. SUMMARY
   - All tests with before/after values
   - Color-coded: green if in ideal range, red if out
   - Raw drop counts shown if entered
   - "Done" completes the session via action
```

### Session Recovery (sessionStorage)

- **Persist**: Save wizard state to sessionStorage on every input change
- **Resume**: When navigating to Test tab with saved state, show "Resume session?" prompt with summary of saved progress
- **Clear**: Clear sessionStorage when session completes or user chooses "Start Fresh"

---

## Error Handling

| Error Type | Pattern | Behavior |
|---|---|---|
| **Network errors** (fetch failures) | Toast notification | Auto-dismiss after 5 seconds. One auto-retry silently, then show toast with "Retry" button. |
| **Validation errors** (invalid input) | Inline error | Red text near the failed field. No retry needed — user corrects input. |
| **Action failures** (server errors) | Toast + block progression | Do not advance wizard step. Show error toast. One auto-retry, then manual retry via form resubmission. |

---

## Database Schema

Implemented as Wrangler D1 migration.

### Migration 0001: Initial Schema

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
  phase TEXT NOT NULL CHECK (phase IN ('before', 'after')),
  value_ppm REAL NOT NULL,
  raw_drops INTEGER,
  sample_size_ml INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE chemical_additions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES test_sessions(id),
  chemical TEXT NOT NULL,
  amount_oz REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE maintenance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
```

---

## Route Structure (React Router v7)

```
app/routes/
├── _layout.tsx                      # Root layout: tab bar, error boundary, toast provider
├── _layout._index.tsx               # Dashboard (/)
├── _layout.test.tsx                 # Test wizard (/test)
├── _layout.settings.tsx             # Settings layout with sub-tabs (/settings)
│   ├── _layout.settings._index.tsx  # Redirect to /settings/log
│   ├── _layout.settings.log.tsx     # Combined timeline (/settings/log)
│   ├── _layout.settings.maintenance.tsx  # Maintenance actions (/settings/maintenance)
│   └── _layout.settings.reference.tsx    # Dosing reference (/settings/reference)
```

### Loader/Action Map

| Route | Loader | Action |
|---|---|---|
| `/` (Dashboard) | Fetch last tests, last maintenance, suggested tests, sparkline data from D1 | — |
| `/test` | Check for active session (for resume prompt) | Create session, save reading, complete session |
| `/settings/log` | Fetch combined timeline (test sessions + maintenance events, ordered by date) | — |
| `/settings/maintenance` | Fetch maintenance events | Log maintenance event |
| `/settings/reference` | — (static content, uses shared chemistry constants) | — |

---

## Project Structure

```
hot-tub-time-machine/
├── app/
│   ├── routes/               # React Router v7 route modules
│   ├── components/           # Shared UI components (Toast, StepDots, Timer, etc.)
│   ├── styles/               # CSS Modules (*.module.css)
│   ├── lib/
│   │   └── errors.ts         # Error handling utilities (auto-retry, toast logic)
│   ├── root.tsx              # Root document (html, head, body, Scripts, etc.)
│   └── entry.server.tsx      # Server entry (Cloudflare Pages adapter)
├── shared/
│   ├── chemistry.ts          # Dosing calculations, drop-to-PPM, test cadence
│   └── types.ts              # TypeScript interfaces, constants, ranges
├── server/
│   └── db.ts                 # D1 query functions (adapted from current queries.ts)
├── migrations/
│   └── 0001_initial.sql      # D1 migration
├── tests/
│   └── chemistry.test.ts     # Vitest unit tests for chemistry module
├── public/                   # Static assets (favicon, etc.)
├── wrangler.toml             # Cloudflare config (D1 binding, Pages config)
├── vite.config.ts            # Vite config with React Router v7 plugin
├── tsconfig.json             # TypeScript config with shared/ path alias
├── package.json
├── CLAUDE.md
└── PLAN.md
```

---

## Shared Code (`/shared`)

### chemistry.ts — Preserved Logic

All existing chemistry logic carries forward unchanged:

- **Constants**: `TUB_GALLONS = 330`, `BLEACH_CONCENTRATION = 7.5`, all dosing constants
- **Functions**: `dropsToPpm()`, `ppmToDrops()`, `ozToTablespoons()`, `ozToTeaspoons()`, `getRecommendations()`, `timeSinceLabel()`, `daysSince()`
- **Cadence**: `TEST_CADENCE_DAYS` and `MAINTENANCE_CADENCE_DAYS`
- **New**: Test order constant `TEST_ORDER = ['ta', 'bromine', 'ph', 'calcium']` (updated from original TA → pH → Bromine → Calcium)

### types.ts — Preserved Types

All existing types carry forward unchanged:

- `TestSession`, `TestReading`, `ChemicalAddition`, `MaintenanceEvent`
- `TestType`, `MaintenanceType`, `ChemicalType`
- `TEST_RANGES`, `TEST_LABELS`, `MAINTENANCE_LABELS`
- `DashboardData`, `SessionDetail`

---

## Implementation Steps

### Phase 1: Project Scaffolding

1. **Initialize React Router v7 + Cloudflare Pages project**
   - Use the official `create-react-router` template for Cloudflare
   - Configure `wrangler.toml` with D1 binding (US West)
   - Set up `tsconfig.json` with `shared/` path alias
   - Configure Vitest in `vite.config.ts`

2. **Create D1 database and migration**
   - `wrangler d1 create hot-tub-time-machine`
   - Write `migrations/0001_initial.sql` with full schema
   - Apply migration locally: `wrangler d1 migrations apply --local`

3. **Port shared code**
   - Copy `shared/chemistry.ts` — update imports from URL imports to standard imports
   - Copy `shared/types.ts` — remove URL import dependencies
   - Add `TEST_ORDER` constant: `['ta', 'bromine', 'ph', 'calcium']`

4. **Write chemistry unit tests**
   - Test `dropsToPpm()` with all test types and sample sizes
   - Test `ppmToDrops()` inverse conversions
   - Test `getRecommendations()` for all test types at various values (in-range, below, above)
   - Test `ozToTablespoons()` and `ozToTeaspoons()` conversions
   - Test edge cases: zero drops, null sample size, boundary values

### Phase 2: Server Layer

5. **Implement D1 query functions** (`server/db.ts`)
   - Adapt `backend/database/queries.ts` from Val Town SQLite to D1 binding
   - D1 uses `env.DB.prepare().bind().all()` instead of `sqlite.execute()`
   - Add sparkline data query: last N before+after readings per test type
   - Add combined timeline query: UNION of test sessions and maintenance events, ordered by date

6. **Implement route loaders and actions**
   - Dashboard loader: suggested tests, urgency data, sparkline readings
   - Test route: action for create session, save reading, complete session (discriminated by intent field)
   - Settings/log loader: combined timeline query
   - Settings/maintenance: loader for events, action for logging
   - All loaders/actions receive D1 binding from Cloudflare context

### Phase 3: UI Components

7. **Root layout and navigation**
   - `root.tsx`: HTML document with light theme CSS variables, meta tags
   - `_layout.tsx`: Bottom tab bar (3 tabs: Dashboard, Test, Settings), error boundary, toast provider
   - No app header — tabs provide context
   - CSS Module for layout: `layout.module.css`

8. **Dashboard page** (`/`)
   - Status card grid (2-column) with urgency coloring (green/yellow/red)
   - SVG sparkline component: dual before/after lines per test type
   - `timeSinceLabel()` for relative dates
   - "Due" badge on overdue tests
   - CSS Module: `dashboard.module.css`

9. **Test wizard** (`/test`)
   - Step management: React state + sessionStorage (persist on every input change)
   - Resume prompt: check sessionStorage on mount, show modal if saved state exists
   - Test selection step with pre-checked suggestions from dashboard loader
   - Per-test loop component:
     - Input with drops/ppm toggle, sample size selector, real-time conversion
     - Recommendation display or "In Range!" confirmation (manual advance)
     - 15-minute dismissable countdown timer component
     - Optional re-test input
   - Soft pH enforcement: auto-skip with explanation + "Test pH anyway" override
   - Step dots progress indicator
   - Skip button per test
   - Summary step with color-coded before/after values
   - CSS Module: `test-wizard.module.css`

10. **Settings pages**
    - Sub-tab navigation (segmented control): Log | Maintenance | Reference
    - **Log**: Combined timeline of sessions + maintenance events, expandable session details with before/after readings
    - **Maintenance**: Three action buttons + drain/refill reminder flow (3-step sodium bromide instructions shown only during drain/refill logging)
    - **Reference**: Static dosing tables, drop-to-PPM reference, test schedule, adjustment order
    - CSS Modules: `settings.module.css`, `timeline.module.css`, `reference.module.css`

11. **Shared UI components**
    - `Toast.tsx` + `ToastProvider.tsx`: auto-dismiss network error toasts (5 seconds)
    - `StepDots.tsx`: progress indicator for wizard (● ○ ○ ○)
    - `Timer.tsx`: 15-minute countdown with dismiss button
    - `SparklineChart.tsx`: SVG sparkline for dashboard cards (dual before/after lines)
    - Error retry utility: one auto-retry silently, then surface manual retry button

### Phase 4: Error Handling

12. **Implement error handling system**
    - Toast context provider in root layout
    - Auto-retry wrapper for actions (retry once silently, then show toast with retry button)
    - Inline validation errors for test input fields (red text near field)
    - Block wizard progression on failed saves
    - Graceful loader error boundaries per route

### Phase 5: Deployment

13. **GitHub Actions workflow**
    - Trigger on push to `main` → deploy to production via Cloudflare Pages
    - Automatic PR preview deployments (Cloudflare Pages built-in via GitHub integration)
    - Apply D1 migrations as part of deploy: `wrangler d1 migrations apply --remote`
    - Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

14. **Cloudflare Access setup** (manual, one-time)
    - In Cloudflare dashboard → Zero Trust → Access → Applications
    - Create a self-hosted application for the Pages subdomain (`*.pages.dev`)
    - Configure identity provider: email OTP (simplest for single user)
    - Set policy: allow specific email address
    - Test: verify unauthenticated requests are redirected to login

### Phase 6: Polish & Testing

15. **Mobile optimizations**
    - Viewport meta: `user-scalable=no`, `apple-mobile-web-app-capable`
    - `env(safe-area-inset-bottom)` for iOS home bar
    - `-webkit-tap-highlight-color: transparent`
    - Large touch targets (minimum 44px) for wet-finger use
    - `inputMode="numeric"` / `inputMode="decimal"` for mobile keyboards
    - Remove number input spinners via CSS

16. **Final testing**
    - Run Vitest chemistry tests
    - Manual testing on preview deployment:
      - Full test session flow (all 4 tests)
      - Session recovery (close mid-wizard, reopen)
      - pH soft enforcement (enter bromine > 10, verify pH skip)
      - pH override (tap "Test pH anyway")
      - Maintenance logging (all 3 types, verify drain/refill reminder)
      - Dashboard sparklines with data
      - Error scenarios (disable network, verify toasts + auto-retry)
      - Timer countdown behavior (full 15 min + early dismiss)
      - Skip button per test
      - Combined timeline in Settings → Log
    - Test on actual phone at the hot tub (outdoor sunlight, wet hands)

---

## Chemistry Reference (Unchanged)

### Test Ranges

| Type | Key | Range | Ideal | Cadence |
|---|---|---|---|---|
| Total Alkalinity | `ta` | 50–70 ppm | 50–70 ppm | 21 days |
| Bromine | `bromine` | 4–10 ppm | 4–6 ppm | 7 days |
| pH | `ph` | 7.2–8.0 | 7.4–7.8 | 7 days |
| Calcium Hardness | `calcium` | 130–400 ppm | 130–150 ppm | 21 days |

### Dosing Constants (330 gal, 7.5% bleach)

| Chemical | Amount | Equivalent |
|---|---|---|
| Bleach (shock) | 6.6 oz | 13.2 tbsp |
| Sodium bromide (on refill) | 1.65 oz | 3.3 tbsp |
| Baking soda (per 10 ppm TA) | 0.92 oz | 5.5 tsp |
| Dry acid (per 0.2 pH) | 0.46 oz | 2.8 tsp |
| Calcium chloride (per 10 ppm) | 0.48 oz | 2.9 tsp |

### Drop-to-PPM (Taylor K-2106)

| Test | Sample Size | PPM per Drop |
|---|---|---|
| Bromine | 25 ml | 0.5 |
| Bromine | 10 ml | 1.25 |
| TA | 25 ml | 10 |
| Calcium | 25 ml | 10 |

### Maintenance Cadence

| Event | Cadence |
|---|---|
| pH + Bromine test | 7 days |
| TA + Calcium test | 21 days |
| Filter change | 30 days |
| Water change | 30 days |
| Drain & refill | 105 days |

---

## Key Differences from Existing Codebase

| Aspect | Old (Val Town, never deployed) | New (Cloudflare) |
|---|---|---|
| Runtime | Val Town (Deno) | Cloudflare Pages (Workers) |
| Framework | Hono + vanilla React | React Router v7 (framework mode) |
| Database | Val Town SQLite | Cloudflare D1 |
| Imports | URL imports (esm.sh) | Standard npm imports |
| Data fetching | REST API + `window.__INITIAL_DATA__` | Server loaders + actions (no API routes) |
| Styling | Single CSS file, dark theme | CSS Modules, light theme (outdoor-optimized) |
| Navigation | 5 tabs, SPA state | 3 route-based tabs with sub-navigation |
| Test wizard | All-at-once (before → recs → after) | Per-test sequential loops |
| Test order | TA → pH → Bromine → Calcium | TA → Bromine → pH → Calcium |
| pH enforcement | Warning text only | Soft auto-skip with override |
| Session recovery | None | sessionStorage persistence (every input change) |
| Error handling | None | Toasts + inline + auto-retry |
| Dashboard trends | None | SVG sparklines (before + after) |
| Settings | 3 separate tabs (History, Maintenance, Dosing) | Single tab with sub-tabs (Log, Maintenance, Reference) |
| Activity log | Separate history + maintenance views | Combined timeline |
| Header | Fixed "Hot Tub Time Machine" header | No header (more screen space) |
| Auth | None | Cloudflare Access |
| Deploy | `vt push` via GitHub Actions | Cloudflare Pages (git-triggered + PR previews) |
| Migrations | Lazy (on first request) | Wrangler D1 migrations (at deploy time) |
| Tests | None | Vitest (chemistry unit tests) |
| Build | None (runtime TSX) | Vite (bundled) |

---

## What You Gain

- **Normal dev experience**: `npm install`, `npm run dev`, standard TypeScript, HMR
- **Auth for free**: Cloudflare Access, zero code changes
- **Automatic deploys**: Push to main = production. PRs get preview URLs.
- **Fast everywhere**: Edge-deployed, no cold starts
- **Truly free**: Workers free tier = 100k req/day, D1 free tier = 5GB + 5M reads/day
- **URL-based routing**: Browser back button works between tabs, deep links
- **Improved UX**: Per-test wizard, session recovery, error handling, sparkline trends, light theme
- **Idiomatic React Router**: Loaders/actions, SSR, progressive enhancement
