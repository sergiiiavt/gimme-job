/** Authentication boundary for the GimmeJob Cloudflare Worker. */
import coreWorker from "./core";
import {
  clearSessionCookie,
  deleteUserSession,
  multiUserEnabled,
  readUserSession,
  type MultiUserAuthEnv,
} from "../app/auth/google-oauth.ts";

type CoreEnv = Parameters<typeof coreWorker.fetch>[1];
type ExecutionContext = Parameters<typeof coreWorker.fetch>[2];
type Env = CoreEnv & MultiUserAuthEnv;

type AccessContext = {
  mode: "legacy" | "multi-user";
  authenticated: boolean;
  userId: string | null;
};

const BASIC_AUTH_USERNAME = "gimmejob";
const TRUSTED_AUTH_HEADERS = [
  "x-gimmejob-auth-mode",
  "x-gimmejob-user-id",
  "x-gimmejob-authenticated",
] as const;

function privateNextPath(url: URL): string {
  const requested = url.searchParams.get("next");
  if (!requested || !requested.startsWith("/workspace") || requested.startsWith("//") || requested.includes("\\")) {
    return "/workspace";
  }
  const parsed = new URL(requested, "https://gimmejob.invalid");
  return parsed.origin === "https://gimmejob.invalid" ? `${parsed.pathname}${parsed.search}` : "/workspace";
}

function isPrivateRequest(request: Request, url: URL): boolean {
  if (url.pathname === "/workspace") return false;
  if (url.pathname.startsWith("/workspace/")) return true;
  if (!url.pathname.startsWith("/api/")) return false;

  const isRead = request.method === "GET" || request.method === "HEAD";
  const isPublicApi = url.pathname === "/api/health" || url.pathname === "/api/public/jobs" || url.pathname === "/api/dashboard";
  return !(isRead && isPublicApi);
}

function isWorkspaceSurface(url: URL): boolean {
  return url.pathname === "/workspace" || url.pathname.startsWith("/workspace/");
}

function sanitizeIdentityHeaders(request: Request): Request {
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

function googleLoginLocation(nextPath: string): string {
  return `/auth/google/start?next=${encodeURIComponent(nextPath)}`;
}

async function multiUserAccess(request: Request, env: Env, url: URL): Promise<AccessContext> {
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

async function handleMultiUserLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { allow: "GET, HEAD, POST", "cache-control": "no-store" },
    });
  }

  const nextPath = privateNextPath(new URL(request.url));
  const user = await readUserSession(request, env);
  return new Response(null, {
    status: 303,
    headers: {
      location: user ? nextPath : googleLoginLocation(nextPath),
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

async function handleMultiUserLogout(request: Request, env: Env): Promise<Response> {
  await deleteUserSession(request, env);
  return new Response(null, {
    status: 303,
    headers: {
      location: "/",
      "set-cookie": clearSessionCookie(),
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // These endpoints use their own dedicated Bearer credential and never enter the app router.
    if (url.pathname === "/api/observability/health" || url.pathname === "/api/observability/summary") {
      return coreWorker.fetch(request, env, ctx);
    }

    const sanitizedRequest = sanitizeIdentityHeaders(request);
    if (!multiUserEnabled(env)) {
      // Preserve the current password-based production behavior while also refusing client-supplied
      // internal identity headers. Multi-user mode remains opt-in until Google OAuth is configured.
      return coreWorker.fetch(sanitizedRequest, env, ctx);
    }

    if (url.pathname === "/workspace/login") return handleMultiUserLogin(sanitizedRequest, env);
    if (url.pathname === "/workspace/logout") return handleMultiUserLogout(sanitizedRequest, env);

    const access = await multiUserAccess(sanitizedRequest, env, url);
    const privateRequest = isPrivateRequest(sanitizedRequest, url);
    if (privateRequest && !access.authenticated) {
      if (url.pathname.startsWith("/workspace/")) {
        const next = `${url.pathname}${url.search}`;
        return new Response(null, {
          status: 303,
          headers: {
            location: `/workspace/login?next=${encodeURIComponent(next)}`,
            "cache-control": "no-store",
            "x-robots-tag": "noindex, nofollow, noarchive",
          },
        });
      }
      return Response.json(
        { error: "Authentication required." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }

    // The existing core Worker still owns routing, image optimization, robots, observability, and
    // no-store/noindex behavior. A fresh per-request bridge credential lets it recognize a session
    // already authenticated here without exposing a reusable password to clients.
    const bridgePassword = randomBridgePassword();
    const forwardedRequest = authenticatedForwardRequest(sanitizedRequest, access, bridgePassword);
    const coreEnv = { ...env, APP_PASSWORD: bridgePassword } as Env;
    return coreWorker.fetch(forwardedRequest, coreEnv, ctx);
  },
};

export default worker;
