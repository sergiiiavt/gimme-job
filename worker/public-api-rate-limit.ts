export type PublicApiRateLimitEnv = {
  DB?: D1Database;
  PUBLIC_AI_HOURLY_IP_LIMIT?: string;
  PUBLIC_AI_DAILY_GLOBAL_LIMIT?: string;
  PUBLIC_DB_HOURLY_IP_LIMIT?: string;
  PUBLIC_DB_DAILY_GLOBAL_LIMIT?: string;
  TENANT_AI_HOURLY_IP_LIMIT?: string;
  TENANT_AI_DAILY_GLOBAL_LIMIT?: string;
};

type RouteGroup = "ai" | "database" | "tenant-ai" | "sync" | "register" | "login" | "websocket";
type LimitPolicy = {
  routeGroup: RouteGroup;
  ipLimit: number;
  /** Null when a shared ceiling would let one abuser lock every user out (sign-in). */
  globalLimit: number | null;
};

const DEFAULT_LIMITS: Record<RouteGroup, { ip: number; global: number | null }> = {
  ai: { ip: 30, global: 1_000 },
  database: { ip: 120, global: 5_000 },
  // Authenticated OpenAI-backed actions: one analyze call can score up to 100 vacancies.
  "tenant-ai": { ip: 20, global: 400 },
  // A forced catalogue crawl hits every upstream job board.
  sync: { ip: 12, global: 300 },
  // Account creation is open; this also bounds the legacy-password claim oracle.
  register: { ip: 10, global: 1_000 },
  // Spraying many accounts from one address; per-account limits live in password auth.
  login: { ip: 60, global: null },
  websocket: { ip: 60, global: 20_000 },
};

// Groups that spend money or hit upstream services fail closed when D1 is
// unavailable. Sign-in (the legacy single-user login needs no D1) and the
// cost-free relay stay available instead of turning D1 into a hard dependency.
const FAIL_OPEN_GROUPS: ReadonlySet<RouteGroup> = new Set(["login", "websocket"]);

type RouteGroupMatch = {
  method: string;
  paths: readonly string[];
  routeGroup: RouteGroup;
  /** Only callers presenting credentials can reach the cost; the auth gate rejects the rest for free. */
  credentialed?: boolean;
};

const ROUTE_GROUPS: RouteGroupMatch[] = [
  { method: "POST", paths: ["/api/ai/learning-path", "/api/ai/learning-path/stream", "/api/ai/interviews"], routeGroup: "ai" },
  { method: "POST", paths: ["/api/playgrounds/databases"], routeGroup: "database" },
  { method: "POST", paths: ["/api/analyze", "/api/analyze-resume"], routeGroup: "tenant-ai", credentialed: true },
  { method: "POST", paths: ["/api/sync", "/api/run"], routeGroup: "sync", credentialed: true },
  { method: "POST", paths: ["/register", "/workspace/register"], routeGroup: "register" },
  { method: "POST", paths: ["/login", "/workspace/login"], routeGroup: "login" },
  { method: "GET", paths: ["/playgrounds/websocket/ws"], routeGroup: "websocket" },
];

const CREDENTIAL_COOKIES = ["gimmejob_user_session=", "gimmejob_session="];

function presentsCredentials(request: Request): boolean {
  if (request.headers.has("authorization")) return true;
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").some((part) => CREDENTIAL_COOKIES.some((name) => part.trim().startsWith(name)));
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function configuredLimits(routeGroup: RouteGroup, env: PublicApiRateLimitEnv): { ip?: string; global?: string } {
  if (routeGroup === "ai") return { ip: env.PUBLIC_AI_HOURLY_IP_LIMIT, global: env.PUBLIC_AI_DAILY_GLOBAL_LIMIT };
  if (routeGroup === "database") return { ip: env.PUBLIC_DB_HOURLY_IP_LIMIT, global: env.PUBLIC_DB_DAILY_GLOBAL_LIMIT };
  if (routeGroup === "tenant-ai") return { ip: env.TENANT_AI_HOURLY_IP_LIMIT, global: env.TENANT_AI_DAILY_GLOBAL_LIMIT };
  return {};
}

export function publicRateLimitPolicy(
  request: Request,
  env: PublicApiRateLimitEnv,
): LimitPolicy | null {
  const pathname = new URL(request.url).pathname;
  const match = ROUTE_GROUPS.find((group) => group.method === request.method && group.paths.includes(pathname));
  if (!match) return null;
  // Anonymous calls are answered 401 by the auth gate and must not drain the shared budget.
  if (match.credentialed && !presentsCredentials(request)) return null;

  const defaults = DEFAULT_LIMITS[match.routeGroup];
  const configured = configuredLimits(match.routeGroup, env);
  return {
    routeGroup: match.routeGroup,
    ipLimit: positiveInteger(configured.ip, defaults.ip),
    globalLimit: defaults.global === null ? null : positiveInteger(configured.global, defaults.global),
  };
}

function utcHourWindow(now: Date): { key: string; retryAfter: number } {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1_000);
  return {
    key: start.toISOString(),
    retryAfter: Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1_000)),
  };
}

