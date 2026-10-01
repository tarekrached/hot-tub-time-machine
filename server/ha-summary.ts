import {
  daysSince,
  getTestCadenceStatus,
  TEST_CADENCE_DAYS,
  type TestCadenceStatus,
} from "shared/chemistry";
import type { TestType } from "shared/types";

const TEST_TYPES: TestType[] = ["ph", "bromine", "ta", "calcium"];

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
