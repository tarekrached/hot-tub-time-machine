import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { loader } from "../app/routes/api.ha.summary";
import { haApiOptionsResponse, withHaApiNoStore } from "../workers/ha-api-response";
import { getHaHistory, getHaSummary } from "server/ha-summary";
import type { TestType } from "shared/types";

type Reading = { value_ppm: number; created_at: string };
type HistoryRow = Record<string, unknown> & {
  record_type: "addition" | "reading";
  id: number;
  created_at: string;
};

const accessTeamDomain = "access.example.test";
const accessAudience = "test-audience";
const accessIssuer = `https://${accessTeamDomain}`;
const accessJwksUrl = `https://${accessTeamDomain}/cdn-cgi/access/certs`;
const cacheControl = "private, no-store";

let privateKey: CryptoKey;
let originalFetch: typeof fetch;

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === accessJwksUrl) return Response.json({ keys: [publicJwk] });
    return originalFetch(input, init);
  });
});

afterAll(() => vi.unstubAllGlobals());

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

function createHistoryDb(history: HistoryRow[]) {
  return {
    prepare(query: string) {
      if (!query.includes("WITH history")) throw new Error("unexpected history query");
      let values: unknown[] = [];
      return {
        bind(...bound: unknown[]) {
          values = bound;
          return this;
        },
        async all<T>() {
          const [since, , cursorAt, , , cursorType, , cursorId, limit] = values as [
            string | null,
            string | null,
            string | null,
            string | null,
            string | null,
            "addition" | "reading" | null,
            "addition" | "reading" | null,
            number | null,
            number,
          ];
          const rows = history
            .filter((row) => {
              if (since && row.created_at < since) return false;
              if (!cursorAt || !cursorType || !cursorId) return true;
              return (
                row.created_at > cursorAt ||
                (row.created_at === cursorAt &&
                  (row.record_type > cursorType ||
                    (row.record_type === cursorType && row.id > cursorId)))
              );
            })
            .sort(
              (a, b) =>
                a.created_at.localeCompare(b.created_at) ||
                a.record_type.localeCompare(b.record_type) ||
                a.id - b.id
            )
            .slice(0, limit);
          return {
            results: rows as T[],
            success: true,
            meta: { last_row_id: 0, changes: 0 },
          };
        },
      };
    },
  } as unknown as D1Database;
}

async function createAccessToken({
  audience = accessAudience,
  issuer = accessIssuer,
  expirationTime = "1h",
  notBefore,
  signingKey = privateKey,
}: {
  audience?: string;
  issuer?: string;
  expirationTime?: string | number;
  notBefore?: string | number;
  signingKey?: CryptoKey;
} = {}) {
  const token = new SignJWT()
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setAudience(audience)
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expirationTime);
  if (notBefore !== undefined) token.setNotBefore(notBefore);
  return token.sign(signingKey);
}

async function accessHeaders(options?: Parameters<typeof createAccessToken>[0]) {
  return { "Cf-Access-Jwt-Assertion": await createAccessToken(options) };
}

