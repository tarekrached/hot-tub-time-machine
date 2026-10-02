import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  DEFAULT_HISTORY_LIMIT,
  getHaHistory,
  getHaSummary,
  MAX_HISTORY_LIMIT,
  type HaHistoryCursor,
} from "server/ha-summary";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const jwksByTeamDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

type LoaderArgs = {
  request: Request;
  context: { cloudflare: { env: Env } };
};

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidSqliteUtcTimestamp(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match || !isValidCalendarDate(match[1])) return false;
  const [, , hour, minute, second] = match;
  return Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60;
}

function getJwks(teamDomain: string) {
  let jwks = jwksByTeamDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeamDomain.set(teamDomain, jwks);
  }
  return jwks;
}

async function hasValidAccessJwt(request: Request, env: Env): Promise<boolean> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.ACCESS_AUD?.trim();
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!teamDomain || !audience || !assertion) return false;

  try {
    await jwtVerify(assertion, getJwks(teamDomain), {
      algorithms: ["RS256"],
      audience,
      issuer: `https://${teamDomain}`,
    });
    return true;
  } catch {
    return false;
  }
}

function parseSince(value: string | null): string | null {
  if (value === null) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) || !isValidCalendarDate(value)
  ) {
    throw new Error("since must be an ISO date");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("since must be an ISO date");
  return date.toISOString().replace("T", " ").replace(".000Z", "");
}

function parseCursor(value: string | null): HaHistoryCursor | null {
  if (value === null) return null;
  const [createdAt, recordType, id, extra] = value.split("|");
  const parsedId = Number(id);
  if (
    extra !== undefined ||
    !isValidSqliteUtcTimestamp(createdAt || "") ||
    (recordType !== "addition" && recordType !== "reading") ||
    !/^[1-9]\d*$/.test(id || "") ||
    !Number.isSafeInteger(parsedId)
  ) {
    throw new Error("cursor is invalid");
  }
  return { created_at: createdAt, record_type: recordType, id: parsedId };
}

function parseLimit(value: string | null): number {
  if (value === null) return DEFAULT_HISTORY_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    throw new Error(`limit must be an integer from 1 to ${MAX_HISTORY_LIMIT}`);
  }
  return limit;
}

export async function loader({ request, context }: LoaderArgs) {
  const { env } = context.cloudflare;
  if (!(await hasValidAccessJwt(request, env))) {
    return new Response("Unauthorized", {
      status: 401,
      headers: NO_STORE_HEADERS,
    });
  }

  const params = new URL(request.url).searchParams;
  if (params.get("history") !== "1") {
    try {
      return jsonResponse(await getHaSummary(env.DB));
    } catch (error) {
      console.error("Failed to load HA summary", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  }

  let historyOptions;
  try {
    historyOptions = {
      since: parseSince(params.get("since")),
      cursor: parseCursor(params.get("cursor")),
      limit: parseLimit(params.get("limit")),
    };
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid history query" },
      400
    );
  }

  try {
    return jsonResponse(await getHaHistory(env.DB, historyOptions));
  } catch (error) {
    console.error("Failed to load HA history", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}