function utcDayWindow(now: Date): { key: string; retryAfter: number } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1_000);
  return {
    key: start.toISOString(),
    retryAfter: Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1_000)),
  };
}

async function hashScopeKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function changes(result: unknown): number {
  const value = (result as { meta?: { changes?: unknown } })?.meta?.changes;
  return typeof value === "number" ? value : 0;
}

async function reserve(
  db: D1Database,
  windowStart: string,
  routeGroup: RouteGroup,
  scope: "IP" | "GLOBAL",
  scopeKey: string,
  limit: number,
  now: string,
): Promise<boolean> {
  const result = await db.prepare(`INSERT INTO public_api_rate_limits (
    window_start, route_group, scope, scope_key, request_count, updated_at
  ) VALUES (?, ?, ?, ?, 1, ?)
  ON CONFLICT(window_start, route_group, scope, scope_key) DO UPDATE SET
    request_count = public_api_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  WHERE public_api_rate_limits.request_count < ?`)
    .bind(windowStart, routeGroup, scope, scopeKey, now, limit)
    .run();
  return changes(result) > 0;
}

async function release(
  db: D1Database,
  windowStart: string,
  routeGroup: RouteGroup,
  scope: "IP" | "GLOBAL",
  scopeKey: string,
): Promise<void> {
  await db.prepare(`UPDATE public_api_rate_limits
    SET request_count = CASE WHEN request_count > 0 THEN request_count - 1 ELSE 0 END,
        updated_at = ?
    WHERE window_start = ? AND route_group = ? AND scope = ? AND scope_key = ?`)
    .bind(new Date().toISOString(), windowStart, routeGroup, scope, scopeKey)
    .run();
}

function rejection(message: string, status: 429 | 503, retryAfter?: number): Response {
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (retryAfter) headers["retry-after"] = String(retryAfter);
  return Response.json({ error: message }, { status, headers });
}

export async function enforcePublicApiRateLimit(
  request: Request,
  env: PublicApiRateLimitEnv,
): Promise<Response | null> {
  const policy = publicRateLimitPolicy(request, env);
  if (!policy) return null;
  const failOpen = FAIL_OPEN_GROUPS.has(policy.routeGroup);
  if (!env.DB) return failOpen ? null : rejection("Public request throttling is temporarily unavailable.", 503);

  const now = new Date();
  const nowIso = now.toISOString();
  const hour = utcHourWindow(now);
  const day = utcDayWindow(now);
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const ipKey = await hashScopeKey(ip);

  try {
    if (!await reserve(env.DB, hour.key, policy.routeGroup, "IP", ipKey, policy.ipLimit, nowIso)) {
      return rejection("Too many requests. Try again later.", 429, hour.retryAfter);
    }

    if (policy.globalLimit === null) return null;
    if (!await reserve(env.DB, day.key, policy.routeGroup, "GLOBAL", "all", policy.globalLimit, nowIso)) {
      await release(env.DB, hour.key, policy.routeGroup, "IP", ipKey);
      return rejection("Service request limit reached. Try again later.", 429, day.retryAfter);
    }

    return null;
  } catch (error) {
    console.error("Public API rate-limit reservation failed", error);
    return failOpen ? null : rejection("Public request throttling is temporarily unavailable.", 503);
  }
}
