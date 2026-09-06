/** Cloudflare Worker entry point with tenant auth and per-user email forwarding. */
import coreWorker from "./core";
import { handleForwardedEmail } from "./email-forwarding";
import { createMultiUserBoundary } from "./multi-user-boundary";
import {
  isWebSocketPlaygroundRequest,
  proxyWebSocketPlayground,
} from "./websocket-playground-proxy";

function isAiAssistantApiRequest(request: Request): boolean {
  return new URL(request.url).pathname.startsWith("/api/ai/");
}

function withPublicAiSessionScope(request: Request): Request {
  if (!isAiAssistantApiRequest(request)) return request;
  const headers = new Headers(request.headers);
  headers.set("x-gimmejob-session-scope", "ephemeral");
  return new Request(request, { headers });
}

function isPublicEphemeralAiRequest(request: Request): boolean {
  return request.headers.get("x-gimmejob-session-scope") === "ephemeral" && isAiAssistantApiRequest(request);
}

// The multi-user boundary is the source of truth for browser authorization, but coreWorker still
// contains the legacy single-user password gate. AI Assistant requests are public by design, so the
// outer worker supplies an ephemeral session marker before the auth boundary and gives only those
// requests the per-request bridge credential required by the legacy core gate. Trusted multi-user
// identity headers remain unchanged, so signed-in interview users can still persist progress while
// anonymous users stay anonymous.
const boundaryAwareCore = {
  async fetch(
    request: Request,
    env: Parameters<typeof coreWorker.fetch>[1],
    ctx: Parameters<typeof coreWorker.fetch>[2],
  ): Promise<Response> {
    if (!isPublicEphemeralAiRequest(request) || !env.APP_PASSWORD) {
      return coreWorker.fetch(request, env, ctx);
    }

    const headers = new Headers(request.headers);
    headers.set("authorization", `Basic ${btoa(`gimmejob:${env.APP_PASSWORD}`)}`);
    return coreWorker.fetch(new Request(request, { headers }), env, ctx);
  },
};

const httpWorker = createMultiUserBoundary(boundaryAwareCore);
type HttpWorkerFetch = typeof httpWorker.fetch;
type HttpWorkerEnv = Parameters<HttpWorkerFetch>[1];
type HttpWorkerContext = Parameters<HttpWorkerFetch>[2];

function requiresFreshReferenceDocument(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return new URL(request.url).pathname.startsWith("/reference/");
}

function preventStaleReferenceCaching(response: Response): Response {
  const fresh = new Response(response.body, response);
  fresh.headers.set("cache-control", "no-cache, no-store, max-age=0, must-revalidate");
  fresh.headers.set("cdn-cache-control", "no-store");
  return fresh;
}

const worker = {
  async fetch(request: Request, env: HttpWorkerEnv, ctx: HttpWorkerContext): Promise<Response> {
    if (isWebSocketPlaygroundRequest(request)) {
      return proxyWebSocketPlayground(request);
    }

    const routedRequest = withPublicAiSessionScope(request);
    const response = await httpWorker.fetch(routedRequest, env, ctx);
    return requiresFreshReferenceDocument(request) ? preventStaleReferenceCaching(response) : response;
  },
  email: handleForwardedEmail,
};

export default worker;