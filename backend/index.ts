import { Hono } from "https://esm.sh/hono@4.4.0";
import { readFile, serveFile } from "https://esm.town/v/std/utils/index.ts";
import { runMigrations } from "./database/migrations.ts";
import {
  createSession,
  completeSession,
  getSessions,
  getSession,
  addReading,
  addChemicalAddition,
  addMaintenanceEvent,
  getMaintenanceEvents,
  getDashboardData,
} from "./database/queries.ts";

const app = new Hono();

app.onError((err, c) => {
  throw err;
});

// Run migrations on startup
let migrated = false;
app.use("*", async (c, next) => {
  if (!migrated) {
    await runMigrations();
    migrated = true;
  }
  await next();
});

// --- Serve frontend files ---
app.get("/frontend/*", (c) => serveFile(c.req.path, import.meta.url));
app.get("/shared/*", (c) => serveFile(c.req.path, import.meta.url));

// --- HTML with bootstrapped data ---
app.get("/", async (c) => {
  const dashboard = await getDashboardData();
  let html = await readFile("/frontend/index.html", import.meta.url);
  html = html.replace(
    "<!-- INITIAL_DATA -->",
    `<script>window.__INITIAL_DATA__ = ${JSON.stringify(dashboard)};</script>`
  );
  return c.html(html);
});

// --- API: Dashboard ---
app.get("/api/dashboard", async (c) => {
  const data = await getDashboardData();
  return c.json(data);
});

// --- API: Sessions ---
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();
  const id = await createSession(body.notes);
  return c.json({ id });
});

app.put("/api/sessions/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  await completeSession(id);
  return c.json({ ok: true });
});

app.get("/api/sessions", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const sessions = await getSessions(limit);
  return c.json(sessions);
});

app.get("/api/sessions/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const session = await getSession(id);
  if (!session) return c.json({ error: "Not found" }, 404);
  return c.json(session);
});

// --- API: Readings ---
app.post("/api/readings", async (c) => {
  const body = await c.req.json();
  const id = await addReading(
    body.session_id,
    body.test_type,
    body.phase,
    body.value_ppm,
    body.raw_drops ?? null,
    body.sample_size_ml ?? null
  );
  return c.json({ id });
});

// --- API: Chemical Additions ---
app.post("/api/additions", async (c) => {
  const body = await c.req.json();
  const id = await addChemicalAddition(
    body.session_id,
    body.chemical,
    body.amount_oz
  );
  return c.json({ id });
});

// --- API: Maintenance ---
app.post("/api/maintenance", async (c) => {
  const body = await c.req.json();
  const id = await addMaintenanceEvent(body.event_type, body.notes);
  return c.json({ id });
});

app.get("/api/maintenance", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50");
  const events = await getMaintenanceEvents(limit);
  return c.json(events);
});

export default app.fetch;
