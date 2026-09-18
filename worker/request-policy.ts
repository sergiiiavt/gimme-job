/** Canonical HTTP request classification shared by the Worker entry point and auth boundary. */

const PUBLIC_EPHEMERAL_AI_METHODS = new Map<string, ReadonlySet<string>>([
  ["/api/ai/learning-path", new Set(["POST"])],
  ["/api/ai/learning-path/stream", new Set(["POST"])],
  ["/api/ai/interviews", new Set(["GET", "POST"])],
]);

export const N8N_SERVICE_PATHS = new Set([
  "/internal/n8n/email-events",
  "/internal/n8n/email-classify",
  "/internal/n8n/email-resolve",
  "/internal/n8n/email-stats",
  "/internal/n8n/vacancies-sync",
]);

export function isPublicAiEndpoint(request: Request, url = new URL(request.url)): boolean {
  return PUBLIC_EPHEMERAL_AI_METHODS.get(url.pathname)?.has(request.method) === true;
}

export function withPublicAiSessionScope(request: Request): Request {
  if (!isPublicAiEndpoint(request)) return request;
  const headers = new Headers(request.headers);
  headers.set("x-gimmejob-session-scope", "ephemeral");
  return new Request(request, { headers });
}

export function isPublicEphemeralAiRequest(request: Request, url = new URL(request.url)): boolean {
  return request.headers.get("x-gimmejob-session-scope") === "ephemeral" && isPublicAiEndpoint(request, url);
}

export function isWorkspaceSurface(url: URL): boolean {
  return url.pathname === "/workspace" || url.pathname.startsWith("/workspace/");
}

export function isPrivateRequest(request: Request, url = new URL(request.url)): boolean {
  if (url.pathname === "/workspace") return false;
  if (["/login", "/register", "/workspace/login", "/workspace/register"].includes(url.pathname)) return false;
  if (url.pathname.startsWith("/workspace/")) return true;
  if (!url.pathname.startsWith("/api/")) return false;
  if (isPublicEphemeralAiRequest(request, url)) return false;

  const isRead = request.method === "GET" || request.method === "HEAD";
  const isPublicApi = url.pathname === "/api/health" || url.pathname === "/api/public/jobs" || url.pathname === "/api/dashboard";
  return !(isRead && isPublicApi);
}
