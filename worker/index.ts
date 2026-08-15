/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { operationalError, safeErrorDetails } from "../app/api/_operational-log";

interface Env {
  ASSETS: Fetcher;
  APP_PASSWORD?: string;
  GRAFANA_READ_TOKEN?: string;
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

function hasValidGrafanaToken(request: Request, env: Env): boolean {
  if (!env.GRAFANA_READ_TOKEN) return false;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  return constantTimeEqual(token, env.GRAFANA_READ_TOKEN);
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

function handleObservabilityHealth(request: Request, env: Env): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "cache-control": "no-store",
      },
    });
  }

  if (!env.GRAFANA_READ_TOKEN) {
    return Response.json(
      { error: "Grafana access is not configured." },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (!hasValidGrafanaToken(request, env)) {
    return Response.json(
      { error: "Authentication required." },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": "Bearer",
        },
      },
    );
  }

  return Response.json(
    {
      status: "ok",
      service: "gimmejob",
      environment: "production",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

async function handleObservabilitySummary(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "cache-control": "no-store",
      },
    });
  }

  if (!env.GRAFANA_READ_TOKEN) {
    return Response.json(
      { error: "Grafana access is not configured." },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (!hasValidGrafanaToken(request, env)) {
    return Response.json(
      { error: "Authentication required." },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": "Bearer",
        },
      },
    );
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days");
  const rangeDays = daysParam === null ? 30 : (() => {
    if (!/^\d+$/.test(daysParam)) return Number.NaN;
    const value = Number(daysParam);
    return Number.isInteger(value) && value >= 1 && value <= 3650 ? value : Number.NaN;
  })();

  if (!Number.isInteger(rangeDays)) {
    return Response.json(
      { error: "days must be an integer between 1 and 3650." },
      {
        status: 400,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
  }

  const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
  let stage:
    | "overview"
    | "operations"
    | "sources"
    | "error_reasons"
    | "snapshots"
    | "current_snapshot"
    | "jobs_by_source" = "overview";

  try {
    stage = "overview";
    const overviewRow = await env.DB.prepare(`SELECT
      COUNT(*) AS operations,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS failures,
      SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) AS degraded,
      COALESCE(
        SUM(
          CASE
            WHEN event = 'job_sync' AND status = 'degraded' THEN 0
            WHEN event = 'job_sync' AND status = 'failure' THEN 1
            ELSE error_count
          END
        ),
        0
      ) AS errors,
      ROUND(AVG(duration_ms), 1) AS avg_duration_ms,
      MAX(
        CASE
          WHEN error_count > 0 OR status IN ('failure', 'degraded')
          THEN occurred_at
          ELSE NULL
        END
      ) AS last_error_at,
      MAX(
        CASE
          WHEN event = 'job_sync' AND status <> 'failure'
          THEN occurred_at
          ELSE NULL
        END
      ) AS last_successful_sync_at
    FROM observability_events
    WHERE occurred_at >= ?`).bind(from).first<Record<string, unknown>>();

    stage = "operations";
    const operationsResult = await env.DB.prepare(`SELECT
      substr(occurred_at, 1, 10) AS day,
      event,
      status,
      COUNT(*) AS operations,
      COALESCE(SUM(error_count), 0) AS error_count,
      ROUND(AVG(duration_ms), 1) AS avg_duration_ms,
      COALESCE(SUM(items_processed), 0) AS items_processed
    FROM observability_events
    WHERE occurred_at >= ?
      AND event <> 'job_source_sync'
    GROUP BY substr(occurred_at, 1, 10), event, status
    ORDER BY day ASC, event ASC, status ASC`).bind(from).all<Record<string, unknown>>();

    stage = "sources";
    const sourcesResult = await env.DB.prepare(`SELECT
      substr(occurred_at, 1, 10) AS day,
      source,
      status,
      COUNT(*) AS operations,
      COALESCE(SUM(error_count), 0) AS error_count,
      ROUND(AVG(duration_ms), 1) AS avg_duration_ms,
      COALESCE(SUM(items_processed), 0) AS items_processed
    FROM observability_events
    WHERE occurred_at >= ?
      AND event = 'job_source_sync'
    GROUP BY substr(occurred_at, 1, 10), source, status
    ORDER BY day ASC, source ASC, status ASC`).bind(from).all<Record<string, unknown>>();

    stage = "error_reasons";
    const errorReasonsResult = await env.DB.prepare(`SELECT
      substr(occurred_at, 1, 10) AS day,
      event,
      source,
      reason_code,
      http_status,
      SUM(
        CASE
          WHEN event = 'job_sync' AND status = 'failure' THEN 1
          ELSE error_count
        END
      ) AS occurrences
    FROM observability_events
    WHERE occurred_at >= ?
      AND reason_code IS NOT NULL
      AND NOT (event = 'job_sync' AND status = 'degraded')
    GROUP BY
      substr(occurred_at, 1, 10),
      event,
      source,
      reason_code,
      http_status
    ORDER BY
      day ASC,
      event ASC,
      source ASC,
      reason_code ASC,
      http_status ASC`).bind(from).all<Record<string, unknown>>();

    stage = "snapshots";
    const snapshotsResult = await env.DB.prepare(`WITH latest_per_day AS (
      SELECT substr(occurred_at, 1, 10) AS day, MAX(occurred_at) AS occurred_at
      FROM observability_snapshots
      WHERE occurred_at >= ?
      GROUP BY substr(occurred_at, 1, 10)
    )
    SELECT
      s.occurred_at,
      s.total_jobs,
      s.remote_jobs,
      s.reservation_jobs,
      s.analyzed_jobs,
      s.strong_jobs,
      s.possible_jobs,
      s.weak_jobs,
      s.rejected_jobs
    FROM observability_snapshots s
    INNER JOIN latest_per_day l ON l.occurred_at = s.occurred_at
    ORDER BY s.occurred_at ASC`).bind(from).all<Record<string, unknown>>();

    stage = "current_snapshot";
    const currentRow = await env.DB.prepare(`SELECT
      occurred_at,
      total_jobs,
      remote_jobs,
      reservation_jobs,
      analyzed_jobs,
      strong_jobs,
      possible_jobs,
      weak_jobs,
      rejected_jobs
    FROM observability_snapshots
    ORDER BY occurred_at DESC
    LIMIT 1`).first<Record<string, unknown>>();

    stage = "jobs_by_source";
    const jobsBySourceResult = await env.DB.prepare(`SELECT
      source,
      COUNT(*) AS count
    FROM jobs
    GROUP BY source
    ORDER BY count DESC, source ASC`).all<Record<string, unknown>>();

    const overview = {
      operations: Number(overviewRow?.operations ?? 0),
      failures: Number(overviewRow?.failures ?? 0),
      degraded: Number(overviewRow?.degraded ?? 0),
      errors: Number(overviewRow?.errors ?? 0),
      avgDurationMs: overviewRow?.avg_duration_ms === null || overviewRow?.avg_duration_ms === undefined ? null : Number(overviewRow.avg_duration_ms),
      lastErrorAt: overviewRow?.last_error_at ? String(overviewRow.last_error_at) : null,
      lastSuccessfulSyncAt: overviewRow?.last_successful_sync_at ? String(overviewRow.last_successful_sync_at) : null,
    };

    return Response.json({
      service: "gimmejob",
      environment: "production",
      generatedAt: new Date().toISOString(),
      rangeDays,
      overview,
      current: currentRow ? {
        occurredAt: String(currentRow.occurred_at),
        totalJobs: Number(currentRow.total_jobs ?? 0),
        remoteJobs: Number(currentRow.remote_jobs ?? 0),
        reservationJobs: Number(currentRow.reservation_jobs ?? 0),
        analyzedJobs: Number(currentRow.analyzed_jobs ?? 0),
        strongJobs: Number(currentRow.strong_jobs ?? 0),
        possibleJobs: Number(currentRow.possible_jobs ?? 0),
        weakJobs: Number(currentRow.weak_jobs ?? 0),
        rejectedJobs: Number(currentRow.rejected_jobs ?? 0),
      } : null,
      operations: operationsResult.results.map((row) => ({
        day: String(row.day),
        event: String(row.event),
        status: String(row.status),
        operations: Number(row.operations ?? 0),
        errorCount: Number(row.error_count ?? 0),
        avgDurationMs: row.avg_duration_ms === null || row.avg_duration_ms === undefined ? null : Number(row.avg_duration_ms),
        itemsProcessed: Number(row.items_processed ?? 0),
      })),
      sources: sourcesResult.results.map((row) => ({
        day: String(row.day),
        source: row.source ? String(row.source) : "unknown",
        status: String(row.status),
        operations: Number(row.operations ?? 0),
        errorCount: Number(row.error_count ?? 0),
        avgDurationMs: row.avg_duration_ms === null || row.avg_duration_ms === undefined ? null : Number(row.avg_duration_ms),
        itemsProcessed: Number(row.items_processed ?? 0),
      })),
      errorReasons: errorReasonsResult.results.map((row) => ({
        day: String(row.day),
        event: String(row.event),
        source: row.source === null || row.source === undefined ? null : String(row.source),
        reasonCode: String(row.reason_code),
        httpStatus: row.http_status === null || row.http_status === undefined ? null : Number(row.http_status),
        occurrences: Number(row.occurrences ?? 0),
      })),
      snapshots: snapshotsResult.results.map((row) => ({
        occurredAt: String(row.occurred_at),
        totalJobs: Number(row.total_jobs ?? 0),
        remoteJobs: Number(row.remote_jobs ?? 0),
        reservationJobs: Number(row.reservation_jobs ?? 0),
        analyzedJobs: Number(row.analyzed_jobs ?? 0),
        strongJobs: Number(row.strong_jobs ?? 0),
        possibleJobs: Number(row.possible_jobs ?? 0),
        weakJobs: Number(row.weak_jobs ?? 0),
        rejectedJobs: Number(row.rejected_jobs ?? 0),
      })),
      jobsBySource: jobsBySourceResult.results.map((row) => ({
        source: String(row.source),
        count: Number(row.count ?? 0),
      })),
    }, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const details = safeErrorDetails(error, "database_error");
    operationalError("observability_summary", {
      phase: "query",
      outcome: "failure",
      stage,
      ...details,
    });
    return Response.json(
      { error: "Observability data unavailable." },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

function privateCookie(value: string, maxAge: number): string {
  return `${PRIVATE_SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function privateNextPath(url: URL): string {
  const requested = url.searchParams.get("next");
  if (!requested || !requested.startsWith("/workspace") || requested.startsWith("//") || requested.includes("\\")) return "/workspace";
  const parsed = new URL(requested, "https://gimmejob.invalid");
  return parsed.origin === "https://gimmejob.invalid" ? `${parsed.pathname}${parsed.search}` : "/workspace";
}

function loginPage(options: { error?: boolean; configured?: boolean; nextPath?: string; status?: number } = {}): Response {
  const configured = options.configured ?? true;
  const nextPath = options.nextPath ?? "/workspace";
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
    <p>Enter the password to open your personal jobs and interview-learning progress.</p>
    ${message}
    <form method="post" action="/workspace/login?next=${encodeURIComponent(nextPath)}">
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
  const nextPath = privateNextPath(new URL(request.url));
  if (request.method === "GET" || request.method === "HEAD") {
    if (await hasPrivateAccess(request, env)) {
      return new Response(null, { status: 303, headers: { location: nextPath } });
    }
    return loginPage({ configured: Boolean(env.APP_PASSWORD), nextPath, status: env.APP_PASSWORD ? 200 : 503 });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405, headers: { allow: "GET, HEAD, POST" } });
  }
  if (!env.APP_PASSWORD) return loginPage({ configured: false, nextPath, status: 503 });

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
    return loginPage({ error: true, nextPath, status: 400 });
  }

  if (!constantTimeEqual(submittedPassword, env.APP_PASSWORD)) {
    return loginPage({ error: true, nextPath, status: 401 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + PRIVATE_SESSION_SECONDS;
  const signature = await sessionSignature(expiresAt, env.APP_PASSWORD);
  return new Response(null, {
    status: 303,
    headers: {
      location: nextPath,
      "set-cookie": privateCookie(`${expiresAt}.${signature}`, PRIVATE_SESSION_SECONDS),
    },
  });
}

function isPrivateRequest(request: Request, url: URL): boolean {
  // The vacancy workspace itself is viewable without a password (analysis/resume results are
  // public); only status tracking and every write action stay password-gated below it and via
  // the private-API allowlist. Deeper paths (e.g. /workspace/learn, personal study progress)
  // remain fully private.
  if (url.pathname === "/workspace") return false;
  if (url.pathname.startsWith("/workspace/")) return true;
  if (!url.pathname.startsWith("/api/")) return false;

  const isRead = request.method === "GET" || request.method === "HEAD";
  const isPublicApi = url.pathname === "/api/health" || url.pathname === "/api/public/jobs" || url.pathname === "/api/dashboard";
  return !(isRead && isPublicApi);
}

// /workspace is viewable by anyone (see isPrivateRequest above) but is still a personal app
// surface, never meant for search engines or shared caches — so it keeps the no-store/noindex
// treatment regardless of whether the visitor is authenticated.
function isWorkspaceSurface(url: URL): boolean {
  return url.pathname === "/workspace" || url.pathname.startsWith("/workspace/");
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

    if (url.pathname === "/api/observability/health") {
      return handleObservabilityHealth(request, env);
    }

    if (url.pathname === "/api/observability/summary") {
      return handleObservabilitySummary(request, env);
    }

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
    // Computed unconditionally (not just when the route itself requires it) so the app can tell
    // an authenticated owner from an anonymous visitor on routes that are public to view but
    // still gate write/cost actions (sync, analyze, status edits) behind the password.
    const authenticated = await hasPrivateAccess(request, env);
    if (privateRequest && !authenticated) {
      if (url.pathname === "/workspace" || url.pathname.startsWith("/workspace/")) {
        const next = `${url.pathname}${url.search}`;
        const location = next === "/workspace" ? "/workspace/login" : `/workspace/login?next=${encodeURIComponent(next)}`;
        return new Response(null, { status: 303, headers: { location } });
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

    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("x-gimmejob-authenticated", authenticated ? "1" : "0");
    const forwardedRequest = new Request(request, { headers: forwardedHeaders });

    const response = await handler.fetch(forwardedRequest, env, ctx);
    if (!privateRequest && !isWorkspaceSurface(url)) return response;

    const privateResponse = new Response(response.body, response);
    privateResponse.headers.set("cache-control", "no-store");
    privateResponse.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return privateResponse;
  },
};

export default worker;
