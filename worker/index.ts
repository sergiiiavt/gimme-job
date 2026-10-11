/** Cloudflare Worker entry point with tenant auth and per-user email forwarding. */
import coreWorker from "./core";
import { handleForwardedEmail } from "./email-forwarding";
import { createMultiUserBoundary } from "./multi-user-boundary";
import { handleDatabasePlayground } from "../app/api/playgrounds/databases/route";
import {
  isWebSocketPlaygroundRequest,
  proxyWebSocketPlayground,
} from "./websocket-playground-proxy";
import { withPublicAiSessionScope } from "./request-policy";
import {
  enforcePublicApiRateLimit,
  type PublicApiRateLimitEnv,
} from "./public-api-rate-limit";
import { runVacancyCatalogBackstop } from "./vacancy-sync-backstop";
import { withSecurityHeaders } from "./security-headers";
import { SITE_ORIGIN } from "../app/seo";

const httpWorker = createMultiUserBoundary(coreWorker);
type HttpWorkerFetch = typeof httpWorker.fetch;
type HttpWorkerEnv = Parameters<HttpWorkerFetch>[1]
  & Parameters<typeof handleDatabasePlayground>[1]
  & PublicApiRateLimitEnv;
type HttpWorkerContext = Parameters<HttpWorkerFetch>[2];

const PRODUCTION_HOST = new URL(SITE_ORIGIN).host;

// Plain-HTTP production requests would otherwise be served as duplicate, insecure copies.
function httpsRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || url.host !== PRODUCTION_HOST) return null;
  url.protocol = "https:";
  return new Response(null, { status: 301, headers: { location: url.toString() } });
}

// The shared root layout renders <html lang="en">; Ukrainian documents must declare their own language.
function withDocumentLanguage(request: Request, response: Response): Response {
  const { pathname } = new URL(request.url);
  if (pathname !== "/uk" && !pathname.startsWith("/uk/")) return response;
  if (!/^text\/html\b/i.test(response.headers.get("content-type") ?? "") || typeof HTMLRewriter === "undefined") return response;
  return new HTMLRewriter()
    .on("html", { element(element) { element.setAttribute("lang", "uk"); } })
    .transform(response);
}

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
    const redirect = httpsRedirect(request);
    if (redirect) return redirect;

    const rateLimitResponse = await enforcePublicApiRateLimit(request, env);
    if (rateLimitResponse) return withSecurityHeaders(rateLimitResponse);

    if (isWebSocketPlaygroundRequest(request)) {
      return proxyWebSocketPlayground(request);
    }

    if (new URL(request.url).pathname === "/api/playgrounds/databases") {
      return withSecurityHeaders(await handleDatabasePlayground(request, env));
    }

    const routedRequest = withPublicAiSessionScope(request);
    const response = withDocumentLanguage(request, await httpWorker.fetch(routedRequest, env, ctx));
    return withSecurityHeaders(requiresFreshReferenceDocument(request) ? preventStaleReferenceCaching(response) : response);
  },
  scheduled(_controller: unknown, env: HttpWorkerEnv, ctx: HttpWorkerContext): void {
    ctx.waitUntil(
      runVacancyCatalogBackstop(env.DB)
        .then((result) => {
          console.log({
            schemaVersion: 1,
            service: "gimmejob",
            event: "vacancy_sync_backstop",
            outcome: result.started ? "started" : "skipped",
            reason: result.reason,
          });
        })
        .catch((error) => {
          console.error({
            schemaVersion: 1,
            service: "gimmejob",
            event: "vacancy_sync_backstop",
            outcome: "failure",
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }),
    );
  },
  email: handleForwardedEmail,
};

export default worker;
