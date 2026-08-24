/** Cloudflare Worker entry point with tenant auth and per-user email forwarding. */
import coreWorker from "./core";
import { handleForwardedEmail } from "./email-forwarding";
import { createMultiUserBoundary } from "./multi-user-boundary";

const httpWorker = createMultiUserBoundary(coreWorker);
type HttpWorkerFetch = typeof httpWorker.fetch;
type HttpWorkerEnv = Parameters<HttpWorkerFetch>[1];
type HttpWorkerContext = Parameters<HttpWorkerFetch>[2];

const SITE_GATE_HOSTNAMES = new Set(["gimme-job.com", "www.gimme-job.com"]);
const SITE_GATE_LOGIN = "gimmejob";
const SITE_GATE_COOKIE = "gimmejob_site_gate";
const SITE_GATE_PATH = "/_site-gate";
const SITE_GATE_SESSION_SECONDS = 60 * 60 * 24 * 14;

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

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=") || null;
  }
  return null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function siteGateSignature(expiresAt: number, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`site-gate:${expiresAt}`));
  return toBase64Url(new Uint8Array(signature));
}

async function passwordMatches(submitted: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [submittedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(submitted)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(submittedDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function hasSiteGateSession(request: Request, password: string | undefined): Promise<boolean> {
  if (!password) return false;
  const token = readCookie(request, SITE_GATE_COOKIE);
  if (!token) return false;
  const separator = token.indexOf(".");
  if (separator < 1) return false;
  const expiresAt = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  return passwordMatches(signature, await siteGateSignature(expiresAt, password));
}

function siteGateCookie(value: string, maxAge: number): string {
  return `${SITE_GATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function safeSiteGateNextPath(url: URL): string {
  const requested = url.searchParams.get("next");
  if (!requested || !requested.startsWith("/") || requested.startsWith("//") || requested.includes("\\")) return "/";
  const parsed = new URL(requested, "https://gimmejob.invalid");
  return parsed.origin === "https://gimmejob.invalid" ? `${parsed.pathname}${parsed.search}` : "/";
}

function isSiteGateExemptPath(pathname: string): boolean {
  return pathname === SITE_GATE_PATH
    || pathname === "/api/health"
    || pathname.startsWith("/api/observability/")
    || pathname.startsWith("/internal/")
    || pathname.startsWith("/_vinext/")
    || pathname.startsWith("/.well-known/")
    || pathname.startsWith("/auth/")
    || pathname === "/mcp"
    || pathname.startsWith("/mcp/")
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml"
    || pathname === "/gimmejob-logo.png"
    || pathname === "/favicon.ico";
}

function shouldApplySiteGate(request: Request, url: URL): boolean {
  if (!SITE_GATE_HOSTNAMES.has(url.hostname.toLowerCase())) return false;
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return !isSiteGateExemptPath(url.pathname);
}

function siteGatePage(options: { configured: boolean; error?: boolean; nextPath: string; status?: number }): Response {
  const message = options.configured
    ? options.error ? '<p class="error">Invalid login or password.</p>' : ""
    : '<p class="error">Access is not configured.</p>';
  const disabled = options.configured ? "" : " disabled";
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>GimmeJob</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { background:#000; color:#fff; display:grid; margin:0; min-height:100vh; padding:24px; place-items:center; }
    main { width:min(100%,320px); }
    h1 { font-size:13px; font-weight:700; letter-spacing:.18em; margin:0 0 28px; text-transform:uppercase; }
    label { color:#8f8f8f; display:grid; font-size:11px; gap:7px; letter-spacing:.04em; margin-top:14px; text-transform:uppercase; }
    input { background:#050505; border:1px solid #292929; border-radius:6px; color:#fff; font:inherit; height:44px; outline:none; padding:0 12px; width:100%; }
    input:focus { border-color:#777; }
    button { background:#fff; border:0; border-radius:6px; color:#000; cursor:pointer; font:inherit; font-weight:700; height:44px; margin-top:20px; width:100%; }
    button:disabled { cursor:not-allowed; opacity:.4; }
    .error { color:#ff7777; font-size:12px; line-height:1.45; margin:0 0 16px; }
  </style>
</head>
<body>
  <main>
    <h1>GimmeJob</h1>
    ${message}
    <form method="post" action="${SITE_GATE_PATH}?next=${encodeURIComponent(options.nextPath)}">
      <label for="site-login">Login<input id="site-login" name="login" type="text" autocomplete="username" autofocus required${disabled}></label>
      <label for="site-password">Password<input id="site-password" name="password" type="password" autocomplete="current-password" required${disabled}></label>
      <button type="submit"${disabled}>Enter</button>
    </form>
  </main>
</body>
</html>`;

  return new Response(body, {
    status: options.status ?? 200,
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

async function handleSiteGateLogin(request: Request, env: HttpWorkerEnv): Promise<Response> {
  const nextPath = safeSiteGateNextPath(new URL(request.url));
  if (request.method !== "POST") {
    return new Response(null, { status: 303, headers: { location: "/", "cache-control": "no-store" } });
  }
  if (!env.APP_PASSWORD) return siteGatePage({ configured: false, nextPath, status: 503 });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return new Response("Request is too large.", { status: 413, headers: { "cache-control": "no-store" } });
  }

  let login = "";
  let password = "";
  try {
    const form = await request.formData();
    login = String(form.get("login") ?? "");
    password = String(form.get("password") ?? "");
  } catch {
    return siteGatePage({ configured: true, error: true, nextPath, status: 400 });
  }

  const validLogin = login === SITE_GATE_LOGIN;
  const validPassword = await passwordMatches(password, env.APP_PASSWORD);
  if (!validLogin || !validPassword) {
    return siteGatePage({ configured: true, error: true, nextPath, status: 401 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SITE_GATE_SESSION_SECONDS;
  const signature = await siteGateSignature(expiresAt, env.APP_PASSWORD);
  return new Response(null, {
    status: 303,
    headers: {
      location: nextPath,
      "cache-control": "no-store",
      "set-cookie": siteGateCookie(`${expiresAt}.${signature}`, SITE_GATE_SESSION_SECONDS),
    },
  });
}

const worker = {
  async fetch(request: Request, env: HttpWorkerEnv, ctx: HttpWorkerContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === SITE_GATE_PATH) return handleSiteGateLogin(request, env);

    if (shouldApplySiteGate(request, url) && !await hasSiteGateSession(request, env.APP_PASSWORD)) {
      const nextPath = `${url.pathname}${url.search}`;
      return siteGatePage({ configured: Boolean(env.APP_PASSWORD), nextPath, status: env.APP_PASSWORD ? 200 : 503 });
    }

    const response = await httpWorker.fetch(request, env, ctx);
    return requiresFreshReferenceDocument(request) ? preventStaleReferenceCaching(response) : response;
  },
  email: handleForwardedEmail,
};

export default worker;
