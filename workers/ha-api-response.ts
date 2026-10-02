const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function isHaApiRequest(request: Request): boolean {
  return new URL(request.url).pathname.startsWith("/api/ha/");
}

export function haApiOptionsResponse(request: Request): Response | null {
  if (!isHaApiRequest(request) || request.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 405,
    headers: { ...NO_STORE_HEADERS, Allow: "GET, HEAD" },
  });
}

export function withHaApiNoStore(request: Request, response: Response): Response {
  if (!isHaApiRequest(request)) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
