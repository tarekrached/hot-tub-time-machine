import { createRequestHandler } from "react-router";
import { haApiOptionsResponse, withHaApiNoStore } from "./ha-api-response";

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  // @ts-expect-error - virtual module provided by React Router at build time
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const optionsResponse = haApiOptionsResponse(request);
    if (optionsResponse) return optionsResponse;

    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
    });
    return withHaApiNoStore(request, response);
  },
} satisfies ExportedHandler<Env>;
