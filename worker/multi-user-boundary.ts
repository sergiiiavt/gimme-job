import {
  clearSessionCookie,
  deleteUserSession,
  multiUserEnabled,
  readUserSession,
  type MultiUserAuthEnv,
} from "../app/auth/google-oauth.ts";
import {
  handlePasswordLogin,
  handlePasswordRegister,
  type PasswordAuthEnv,
} from "../app/auth/password-auth.ts";

type BoundaryEnv = PasswordAuthEnv;

type CoreWorker<Env extends BoundaryEnv, Context> = {
  fetch(request: Request, env: Env, ctx: Context): Promise<Response>;
};

type AccessContext = {
  mode: "multi-user";
  authenticated: boolean;
  userId: string | null;
};

const BASIC_AUTH_USERNAME = "gimmejob";
const AUTH_RETURN_COOKIE = "gimmejob_auth_return";
const AUTH_RETURN_SECONDS = 10 * 60;
const N8N_SERVICE_PATHS = new Set([
  "/internal/n8n/email-events",
  "/internal/n8n/email-classify",
  "/internal/n8n/email-stats",
  "/internal/n8n/vacancies-sync",
]);
const TRUSTED_AUTH_HEADERS = [
  "x-gimmejob-auth-mode",
  "x-gimmejob-user-id",
  "x-gimmejob-authenticated",
] as const;
const CANONICAL_RETURN_PREFIXES = ["/ai-assistant/", "/learn/", "/reference/"];
const CANONICAL_RETURN_PATHS = new Set([
  "/ai-assistant",
  "/about",
  "/vacancies",
  "/resume",
  "/interview",
  "/interview/python",
  "/trends",
  "/news",
]);

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=") || null;
  }
  return null;
}

