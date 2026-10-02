import {
  DEFAULT_HISTORY_LIMIT,
  getHaHistory,
  getHaSummary,
  MAX_HISTORY_LIMIT,
  type HaHistoryCursor,
} from "server/ha-summary";

type LoaderArgs = {
  request: Request;
  context: { cloudflare: { env: Env } };
};

function parseSince(value: string | null): string | null {
  if (!value) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  ) {
    throw new Error("since must be an ISO date");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("since must be an ISO date");
  return date.toISOString().replace("T", " ").replace(".000Z", "");
}

function parseCursor(value: string | null): HaHistoryCursor | null {
  if (!value) return null;
  const [createdAt, recordType, id, extra] = value.split("|");
  if (
    extra !== undefined ||
    !createdAt ||
    (recordType !== "addition" && recordType !== "reading") ||
    !/^\d+$/.test(id || "")
  ) {
    throw new Error("cursor is invalid");
  }
  return { created_at: createdAt, record_type: recordType, id: Number(id) };
}

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_HISTORY_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_LIMIT) {
    throw new Error(`limit must be an integer from 1 to ${MAX_HISTORY_LIMIT}`);
  }
  return limit;
}

export async function loader({ request, context }: LoaderArgs) {
  const { env } = context.cloudflare;
  if (
    !env.HA_SUMMARY_TOKEN ||
    request.headers.get("Authorization") !== `Bearer ${env.HA_SUMMARY_TOKEN}`
  ) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  const params = new URL(request.url).searchParams;
  if (params.get("history") !== "1") {
    return Response.json(await getHaSummary(env.DB));
  }

  try {
    return Response.json(
      await getHaHistory(env.DB, {
        since: parseSince(params.get("since")),
        cursor: parseCursor(params.get("cursor")),
        limit: parseLimit(params.get("limit")),
      })
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid history query" },
      { status: 400 }
    );
  }
}
