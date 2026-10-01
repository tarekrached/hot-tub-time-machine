import { getHaSummary } from "server/ha-summary";

type LoaderArgs = {
  request: Request;
  context: { cloudflare: { env: Env } };
};

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

  return Response.json(await getHaSummary(env.DB));
}
