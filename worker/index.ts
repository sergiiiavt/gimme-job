/** Cloudflare Worker entry point with tenant auth and per-user email forwarding. */
import coreWorker from "./core";
import { handleForwardedEmail } from "./email-forwarding";
import { createMultiUserBoundary } from "./multi-user-boundary";

const httpWorker = createMultiUserBoundary(coreWorker);
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