function accessEnv(database: D1Database) {
  return {
    DB: database,
    ACCESS_TEAM_DOMAIN: accessTeamDomain,
    ACCESS_AUD: accessAudience,
  };
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

const historyDb = createHistoryDb([
  {
    record_type: "addition",
    id: 1,
    session_id: 1,
    test_type: null,
    phase: null,
    value_ppm: null,
    raw_drops: null,
    sample_size_ml: null,
    chemical: "borax",
    amount_oz: 1,
    created_at: "2026-01-01 10:00:00",
  },
  {
    record_type: "reading",
    id: 2,
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
    created_at: "2026-01-02 10:00:00",
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
    expect(summary.tests.bromine).toMatchObject({ days_since: 10, status: "overdue" });
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

  it("accepts a valid Access JWT and does not cache the summary", async () => {
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary", {
        headers: await accessHeaders(),
      }),
      context: { cloudflare: { env: accessEnv(db) } },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    await expect(response.json()).resolves.toMatchObject({
      tests: { ph: { status: expect.any(String) } },
    });
  });

  it("rejects missing Access headers and missing config without caching", async () => {
    const missingHeader = await loader({
      request: new Request("https://example.test/api/ha/summary"),
      context: { cloudflare: { env: accessEnv(db) } },
    });
    const missingTeam = await loader({
      request: new Request("https://example.test/api/ha/summary", {
        headers: await accessHeaders(),
      }),
      context: { cloudflare: { env: { ...accessEnv(db), ACCESS_TEAM_DOMAIN: "" } } },
    });
    const missingAudience = await loader({
      request: new Request("https://example.test/api/ha/summary", {
        headers: await accessHeaders(),
      }),
      context: { cloudflare: { env: { ...accessEnv(db), ACCESS_AUD: "" } } },
    });

    for (const response of [missingHeader, missingTeam, missingAudience]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    }
  });

  it("rejects wrong audience, issuer, expiry, not-before, and signature without caching", async () => {
    const wrongKey = await generateKeyPair("RS256");
    const tokens = await Promise.all([
      createAccessToken({ audience: "wrong-audience" }),
      createAccessToken({ issuer: "https://wrong.example.test" }),
      createAccessToken({ expirationTime: Math.floor(Date.now() / 1000) - 60 }),
      createAccessToken({ notBefore: Math.floor(Date.now() / 1000) + 60 }),
      createAccessToken({ signingKey: wrongKey.privateKey }),
    ]);

    const responses = await Promise.all(
      tokens.map((token) =>
        loader({
          request: new Request("https://example.test/api/ha/summary", {
            headers: { "Cf-Access-Jwt-Assertion": token },
          }),
          context: { cloudflare: { env: accessEnv(db) } },
        })
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    }
  });

  it("paginates equal-timestamp additions and readings without skipping or duplicating", async () => {
    const first = await getHaHistory(historyDb, { since: null, cursor: null, limit: 1 });
    const second = await getHaHistory(historyDb, {
      since: null,
      cursor: { created_at: "2026-01-01 10:00:00", record_type: "addition", id: 1 },
      limit: 1,
    });

    expect(first.history).toEqual([
      expect.objectContaining({ record_type: "addition", id: 1, chemical: "borax" }),
    ]);
    expect(first.next_cursor).toBe("2026-01-01 10:00:00|addition|1");
    expect(second.history).toEqual([
      expect.objectContaining({ record_type: "reading", id: 2, test_type: "ph" }),
    ]);
    expect(second.next_cursor).toBe("2026-01-01 10:00:00|reading|2");
  });

  it("filters history using since and parses a bounded history request", async () => {
    const history = await getHaHistory(historyDb, {
      since: "2026-01-02 00:00:00",
      cursor: null,
      limit: 200,
    });
    const response = await loader({
      request: new Request(
        "https://example.test/api/ha/summary?history=1&since=2026-01-02T00:00:00Z&limit=2",
        { headers: await accessHeaders() }
      ),
      context: { cloudflare: { env: accessEnv(historyDb) } },
    });

    expect(history.history).toEqual([
      expect.objectContaining({ record_type: "reading", id: 3, test_type: "bromine" }),
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    await expect(response.json()).resolves.toMatchObject({
      history: [{ record_type: "reading", id: 3, test_type: "bromine" }],
    });
  });

  it.each([
    "history=1&limit=501",
    "history=1&limit=",
    "history=1&since=",
    "history=1&cursor=",
    "history=1&since=2026-02-30",
    "history=1&cursor=2026-02-30%2010%3A00%3A00%7Creading%7C1",
    "history=1&cursor=2026-02-01%2024%3A00%3A00%7Creading%7C1",
    "history=1&cursor=2026-02-01%2010%3A00%3A00%7Creading%7C0",
    "history=1&cursor=not-a-cursor",
  ])("rejects malformed history query %s without caching it", async (query) => {
    const response = await loader({
      request: new Request(`https://example.test/api/ha/summary?${query}`, {
        headers: await accessHeaders(),
      }),
      context: { cloudflare: { env: accessEnv(historyDb) } },
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
  });

  it("marks framework 405s and OPTIONS responses as non-cacheable without a payload", async () => {
    const post = new Request("https://example.test/api/ha/summary", { method: "POST" });
    const frameworkResponse = withHaApiNoStore(post, new Response(null, { status: 405 }));
    const options = haApiOptionsResponse(
      new Request("https://example.test/api/ha/summary", { method: "OPTIONS" })
    );

    expect(frameworkResponse.status).toBe(405);
    expect(frameworkResponse.headers.get("Cache-Control")).toBe(cacheControl);
    expect(options).not.toBeNull();
    expect(options?.status).toBe(405);
    expect(options?.headers.get("Cache-Control")).toBe(cacheControl);
    await expect(options?.text()).resolves.toBe("");
  });

  it("hides database failures behind a generic non-cacheable response", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failingDb = {
      prepare() {
        throw new Error("D1 schema details");
      },
    } as unknown as D1Database;
    const response = await loader({
      request: new Request("https://example.test/api/ha/summary?history=1", {
        headers: await accessHeaders(),
      }),
      context: { cloudflare: { env: accessEnv(failingDb) } },
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    expect(body).toEqual({ error: "Internal server error" });
    expect(error).toHaveBeenCalledWith("Failed to load HA history", expect.any(Error));
    error.mockRestore();
  });
});
