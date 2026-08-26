/** Cloudflare Worker entry point with tenant auth and per-user email forwarding. */
import coreWorker from "./core";
import { handleForwardedEmail } from "./email-forwarding";
import { createMultiUserBoundary } from "./multi-user-boundary";

function isPublicEphemeralAiRequest(request: Request): boolean {
  if (request.headers.get("x-gimmejob-session-scope") !== "ephemeral") return false;
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/ai/learning-path") return request.method === "POST";
  if (pathname === "/api/ai/interviews") return request.method === "GET" || request.method === "POST";
  return false;
}

// The multi-user boundary is the source of truth for browser authorization, but coreWorker still
// contains the legacy single-user password gate. Public ephemeral AI requests have already been
// explicitly admitted by the outer boundary; give only those requests the per-request bridge
// credential so the legacy core gate cannot reject them a second time. The trusted multi-user
// identity headers remain unchanged, so downstream routes still see anonymous users as anonymous.
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
    const response = await httpWorker.fetch(request, env, ctx);
    return requiresFreshReferenceDocument(request) ? preventStaleReferenceCaching(response) : response;
  },
  email: handleForwardedEmail,
};

export default worker;