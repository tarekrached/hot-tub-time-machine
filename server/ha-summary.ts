import {
  daysSince,
  getTestCadenceStatus,
  TEST_CADENCE_DAYS,
  type TestCadenceStatus,
} from "shared/chemistry";
import type { TestType } from "shared/types";

const TEST_TYPES: TestType[] = ["ph", "bromine", "ta", "calcium"];
export const DEFAULT_HISTORY_LIMIT = 200;
export const MAX_HISTORY_LIMIT = 500;

export interface HaTestSummary {
  value: number | null;
  reading_at: string | null;
  tested_at: string | null;
  days_since: number | null;
  cadence_days: number;
  status: TestCadenceStatus;
}

export interface HaSummary {
  generated_at: string;
  tests: Record<TestType, HaTestSummary>;
  maintenance: Array<{ event_type: string; created_at: string }>;
}

type HistoryRecordType = "addition" | "reading";

export type HaHistoryRecord =
  | {
      record_type: "reading";
      id: number;
      session_id: number;
      test_type: TestType;
      phase: "before" | "after";
      value_ppm: number;
      raw_drops: number | null;
      sample_size_ml: number | null;
      created_at: string;
    }
  | {
      record_type: "addition";
      id: number;
      session_id: number | null;
      chemical: string;
      amount_oz: number;
      created_at: string;
    };

export interface HaHistoryCursor {
  created_at: string;
  record_type: HistoryRecordType;
  id: number;
}

export interface HaHistoryOptions {
  since: string | null;
  cursor: HaHistoryCursor | null;
  limit: number;
}

export interface HaHistory {
  generated_at: string;
  history: HaHistoryRecord[];
  next_cursor: string | null;
}

type HaHistoryRow = {
  record_type: HistoryRecordType;
  id: number;
  session_id: number | null;
  test_type: TestType | null;
  phase: "before" | "after" | null;
  value_ppm: number | null;
  raw_drops: number | null;
  sample_size_ml: number | null;
  chemical: string | null;
  amount_oz: number | null;
  created_at: string;
};

export function encodeHistoryCursor(cursor: HaHistoryCursor): string {
  return `${cursor.created_at}|${cursor.record_type}|${cursor.id}`;
}

function toHistoryRecord(row: HaHistoryRow): HaHistoryRecord {
  if (row.record_type === "reading") {
    return {
      record_type: "reading",
      id: row.id,
      session_id: row.session_id as number,
      test_type: row.test_type as TestType,
      phase: row.phase as "before" | "after",
      value_ppm: row.value_ppm as number,
      raw_drops: row.raw_drops,
      sample_size_ml: row.sample_size_ml,
      created_at: row.created_at,
    };
  }

  return {
    record_type: "addition",
    id: row.id,
    session_id: row.session_id,
    chemical: row.chemical as string,
    amount_oz: row.amount_oz as number,
    created_at: row.created_at,
  };
}

export async function getHaSummary(
  db: D1Database,
  now = new Date()
): Promise<HaSummary> {
  const tests = {} as Record<TestType, HaTestSummary>;

  for (const testType of TEST_TYPES) {
    const [latestReading, lastTest] = await Promise.all([
      db
        .prepare(
          `SELECT value_ppm, created_at FROM test_readings
           WHERE test_type = ?
           ORDER BY created_at DESC, id DESC LIMIT 1`
        )
        .bind(testType)
        .first<{ value_ppm: number; created_at: string }>(),
      db
        .prepare(
          `SELECT created_at FROM test_readings
           WHERE test_type = ? AND phase = 'before'
           ORDER BY created_at DESC, id DESC LIMIT 1`
        )
        .bind(testType)
        .first<{ created_at: string }>(),
    ]);
    const testedAt = lastTest?.created_at ?? null;

    tests[testType] = {
      value: latestReading?.value_ppm ?? null,
      reading_at: latestReading?.created_at ?? null,
      tested_at: testedAt,
      days_since: daysSince(testedAt, now),
      cadence_days: TEST_CADENCE_DAYS[testType],
      status: getTestCadenceStatus(testType, testedAt, now),
    };
  }

  const maintenance = await db
    .prepare(
      `SELECT event_type, created_at FROM maintenance_events
       ORDER BY created_at DESC, id DESC LIMIT 10`
    )
    .all<{ event_type: string; created_at: string }>();

  return {
    generated_at: now.toISOString(),
    tests,
    maintenance: maintenance.results,
  };
}

export async function getHaHistory(
  db: D1Database,
  options: HaHistoryOptions,
  now = new Date()
): Promise<HaHistory> {
  const cursor = options.cursor;
  const result = await db
    .prepare(
      `WITH history AS (
        SELECT 'reading' AS record_type, id, session_id, test_type, phase,
               value_ppm, raw_drops, sample_size_ml, NULL AS chemical,
               NULL AS amount_oz, created_at
        FROM test_readings
        UNION ALL
        SELECT 'addition' AS record_type, id, session_id, NULL AS test_type,
               NULL AS phase, NULL AS value_ppm, NULL AS raw_drops,
               NULL AS sample_size_ml, chemical, amount_oz, created_at
        FROM chemical_additions
      )
      SELECT * FROM history
      WHERE (? IS NULL OR created_at >= ?)
        AND (? IS NULL OR created_at > ? OR (
          created_at = ? AND (record_type > ? OR (record_type = ? AND id > ?))
        ))
      ORDER BY created_at ASC, record_type ASC, id ASC
      LIMIT ?`
    )
    .bind(
      options.since,
      options.since,
      cursor?.created_at ?? null,
      cursor?.created_at ?? null,
      cursor?.created_at ?? null,
      cursor?.record_type ?? null,
      cursor?.record_type ?? null,
      cursor?.id ?? null,
      options.limit + 1
    )
    .all<HaHistoryRow>();

  const hasMore = result.results.length > options.limit;
  const rows = result.results.slice(0, options.limit);
  const history = rows.map(toHistoryRecord);
  const last = history.at(-1);

  return {
    generated_at: now.toISOString(),
    history,
    next_cursor:
      hasMore && last
        ? encodeHistoryCursor({
            created_at: last.created_at,
            record_type: last.record_type,
            id: last.id,
          })
        : null,
  };
}
