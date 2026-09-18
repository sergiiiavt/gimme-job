const EPHEMERAL_SESSION_SCOPE = "ephemeral";

export const N8N_SERVICE_PATHS = new Set([
  "/internal/n8n/email-events",
  "/internal/n8n/email-classify",
  "/internal/n8n/email-resolve",
  "/internal/n8n/email-stats",
  "/internal/n8n/vacancies-sync",
]);

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=") || null;
  }
  return null;
}

export function isPublicAiEndpoint(request: Request, url = new URL(request.url)): boolean {
  if (url.pathname === "/api/ai/learning-path" || url.pathname === "/api/ai/learning-path/stream") {
    return request.method === "POST";
  }
  if (url.pathname === "/api/ai/interviews") {
    return request.method === "GET" || request.method === "POST";
  }
  return false;
}

export function withPublicAiSessionScope(request: Request): Request {
  const url = new URL(request.url);
  if (!isPublicAiEndpoint(request, url)) return request;
  const headers = new Headers(request.headers);
  headers.set("x-gimmejob-session-scope", EPHEMERAL_SESSION_SCOPE);
  return new Request(request, { headers });
}

export function isPublicEphemeralAiRequest(request: Request, url = new URL(request.url)): boolean {
  return request.headers.get("x-gimmejob-session-scope") === EPHEMERAL_SESSION_SCOPE
    && isPublicAiEndpoint(request, url);
}

export function isPrivateRequest(request: Request, url = new URL(request.url)): boolean {
  if (url.pathname === "/workspace") return false;
  if (["/login", "/register", "/workspace/login", "/workspace/register"].includes(url.pathname)) return false;
  if (url.pathname.startsWith("/workspace/")) return true;
  if (!url.pathname.startsWith("/api/")) return false;
  if (isPublicEphemeralAiRequest(request, url)) return false;

  const isRead = request.method === "GET" || request.method === "HEAD";
  const isPublicVacancyDetail = url.pathname.startsWith("/api/public/jobs/");
  const isPublicApi = url.pathname === "/api/health"
    || url.pathname === "/api/public/jobs"
    || isPublicVacancyDetail
    || url.pathname === "/api/dashboard";
  return !(isRead && isPublicApi);
}

export function isWorkspaceSurface(url: URL): boolean {
  return url.pathname === "/workspace" || url.pathname.startsWith("/workspace/");
}

export function isN8nServiceRequest(url: URL): boolean {
  return N8N_SERVICE_PATHS.has(url.pathname);
}