function authReturnCookie(path: string, maxAge = AUTH_RETURN_SECONDS): string {
  const value = maxAge > 0 ? encodeURIComponent(path) : "";
  return `${AUTH_RETURN_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function canonicalReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/vacancies";
  const parsed = new URL(value, "https://gimmejob.invalid");
  if (parsed.origin !== "https://gimmejob.invalid") return "/vacancies";
  if (CANONICAL_RETURN_PATHS.has(parsed.pathname) || CANONICAL_RETURN_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return parsed.pathname;
  }
  return "/vacancies";
}

function returnPathFromRequest(request: Request): string {
  const stored = readCookie(request, AUTH_RETURN_COOKIE);
  if (stored) {
    try {
      return canonicalReturnPath(decodeURIComponent(stored));
    } catch {
      return "/vacancies";
    }
  }
  const referrer = request.headers.get("referer");
  if (!referrer) return "/vacancies";
  try {
    const current = new URL(request.url);
    const source = new URL(referrer);
    if (source.origin !== current.origin) return "/vacancies";
    return canonicalReturnPath(source.pathname);
  } catch {
    return "/vacancies";
  }
}

function legacyCanonicalPath(url: URL): string | null {
  if (url.pathname === "/reference/qa-fundamentals") {
    const topics = url.searchParams.getAll("topic");
    const keys = [...new Set(url.searchParams.keys())];
    if (topics.length === 1 && topics[0].trim() && keys.length === 1 && keys[0] === "topic") {
      return `/learn/qa-fundamentals?topic=${encodeURIComponent(topics[0].trim())}`;
    }
  }

  const direct: Record<string, string> = {
    "/workspace": "/vacancies",
    "/learn/about": "/about",
    "/learn/resume": "/resume",
    "/learn/interview": "/interview",
    "/learn/trends": "/trends",
    "/learn/news": "/news",
    "/workspace/learn/qa-fundamentals": "/learn/qa-fundamentals",
    "/workspace/learn/programming": "/learn/programming",
    "/workspace/learn/automation": "/learn/automation",
    "/workspace/learn/cloud-devops": "/learn/cloud-devops",
    "/workspace/learn/testing-tools": "/learn/testing-tools",
    "/workspace/learn/metrics-estimation": "/learn/metrics-estimation",
  };
  if (direct[url.pathname]) return direct[url.pathname];
  if (url.pathname !== "/workspace/learn") return null;
  const section = url.searchParams.get("section");
  const sectionRoutes: Record<string, string> = {
    about: "/about",
    resume: "/resume",
    interview: "/interview",
    "python-interview": "/interview/python",
    trends: "/trends",
    certifications: "/learn/certifications",
    strategy: "/learn/strategy",
    programming: "/learn/programming",
    automation: "/learn/automation",
    api: "/learn/api",
    data: "/learn/data",
    mobile: "/learn/mobile",
    embedded: "/learn/embedded",
    performance: "/learn/performance",
    security: "/learn/security",
    devops: "/learn/cloud-devops",
    observability: "/learn/observability",
    networking: "/learn/networking",
    linux: "/learn/linux",
    llm: "/learn/llm",
    agentic: "/learn/agentic",
    standards: "/learn/standards",
    news: "/news",
  };
  return section ? sectionRoutes[section] ?? "/about" : "/about";
}

function redirectCanonical(location: string, status = 308): Response {
  return new Response(null, { status, headers: { location, "cache-control": "no-store" } });
}

export function privateNextPath(_url: URL): string {
  return "/vacancies";
}

function isPublicEphemeralAiRequest(request: Request, url: URL): boolean {
  if (request.headers.get("x-gimmejob-session-scope") !== "ephemeral") return false;
  if (url.pathname === "/api/ai/learning-path") return request.method === "POST";
  if (url.pathname === "/api/ai/interviews") return request.method === "GET" || request.method === "POST";
  return false;
}

export function isPrivateRequest(request: Request, url: URL): boolean {
  if (url.pathname === "/workspace") return false;
  if (["/login", "/register", "/workspace/login", "/workspace/register"].includes(url.pathname)) return false;
  if (url.pathname.startsWith("/workspace/")) return true;
  if (!url.pathname.startsWith("/api/")) return false;
  if (isPublicEphemeralAiRequest(request, url)) return false;

  const isRead = request.method === "GET" || request.method === "HEAD";
  const isPublicApi = url.pathname === "/api/health" || url.pathname === "/api/public/jobs" || url.pathname === "/api/dashboard";
  return !(isRead && isPublicApi);
}

function isWorkspaceSurface(url: URL): boolean {
  return url.pathname === "/workspace" || url.pathname.startsWith("/workspace/");
}

export function sanitizeIdentityHeaders(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const name of TRUSTED_AUTH_HEADERS) headers.delete(name);
  return new Request(request, { headers });
}

function randomBridgePassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bridgeAuthorization(password: string): string {
  return `Basic ${btoa(`${BASIC_AUTH_USERNAME}:${password}`)}`;
}

async function multiUserAccess(request: Request, env: MultiUserAuthEnv, url: URL): Promise<AccessContext> {
  const privateRequest = isPrivateRequest(request, url);
  const needsIdentity = privateRequest || isWorkspaceSurface(url) || url.pathname.startsWith("/api/");
  if (!needsIdentity) return { mode: "multi-user", authenticated: false, userId: null };

  const user = await readUserSession(request, env);
  return {
    mode: "multi-user",
    authenticated: Boolean(user),
    userId: user?.id ?? null,
  };
}

function authenticatedForwardRequest(request: Request, access: AccessContext, bridgePassword: string): Request {
  const headers = new Headers(request.headers);
  for (const name of TRUSTED_AUTH_HEADERS) headers.delete(name);
  headers.delete("authorization");
  headers.set("x-gimmejob-auth-mode", access.mode);
  headers.set("x-gimmejob-authenticated", access.authenticated ? "1" : "0");
  if (access.userId) headers.set("x-gimmejob-user-id", access.userId);
  if (access.authenticated) headers.set("authorization", bridgeAuthorization(bridgePassword));
  return new Request(request, { headers });
}

function legacyAuthRequest(request: Request, pathname: "/workspace/login" | "/workspace/register"): Request {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return new Request(url, request);
}

async function canonicalizeAuthResponse(response: Response, mode: "login" | "register", returnPath: string): Promise<Response> {
  if (response.status >= 300 && response.status < 400) {
    const redirected = new Response(response.body, response);
    redirected.headers.set("location", returnPath);
    redirected.headers.append("set-cookie", authReturnCookie("", 0));
    return redirected;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  const html = (await response.text())
    .replaceAll(`/workspace/${mode}`, `/${mode}`)
    .replace(/\/workspace\/(login|register)\?next=[^\"]+/g, (_match, target: string) => `/${target}`);
  const canonical = new Response(html, response);
  canonical.headers.append("set-cookie", authReturnCookie(returnPath));
  return canonical;
}

async function handleCanonicalAuth(request: Request, env: BoundaryEnv, mode: "login" | "register"): Promise<Response> {
  const returnPath = returnPathFromRequest(request);
  const legacyPath = mode === "login" ? "/workspace/login" : "/workspace/register";
  const response = mode === "login"
    ? await handlePasswordLogin(legacyAuthRequest(request, legacyPath), env)
    : await handlePasswordRegister(legacyAuthRequest(request, legacyPath), env);
  return canonicalizeAuthResponse(response, mode, returnPath);
}

async function handleMultiUserLogout(request: Request, env: BoundaryEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { allow: "POST", "cache-control": "no-store" },
    });
  }
  const returnPath = returnPathFromRequest(request);

  await deleteUserSession(request, env).catch((error) => console.error("Failed to delete user session during logout", error));

  return new Response(null, {
    status: 303,
    headers: {
      location: returnPath,
      "set-cookie": clearSessionCookie(),
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export function createMultiUserBoundary<Env extends BoundaryEnv, Context>(coreWorker: CoreWorker<Env, Context>) {
  return {
    async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === "/api/observability/health" || url.pathname === "/api/observability/summary") {
        return coreWorker.fetch(request, env, ctx);
      }

      const sanitizedRequest = sanitizeIdentityHeaders(request);

      // Scoped service-to-service n8n routes authenticate with N8N_INGEST_TOKEN.
      // Preserve their Authorization header instead of replacing it with the internal
      // Basic-auth bridge used for browser sessions in multi-user mode.
      if (N8N_SERVICE_PATHS.has(url.pathname)) {
        return coreWorker.fetch(sanitizedRequest, env, ctx);
      }

      // Keep legacy single-user mode untouched. Canonical URL collapsing belongs to
      // the multi-user browser surface where public and authenticated views share URLs.
      if (!multiUserEnabled(env)) return coreWorker.fetch(sanitizedRequest, env, ctx);

      // Keep old URLs working, but immediately collapse them to one query-free URL scheme.
      if (!["/workspace/login", "/workspace/register", "/workspace/logout"].includes(url.pathname)) {
        const canonical = legacyCanonicalPath(url);
        if (canonical) return redirectCanonical(canonical);
      }

      if (url.pathname === "/login") return handleCanonicalAuth(sanitizedRequest, env, "login");
      if (url.pathname === "/register") return handleCanonicalAuth(sanitizedRequest, env, "register");
      if (url.pathname === "/logout") return handleMultiUserLogout(sanitizedRequest, env);
      if (url.pathname === "/workspace/login") return redirectCanonical("/login");
      if (url.pathname === "/workspace/register") return redirectCanonical("/register");
      if (url.pathname === "/workspace/logout") return redirectCanonical("/logout");

      const access = await multiUserAccess(sanitizedRequest, env, url);
      const privateRequest = isPrivateRequest(sanitizedRequest, url);
      if (privateRequest && !access.authenticated) {
        if (url.pathname.startsWith("/workspace/")) return redirectCanonical("/login", 303);
        return Response.json(
          { error: "Authentication required." },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
      }

      const bridgePassword = randomBridgePassword();
      const forwardedRequest = authenticatedForwardRequest(sanitizedRequest, access, bridgePassword);
      const coreEnv = { ...env, APP_PASSWORD: bridgePassword } as Env;
      return coreWorker.fetch(forwardedRequest, coreEnv, ctx);
    },
  };
}
