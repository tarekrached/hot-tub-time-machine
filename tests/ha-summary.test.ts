import { describe, expect, it } from "vitest";
import { loader } from "../app/routes/api.ha.summary";
import { getHaSummary } from "server/ha-summary";
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
});
