import { sqlite } from "https://esm.town/v/std/sqlite";
import type {
  TestSession,
  TestReading,
  ChemicalAddition,
  MaintenanceEvent,
  TestType,
  MaintenanceType,
  DashboardData,
  SessionDetail,
} from "../../shared/types.ts";
import { TEST_CADENCE_DAYS } from "../../shared/chemistry.ts";

function rowToObj<T>(columns: string[], values: any[]): T {
  const obj: any = {};
  columns.forEach((col, i) => {
    obj[col] = values[i];
  });
  return obj as T;
}

function resultToArray<T>(result: { columns: string[]; rows: any[][] }): T[] {
  return result.rows.map((row) => rowToObj<T>(result.columns, row));
}

// --- Sessions ---

export async function createSession(notes?: string): Promise<number> {
  const result = await sqlite.execute(
    `INSERT INTO test_sessions (notes) VALUES (?)`,
    [notes || null]
  );
  return result.lastInsertRowid as number;
}

export async function completeSession(id: number): Promise<void> {
  await sqlite.execute(
    `UPDATE test_sessions SET completed_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

export async function getSessions(limit = 20): Promise<SessionDetail[]> {
  const sessResult = await sqlite.execute(
    `SELECT * FROM test_sessions ORDER BY started_at DESC LIMIT ?`,
    [limit]
  );
  const sessions = resultToArray<TestSession>(sessResult);

  const details: SessionDetail[] = [];
  for (const s of sessions) {
    const readingsResult = await sqlite.execute(
      `SELECT * FROM test_readings WHERE session_id = ? ORDER BY created_at`,
      [s.id]
    );
    const additionsResult = await sqlite.execute(
      `SELECT * FROM chemical_additions WHERE session_id = ? ORDER BY created_at`,
      [s.id]
    );
    details.push({
      ...s,
      readings: resultToArray<TestReading>(readingsResult),
      additions: resultToArray<ChemicalAddition>(additionsResult),
    });
  }
  return details;
}

export async function getSession(id: number): Promise<SessionDetail | null> {
  const sessResult = await sqlite.execute(
    `SELECT * FROM test_sessions WHERE id = ?`,
    [id]
  );
  const sessions = resultToArray<TestSession>(sessResult);
  if (sessions.length === 0) return null;

  const s = sessions[0];
  const readingsResult = await sqlite.execute(
    `SELECT * FROM test_readings WHERE session_id = ? ORDER BY created_at`,
    [s.id]
  );
  const additionsResult = await sqlite.execute(
    `SELECT * FROM chemical_additions WHERE session_id = ? ORDER BY created_at`,
    [s.id]
  );
  return {
    ...s,
    readings: resultToArray<TestReading>(readingsResult),
    additions: resultToArray<ChemicalAddition>(additionsResult),
  };
}

// --- Readings ---

export async function addReading(
  sessionId: number,
  testType: TestType,
  phase: "before" | "after",
  valuePpm: number | null,
  rawDrops: number | null,
  sampleSizeMl: number | null
): Promise<number> {
  const result = await sqlite.execute(
    `INSERT INTO test_readings (session_id, test_type, phase, value_ppm, raw_drops, sample_size_ml)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, testType, phase, valuePpm, rawDrops, sampleSizeMl]
  );
  return result.lastInsertRowid as number;
}

// --- Chemical Additions ---

export async function addChemicalAddition(
  sessionId: number | null,
  chemical: string,
  amountOz: number
): Promise<number> {
  const result = await sqlite.execute(
    `INSERT INTO chemical_additions (session_id, chemical, amount_oz)
     VALUES (?, ?, ?)`,
    [sessionId, chemical, amountOz]
  );
  return result.lastInsertRowid as number;
}

// --- Maintenance ---

export async function addMaintenanceEvent(
  eventType: MaintenanceType,
  notes?: string
): Promise<number> {
  const result = await sqlite.execute(
    `INSERT INTO maintenance_events (event_type, notes) VALUES (?, ?)`,
    [eventType, notes || null]
  );
  return result.lastInsertRowid as number;
}

export async function getMaintenanceEvents(limit = 50): Promise<MaintenanceEvent[]> {
  const result = await sqlite.execute(
    `SELECT * FROM maintenance_events ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return resultToArray<MaintenanceEvent>(result);
}

// --- Dashboard ---

export async function getDashboardData(): Promise<DashboardData> {
  // Last test date per type
  const testTypes: TestType[] = ["ph", "bromine", "ta", "calcium"];
  const lastTests: Record<string, string | null> = {};

  for (const tt of testTypes) {
    const result = await sqlite.execute(
      `SELECT MAX(r.created_at) as last_date
       FROM test_readings r
       WHERE r.test_type = ? AND r.phase = 'before'`,
      [tt]
    );
    lastTests[tt] = result.rows[0]?.[0] || null;
  }

  // Last maintenance per type
  const maintTypes: MaintenanceType[] = ["filter_change", "water_change", "drain_refill"];
  const lastMaintenance: Record<string, string | null> = {};

  for (const mt of maintTypes) {
    const result = await sqlite.execute(
      `SELECT MAX(created_at) as last_date
       FROM maintenance_events
       WHERE event_type = ?`,
      [mt]
    );
    lastMaintenance[mt] = result.rows[0]?.[0] || null;
  }

  // Determine suggested tests
  const suggestedTests: TestType[] = [];
  const now = Date.now();
  for (const tt of testTypes) {
    const last = lastTests[tt];
    if (!last) {
      suggestedTests.push(tt);
    } else {
      const daysSince = (now - new Date(last + "Z").getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= TEST_CADENCE_DAYS[tt]) {
        suggestedTests.push(tt);
      }
    }
  }

  // Recent sessions
  const sessResult = await sqlite.execute(
    `SELECT * FROM test_sessions ORDER BY started_at DESC LIMIT 5`
  );
  const sessions = resultToArray<TestSession>(sessResult);
  const recentSessions = [];
  for (const s of sessions) {
    const readingsResult = await sqlite.execute(
      `SELECT * FROM test_readings WHERE session_id = ? ORDER BY created_at`,
      [s.id]
    );
    recentSessions.push({
      ...s,
      readings: resultToArray<TestReading>(readingsResult),
    });
  }

  return {
    lastTests: lastTests as Record<TestType, string | null>,
    lastMaintenance: lastMaintenance as Record<MaintenanceType, string | null>,
    suggestedTests,
    recentSessions,
  };
}
