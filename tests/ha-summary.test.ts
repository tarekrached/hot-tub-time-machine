import { describe, expect, it } from "vitest";
import { loader } from "../app/routes/api.ha.summary";
import { getHaHistory, getHaSummary } from "server/ha-summary";
import type { TestType } from "shared/types";

type Reading = { value_ppm: number; created_at: string };

function createDb(
  readings: Partial<Record<TestType, { latest: Reading; tested_at: string }>> = {},
  maintenance: Array<{ event_type: string; created_at: string }> = []
) {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...bound: unknown[]) {
          values = bound;
          return this;
        },
        async first<T>() {
          const reading = readings[values[0] as TestType];
          const result = query.includes("value_ppm")
            ? reading?.latest ?? null
            : reading ? { created_at: reading.tested_at } : null;
          return result as T | null;
        },
        async all<T>() {
          return {
            results: maintenance as T[],
            success: true,
            meta: { last_row_id: 0, changes: 0 },
          };
        },
      };
    },
  } as unknown as D1Database;
}

const db = createDb(
  {
    ph: {
      latest: { value_ppm: 7.7, created_at: "2026-02-08 10:03:00" },
      tested_at: "2026-02-08 10:02:00",
    },
    bromine: {
      latest: { value_ppm: 5.5, created_at: "2026-02-05 10:01:00" },
      tested_at: "2026-02-05 10:01:00",
    },
    ta: {
      latest: { value_ppm: 60, created_at: "2026-02-05 10:02:00" },
      tested_at: "2026-02-05 10:01:00",
    },
  },
  [{ event_type: "filter_change", created_at: "2026-02-10 09:00:00" }]
);

function createHistoryDb(history: Record<string, unknown>[]) {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all<T>() {
          return {
            results: history as T[],
            success: true,
            meta: { last_row_id: 0, changes: 0 },
          };
        },
      };
    },
  } as unknown as D1Database;
}

const historyDb = createHistoryDb([
  {
    record_type: "reading",
    id: 1,
    session_id: 1,
    test_type: "ph",
    phase: "before",
    value_ppm: 7.4,
    raw_drops: null,
    sample_size_ml: null,
    chemical: null,
    amount_oz: null,
    created_at: "2026-01-01 10:00:00",
  },
  {
    record_type: "addition",
    id: 2,
    session_id: 1,
    test_type: null,
    phase: null,
    value_ppm: null,
    raw_drops: null,
    sample_size_ml: null,
    chemical: "borax",
    amount_oz: 1,
    created_at: "2026-01-02 10:00:00",
  },
  {
    record_type: "reading",
    id: 3,
    session_id: 2,
    test_type: "bromine",
    phase: "after",
    value_ppm: 5,
    raw_drops: 4,
    sample_size_ml: 10,
    chemical: null,
    amount_oz: null,
    created_at: "2026-01-03 10:00:00",
  },
]);

describe("HA summary", () => {
  it("returns latest values and cadence states using before readings as the test time", async () => {
    const summary = await getHaSummary(db, new Date("2026-02-15T10:05:00Z"));

    expect(summary.tests.ph).toMatchObject({
      value: 7.7,
      reading_at: "2026-02-08 10:03:00",
      tested_at: "2026-02-08 10:02:00",
      days_since: 7,
      cadence_days: 7,
      status: "due",
    });
    expect(summary.tests.bromine).toMatchObject({
      days_since: 10,
      status: "overdue",
    });
    expect(summary.tests.ta).toMatchObject({ days_since: 10, status: "current" });
    expect(summary.tests.calcium).toMatchObject({
      value: null,
      tested_at: null,
      days_since: null,
      status: "never",
    });
    expect(summary.maintenance).toEqual([
      { event_type: "filter_change", created_at: "2026-02-10 09:00:00" },
    ]);
  });

  it("rejects requests without the configured bearer token", async () => {
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary"),
      context: { cloudflare: { env: { DB: db, HA_SUMMARY_TOKEN: "test-token" } } },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("rejects requests when the Worker secret is unset", async () => {
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary", {
        headers: { Authorization: "Bearer undefined" },
      }),
      context: {
        cloudflare: {
          env: { DB: db, HA_SUMMARY_TOKEN: undefined as unknown as string },
        },
      },
    });

    expect(response.status).toBe(401);
  });

  it("accepts the configured bearer token", async () => {
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary", {
        headers: { Authorization: "Bearer test-token" },
      }),
      context: { cloudflare: { env: { DB: db, HA_SUMMARY_TOKEN: "test-token" } } },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tests: { ph: { status: expect.any(String) } },
    });
  });

  it("returns paginated readings and additions in history mode", async () => {
    const history = await getHaHistory(
      historyDb,
      { since: null, cursor: null, limit: 2 },
      new Date("2026-02-15T10:05:00Z")
    );

    expect(history.history).toEqual([
      expect.objectContaining({ record_type: "reading", test_type: "ph", value_ppm: 7.4 }),
      expect.objectContaining({ record_type: "addition", chemical: "borax", amount_oz: 1 }),
    ]);
    expect(history.next_cursor).toBe("2026-01-02 10:00:00|addition|2");
  });

  it("parses a bounded history request after bearer authentication", async () => {
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary?history=1&limit=2", {
        headers: { Authorization: "Bearer test-token" },
      }),
      context: {
        cloudflare: { env: { DB: historyDb, HA_SUMMARY_TOKEN: "test-token" } },
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      history: [
        { record_type: "reading", test_type: "ph" },
        { record_type: "addition", chemical: "borax" },
      ],
      next_cursor: "2026-01-02 10:00:00|addition|2",
    });
  });

  it("rejects oversized history pages", async () => {
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary?history=1&limit=501", {
        headers: { Authorization: "Bearer test-token" },
      }),
      context: { cloudflare: { env: { DB: historyDb, HA_SUMMARY_TOKEN: "test-token" } } },
    });

    expect(response.status).toBe(400);
  });

  it("rejects non-ISO history dates", async () => {
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary?history=1&since=yesterday", {
        headers: { Authorization: "Bearer test-token" },
      }),
      context: { cloudflare: { env: { DB: historyDb, HA_SUMMARY_TOKEN: "test-token" } } },
    });

    expect(response.status).toBe(400);
  });
});
