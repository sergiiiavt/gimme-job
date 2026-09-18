type PublicSurface = "ai" | "database";

export type PublicAbuseLimitEnv = {
  DB: D1Database;
  PUBLIC_AI_RATE_LIMIT_PER_MINUTE?: string;
  PUBLIC_AI_RATE_LIMIT_PER_DAY?: string;
  PUBLIC_AI_GLOBAL_LIMIT_PER_MINUTE?: string;
  PUBLIC_AI_GLOBAL_LIMIT_PER_DAY?: string;
  PUBLIC_DATABASE_RATE_LIMIT_PER_MINUTE?: string;
  PUBLIC_DATABASE_RATE_LIMIT_PER_DAY?: string;
  PUBLIC_DATABASE_GLOBAL_LIMIT_PER_MINUTE?: string;
  PUBLIC_DATABASE_GLOBAL_LIMIT_PER_DAY?: string;
};

type Policy = {
  perMinute: number;
  perDay: number;
  globalPerMinute: number;
  globalPerDay: number;
};

const DEFAULTS: Record<PublicSurface, Policy> = {
  ai: { perMinute: 30, perDay: 250, globalPerMinute: 600, globalPerDay: 5_000 },
  database: { perMinute: 60, perDay: 2_000, globalPerMinute: 1_200, globalPerDay: 25_000 },
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function policy(env: PublicAbuseLimitEnv, surface: PublicSurface): Policy {
  const defaults = DEFAULTS[surface];
  if (surface === "ai") {
    return {
      perMinute: positiveInteger(env.PUBLIC_AI_RATE_LIMIT_PER_MINUTE, defaults.perMinute),
      perDay: positiveInteger(env.PUBLIC_AI_RATE_LIMIT_PER_DAY, defaults.perDay),
      globalPerMinute: positiveInteger(env.PUBLIC_AI_GLOBAL_LIMIT_PER_MINUTE, defaults.globalPerMinute),
      globalPerDay: positiveInteger(env.PUBLIC_AI_GLOBAL_LIMIT_PER_DAY, defaults.globalPerDay),
    };
  }
  return {
    perMinute: positiveInteger(env.PUBLIC_DATABASE_RATE_LIMIT_PER_MINUTE, defaults.perMinute),
    perDay: positiveInteger(env.PUBLIC_DATABASE_RATE_LIMIT_PER_DAY, defaults.perDay),
    globalPerMinute: positiveInteger(env.PUBLIC_DATABASE_GLOBAL_LIMIT_PER_MINUTE, defaults.globalPerMinute),
    globalPerDay: positiveInteger(env.PUBLIC_DATABASE_GLOBAL_LIMIT_PER_DAY, defaults.globalPerDay),
  };
}

function minuteBucket(now: Date): string {
  return now.toISOString().slice(0, 16);
}

function dayBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function retryAfterSeconds(window: "minute" | "day", now: Date): number {
  if (window === "minute") return Math.max(1, 60 - now.getUTCSeconds());
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((tomorrow - now.getTime()) / 1000));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function increment(
  env: PublicAbuseLimitEnv,
  bucket: string,
  surface: PublicSurface,
  dimension: "ip" | "global",
  subjectHash: string,
  now: string,
): Promise<number> {
  const row = await env.DB.prepare(`INSERT INTO public_request_limits
      (bucket, surface, dimension, subject_hash, request_count, updated_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(bucket, surface, dimension, subject_hash)
    DO UPDATE SET
      request_count = public_request_limits.request_count + 1,
      updated_at = excluded.updated_at
    RETURNING request_count`)
    .bind(bucket, surface, dimension, subjectHash, now)
    .first<{ request_count: number }>();

  if (!row || !Number.isFinite(Number(row.request_count))) {
    throw new Error("Public request limiter did not return a counter.");
  }
  return Number(row.request_count);
}

function rejected(surface: PublicSurface, window: "minute" | "day", now: Date): Response {
  return Response.json(
    { error: `${surface === "ai" ? "AI" : "Database"} playground rate limit exceeded. Try again later.` },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(retryAfterSeconds(window, now)),
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export async function enforcePublicAbuseLimit(
  request: Request,
  env: PublicAbuseLimitEnv,
  surface: PublicSurface,
): Promise<Response | null> {
  const now = new Date();
  const nowIso = now.toISOString();
  const limits = policy(env, surface);
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const ipHash = await sha256(ip);

  try {
    const checks = [
      { window: "minute" as const, bucket: `minute:${minuteBucket(now)}`, dimension: "ip" as const, subject: ipHash, limit: limits.perMinute },
      { window: "minute" as const, bucket: `minute:${minuteBucket(now)}`, dimension: "global" as const, subject: "all", limit: limits.globalPerMinute },
      { window: "day" as const, bucket: `day:${dayBucket(now)}`, dimension: "ip" as const, subject: ipHash, limit: limits.perDay },
      { window: "day" as const, bucket: `day:${dayBucket(now)}`, dimension: "global" as const, subject: "all", limit: limits.globalPerDay },
    ];

    let globalDayCount = 0;
    for (const check of checks) {
      const count = await increment(env, check.bucket, surface, check.dimension, check.subject, nowIso);
      if (check.window === "day" && check.dimension === "global") globalDayCount = count;
      if (count > check.limit) return rejected(surface, check.window, now);
    }

    if (globalDayCount === 1) {
      const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare("DELETE FROM public_request_limits WHERE updated_at < ?").bind(cutoff).run();
    }
    return null;
  } catch (error) {
    console.error("Public request limiter failed", error);
    return Response.json(
      { error: "Public service is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
    );
  }
}
