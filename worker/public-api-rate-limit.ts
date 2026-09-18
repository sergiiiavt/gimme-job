export type PublicApiRateLimitEnv = {
  DB?: D1Database;
  PUBLIC_AI_HOURLY_IP_LIMIT?: string;
  PUBLIC_AI_DAILY_GLOBAL_LIMIT?: string;
  PUBLIC_DB_HOURLY_IP_LIMIT?: string;
  PUBLIC_DB_DAILY_GLOBAL_LIMIT?: string;
};

type RouteGroup = "ai" | "database";
type LimitPolicy = {
  routeGroup: RouteGroup;
  ipLimit: number;
  globalLimit: number;
};

const DEFAULT_LIMITS: Record<RouteGroup, { ip: number; global: number }> = {
  ai: { ip: 30, global: 1_000 },
  database: { ip: 120, global: 5_000 },
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function publicRateLimitPolicy(
  request: Request,
  env: PublicApiRateLimitEnv,
): LimitPolicy | null {
  if (request.method !== "POST") return null;
  const pathname = new URL(request.url).pathname;

  if (
    pathname === "/api/ai/learning-path"
    || pathname === "/api/ai/learning-path/stream"
    || pathname === "/api/ai/interviews"
  ) {
    return {
      routeGroup: "ai",
      ipLimit: positiveInteger(env.PUBLIC_AI_HOURLY_IP_LIMIT, DEFAULT_LIMITS.ai.ip),
      globalLimit: positiveInteger(env.PUBLIC_AI_DAILY_GLOBAL_LIMIT, DEFAULT_LIMITS.ai.global),
    };
  }

  if (pathname === "/api/playgrounds/databases") {
    return {
      routeGroup: "database",
      ipLimit: positiveInteger(env.PUBLIC_DB_HOURLY_IP_LIMIT, DEFAULT_LIMITS.database.ip),
      globalLimit: positiveInteger(env.PUBLIC_DB_DAILY_GLOBAL_LIMIT, DEFAULT_LIMITS.database.global),
    };
  }

  return null;
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
  if (!env.DB) return rejection("Public request throttling is temporarily unavailable.", 503);

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

    if (!await reserve(env.DB, day.key, policy.routeGroup, "GLOBAL", "all", policy.globalLimit, nowIso)) {
      await release(env.DB, hour.key, policy.routeGroup, "IP", ipKey);
      return rejection("Service request limit reached. Try again later.", 429, day.retryAfter);
    }

    return null;
  } catch (error) {
    console.error("Public API rate-limit reservation failed", error);
    return rejection("Public request throttling is temporarily unavailable.", 503);
  }
}
