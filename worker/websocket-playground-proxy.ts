export const WEBSOCKET_PLAYGROUND_PATH = "/playgrounds/websocket/ws";
const AI_WEBSOCKET_PLAYGROUND_URL = "https://ai.gimme-job.com/v1/playground/ws";

type Fetcher = (request: Request) => Promise<Response>;

export function isWebSocketPlaygroundRequest(request: Request): boolean {
  return new URL(request.url).pathname === WEBSOCKET_PLAYGROUND_PATH;
}

export async function proxyWebSocketPlayground(
  request: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const upgrade = request.headers.get("upgrade")?.toLowerCase();
  if (request.method !== "GET" || upgrade !== "websocket") {
    return new Response("WebSocket upgrade required.", {
      status: 426,
      headers: {
        "cache-control": "no-store",
        upgrade: "websocket",
      },
    });
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(AI_WEBSOCKET_PLAYGROUND_URL);
  targetUrl.search = incomingUrl.search;

  // Forward the WebSocket handshake, but never leak the site's session or
  // authorization credentials to the separate AI-service origin.
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete("x-gimmejob-auth-mode");
  headers.delete("x-gimmejob-authenticated");
  headers.delete("x-gimmejob-user-id");

  return fetcher(new Request(targetUrl, {
    method: "GET",
    headers,
    redirect: "manual",
  }));
}
