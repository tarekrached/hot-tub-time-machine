import type {
  TestType,
  MaintenanceType,
  TestSession,
  TestReading,
  ChemicalAddition,
  MaintenanceEvent,
  DashboardData,
  SessionDetail,
  TimelineEntry,
} from "shared/types";
import { TEST_CADENCE_DAYS } from "shared/chemistry";

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
};

type D1Result<T = unknown> = {
  results: T[];
  success: boolean;
  meta: { last_row_id: number; changes: number };
};

// --- Sessions ---

export async function createSession(
  db: D1Database,
  notes?: string
): Promise<number> {
  const result = await db
    .prepare("INSERT INTO test_sessions (notes) VALUES (?)")
    .bind(notes || null)
    .run();
  return result.meta.last_row_id;
}

export async function completeSession(
  db: D1Database,
  id: number
): Promise<void> {
  await db
    .prepare(
      "UPDATE test_sessions SET completed_at = datetime('now') WHERE id = ?"
    )
    .bind(id)
    .run();
}

export async function getSession(
  db: D1Database,
  id: number
): Promise<SessionDetail | null> {
  const session = await db
    .prepare("SELECT * FROM test_sessions WHERE id = ?")
    .bind(id)
    .first<TestSession>();
  if (!session) return null;

  const readings = await db
    .prepare(
      "SELECT * FROM test_readings WHERE session_id = ? ORDER BY created_at"
    )
    .bind(id)
    .all<TestReading>();

  const additions = await db
    .prepare(
      "SELECT * FROM chemical_additions WHERE session_id = ? ORDER BY created_at"
    )
    .bind(id)
    .all<ChemicalAddition>();

  return {
    ...session,
    readings: readings.results,
    additions: additions.results,
  };
}

export async function getSessions(
  db: D1Database,
  limit = 20
): Promise<SessionDetail[]> {
  const sessions = await db
    .prepare("SELECT * FROM test_sessions ORDER BY started_at DESC LIMIT ?")
    .bind(limit)
    .all<TestSession>();

  const details: SessionDetail[] = [];
  for (const s of sessions.results) {
    const readings = await db
      .prepare(
        "SELECT * FROM test_readings WHERE session_id = ? ORDER BY created_at"
      )
      .bind(s.id)
      .all<TestReading>();
    const additions = await db
      .prepare(
        "SELECT * FROM chemical_additions WHERE session_id = ? ORDER BY created_at"
      )
      .bind(s.id)
      .all<ChemicalAddition>();
    details.push({
      ...s,
      readings: readings.results,
      additions: additions.results,
    });
  }
  return details;
}

// --- Readings ---

export async function addReading(
  db: D1Database,
  sessionId: number,
  testType: TestType,
  phase: "before" | "after",
  valuePpm: number,
  rawDrops: number | null,
  sampleSizeMl: number | null
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO test_readings (session_id, test_type, phase, value_ppm, raw_drops, sample_size_ml)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(sessionId, testType, phase, valuePpm, rawDrops, sampleSizeMl)
    .run();
  return result.meta.last_row_id;
}

// --- Chemical Additions ---

export async function addChemicalAddition(
  db: D1Database,
  sessionId: number | null,
  chemical: string,
  amountOz: number
): Promise<number> {
  const result = await db
    .prepare(
      "INSERT INTO chemical_additions (session_id, chemical, amount_oz) VALUES (?, ?, ?)"
    )
    .bind(sessionId, chemical, amountOz)
    .run();
  return result.meta.last_row_id;
}

// --- Maintenance ---

export async function addMaintenanceEvent(
  db: D1Database,
  eventType: MaintenanceType,
  notes?: string
): Promise<number> {
  const result = await db
    .prepare("INSERT INTO maintenance_events (event_type, notes) VALUES (?, ?)")
    .bind(eventType, notes || null)
    .run();
  return result.meta.last_row_id;
}

