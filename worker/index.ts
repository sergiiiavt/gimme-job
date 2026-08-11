/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  APP_PASSWORD?: string;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const BASIC_AUTH_USERNAME = "gimmejob";
const PRIVATE_SESSION_COOKIE = "gimmejob_session";
const PRIVATE_SESSION_SECONDS = 60 * 60 * 24 * 14;

function isTrustedDevelopmentHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "terminal.local"
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function readBasicCredentials(request: Request): { username: string; password: string } | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return null;

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function hasValidBasicCredentials(request: Request, password: string): boolean {
  const credentials = readBasicCredentials(request);
  return Boolean(
    credentials &&
    constantTimeEqual(credentials.username, BASIC_AUTH_USERNAME) &&
    constantTimeEqual(credentials.password, password)
  );
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=");
  }

  return null;
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sessionSignature(expiresAt: number, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(String(expiresAt)));
  return toBase64Url(new Uint8Array(signature));
}

async function hasValidSession(request: Request, password: string): Promise<boolean> {
  const token = readCookie(request, PRIVATE_SESSION_COOKIE);
  if (!token) return false;

  const separator = token.indexOf(".");
  if (separator < 1) return false;

  const expiresAt = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const expected = await sessionSignature(expiresAt, password);
  return constantTimeEqual(signature, expected);
}

async function hasPrivateAccess(request: Request, env: Env): Promise<boolean> {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (isTrustedDevelopmentHost(hostname)) return true;
  if (!env.APP_PASSWORD) return false;
  if (hasValidBasicCredentials(request, env.APP_PASSWORD)) return true;
  return hasValidSession(request, env.APP_PASSWORD);
}

function privateCookie(value: string, maxAge: number): string {
  return `${PRIVATE_SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function loginPage(options: { error?: boolean; configured?: boolean; status?: number } = {}): Response {
  const configured = options.configured ?? true;
  const message = configured
    ? options.error ? '<p class="error">Incorrect password.</p>' : ""
    : '<p class="error">Private access is not configured.</p>';
  const disabled = configured ? "" : " disabled";
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Private workspace — GimmeJob</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { align-items: center; background: #f5f6f3; color: #1e2925; display: flex; justify-content: center; margin: 0; min-height: 100vh; padding: 24px; }
    main { background: #fff; border: 1px solid #dfe4df; border-radius: 12px; box-shadow: 0 18px 45px rgba(28,39,35,.08); max-width: 420px; padding: 30px; width: 100%; }
    a { color: #43554b; font-size: 13px; text-decoration: none; }
    h1 { font-size: 28px; letter-spacing: -.04em; margin: 26px 0 8px; }
    p { color: #6d7771; font-size: 14px; line-height: 1.55; margin: 0 0 22px; }
    label { display: block; font-size: 12px; font-weight: 750; margin-bottom: 7px; }
    input { border: 1px solid #cfd6d0; border-radius: 7px; font: inherit; height: 44px; outline: none; padding: 0 12px; width: 100%; }
    input:focus { border-color: #557a39; box-shadow: 0 0 0 3px rgba(85,122,57,.12); }
    button { background: #1e2925; border: 0; border-radius: 7px; color: #fff; cursor: pointer; font: inherit; font-weight: 750; height: 44px; margin-top: 12px; width: 100%; }
    button:disabled { cursor: not-allowed; opacity: .45; }
    .error { background: #fff1ef; border: 1px solid #f1cfca; border-radius: 7px; color: #9a3f35; margin: 0 0 16px; padding: 10px 12px; }
  </style>
</head>
<body>
  <main>
    <a href="/">← Public site</a>
    <h1>Private workspace</h1>
    <p>Enter the password to manage vacancy statuses and feedback.</p>
    ${message}
    <form method="post" action="/workspace/login">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required${disabled}>
      <button type="submit"${disabled}>Sign in</button>
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

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET" || request.method === "HEAD") {
    if (await hasPrivateAccess(request, env)) {
      return new Response(null, { status: 303, headers: { location: "/workspace" } });
    }
    return loginPage({ configured: Boolean(env.APP_PASSWORD), status: env.APP_PASSWORD ? 200 : 503 });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD, POST" } });
  }
  if (!env.APP_PASSWORD) return loginPage({ configured: false, status: 503 });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return new Response("Request is too large.", { status: 413 });
  }

  let submittedPassword = "";
  try {
    const form = await request.formData();
    const value = form.get("password");
    submittedPassword = typeof value === "string" ? value : "";
  } catch {
    return loginPage({ error: true, status: 400 });
  }

  if (!constantTimeEqual(submittedPassword, env.APP_PASSWORD)) {
    return loginPage({ error: true, status: 401 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + PRIVATE_SESSION_SECONDS;
  const signature = await sessionSignature(expiresAt, env.APP_PASSWORD);
  return new Response(null, {
    status: 303,
    headers: {
      location: "/workspace",
      "set-cookie": privateCookie(`${expiresAt}.${signature}`, PRIVATE_SESSION_SECONDS),
    },
  });
}

function isPrivateRequest(request: Request, url: URL): boolean {
  if (url.pathname === "/workspace" || url.pathname.startsWith("/workspace/")) return true;
  if (!url.pathname.startsWith("/api/")) return false;

  const isRead = request.method === "GET" || request.method === "HEAD";
  const isPublicApi = url.pathname === "/api/health" || url.pathname === "/api/public/jobs";
  return !(isRead && isPublicApi);
}

function robotsResponse(url: URL): Response {
  return new Response([
    "User-agent: *",
    "Allow: /",
    "Disallow: /workspace",
    "Disallow: /api/",
    `Sitemap: ${url.origin}/sitemap.xml`,
    "",
  ].join("\n"), {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function sitemapResponse(url: URL): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url.origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n</urlset>\n`;
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/workspace/login") return handleLogin(request, env);
    if (url.pathname === "/workspace/logout") {
      return new Response(null, {
        status: 303,
        headers: {
          location: "/",
          "set-cookie": privateCookie("", 0),
        },
      });
    }

    const privateRequest = isPrivateRequest(request, url);
    if (privateRequest && !(await hasPrivateAccess(request, env))) {
      if (url.pathname === "/workspace" || url.pathname.startsWith("/workspace/")) {
        return new Response(null, { status: 303, headers: { location: "/workspace/login" } });
      }
      return Response.json(
        { error: env.APP_PASSWORD ? "Authentication required." : "Private access is not configured." },
        { status: env.APP_PASSWORD ? 401 : 503, headers: { "cache-control": "no-store" } },
      );
    }

    if (url.pathname === "/robots.txt") return robotsResponse(url);
    if (url.pathname === "/sitemap.xml") return sitemapResponse(url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    if (!privateRequest) return response;

    const privateResponse = new Response(response.body, response);
    privateResponse.headers.set("cache-control", "no-store");
    privateResponse.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return privateResponse;
  },
};

export default worker;