export async function getMaintenanceEvents(
  db: D1Database,
  limit = 50
): Promise<MaintenanceEvent[]> {
  const result = await db
    .prepare(
      "SELECT * FROM maintenance_events ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit)
    .all<MaintenanceEvent>();
  return result.results;
}

// --- Dashboard ---

export async function getDashboardData(
  db: D1Database
): Promise<DashboardData> {
  const testTypes: TestType[] = ["ph", "bromine", "ta", "calcium"];
  const lastTests: Record<string, string | null> = {};

  for (const tt of testTypes) {
    const row = await db
      .prepare(
        `SELECT MAX(r.created_at) as last_date
         FROM test_readings r
         WHERE r.test_type = ? AND r.phase = 'before'`
      )
      .bind(tt)
      .first<{ last_date: string | null }>();
    lastTests[tt] = row?.last_date || null;
  }

  const maintTypes: MaintenanceType[] = [
    "filter_change",
    "water_change",
    "drain_refill",
  ];
  const lastMaintenance: Record<string, string | null> = {};

  for (const mt of maintTypes) {
    // drain_refill also satisfies water_change (a full drain is a water change)
    const eventTypes =
      mt === "water_change" ? ["water_change", "drain_refill"] : [mt];
    const placeholders = eventTypes.map(() => "?").join(", ");
    const row = await db
      .prepare(
        `SELECT MAX(created_at) as last_date
         FROM maintenance_events
         WHERE event_type IN (${placeholders})`
      )
      .bind(...eventTypes)
      .first<{ last_date: string | null }>();
    lastMaintenance[mt] = row?.last_date || null;
  }

  const suggestedTests: TestType[] = [];
  const now = Date.now();
  for (const tt of testTypes) {
    const last = lastTests[tt];
    if (!last) {
      suggestedTests.push(tt);
    } else {
      const daysSince =
        (now - new Date(last + "Z").getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= TEST_CADENCE_DAYS[tt]) {
        suggestedTests.push(tt);
      }
    }
  }

  const sessions = await db
    .prepare(
      "SELECT * FROM test_sessions ORDER BY started_at DESC LIMIT 5"
    )
    .all<TestSession>();

  const recentSessions = [];
  for (const s of sessions.results) {
    const readings = await db
      .prepare(
        "SELECT * FROM test_readings WHERE session_id = ? ORDER BY created_at"
      )
      .bind(s.id)
      .all<TestReading>();
    recentSessions.push({
      ...s,
      readings: readings.results,
    });
  }

  return {
    lastTests: lastTests as Record<TestType, string | null>,
    lastMaintenance: lastMaintenance as Record<MaintenanceType, string | null>,
    suggestedTests,
    recentSessions,
  };
}

// --- Recent Readings by Test Type ---

export async function getRecentReadingsByTestType(
  db: D1Database
): Promise<Record<TestType, Array<{ ppm: number; created_at: string }>>> {
  const testTypes: TestType[] = ["ph", "bromine", "ta", "calcium"];
  const result = {} as Record<
    TestType,
    Array<{ ppm: number; created_at: string }>
  >;
  for (const tt of testTypes) {
    const rows = await db
      .prepare(
        `SELECT value_ppm, created_at FROM test_readings
         WHERE test_type = ? AND phase = 'before'
         ORDER BY created_at DESC LIMIT 3`
      )
      .bind(tt)
      .all<{ value_ppm: number; created_at: string }>();
    result[tt] = rows.results.map((r) => ({
      ppm: r.value_ppm,
      created_at: r.created_at,
    }));
  }
  return result;
}

// --- Sparkline Data ---

export async function getSparklineData(
  db: D1Database,
  testType: TestType,
  limit = 8
): Promise<{ before: number[]; after: number[] }> {
  const beforeReadings = await db
    .prepare(
      `SELECT value_ppm FROM test_readings
       WHERE test_type = ? AND phase = 'before'
       ORDER BY created_at DESC LIMIT ?`
    )
    .bind(testType, limit)
    .all<{ value_ppm: number }>();

  const afterReadings = await db
    .prepare(
      `SELECT value_ppm FROM test_readings
       WHERE test_type = ? AND phase = 'after'
       ORDER BY created_at DESC LIMIT ?`
    )
    .bind(testType, limit)
    .all<{ value_ppm: number }>();

  return {
    before: beforeReadings.results.map((r) => r.value_ppm).reverse(),
    after: afterReadings.results.map((r) => r.value_ppm).reverse(),
  };
}

// --- Timeline ---

export async function getTimeline(
  db: D1Database,
  limit = 30
): Promise<TimelineEntry[]> {
  // Get recent sessions with details
  const sessions = await getSessions(db, limit);
  const maintenance = await getMaintenanceEvents(db, limit);

  const entries: TimelineEntry[] = [];

  for (const s of sessions) {
    entries.push({
      type: "session",
      id: s.id,
      date: s.started_at,
      session: s,
    });
  }

  for (const m of maintenance) {
    entries.push({
      type: "maintenance",
      id: m.id,
      date: m.created_at,
      maintenance: m,
    });
  }

  entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return entries.slice(0, limit);
}
