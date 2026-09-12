import { stripDatabaseGuideComments } from "../../../playgrounds/databases/database-code-guide";

type DatabasePlaygroundEnv = {
  GIMMEJOB_AI_URL?: string;
  GIMMEJOB_AI_SERVICE_TOKEN?: string;
};

type JsonObject = Record<string, unknown>;
type Engine = "mysql" | "postgres" | "mongodb";
type Action = "query" | "schema" | "reset";

const MAX_SESSION_ID_LENGTH = 200;
const MAX_QUERY_LENGTH = 20_000;
const ALLOWED_ACTIONS = new Set<Action>(["query", "schema", "reset"]);
const ALLOWED_ENGINES = new Set<Engine>(["mysql", "postgres", "mongodb"]);
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: RESPONSE_HEADERS });
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function aiBaseUrl(env: DatabasePlaygroundEnv): URL | null {
  const configured = env.GIMMEJOB_AI_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    url.search = "";
    url.hash = "";
    let end = url.pathname.length;
    while (end > 0 && url.pathname[end - 1] === "/") end -= 1;
    url.pathname = url.pathname.slice(0, end) || "/";
    return url;
  } catch {
    return null;
  }
}

function validSessionId(value: string): boolean {
  return value.length >= 8 && value.length <= MAX_SESSION_ID_LENGTH && SESSION_ID_PATTERN.test(value);
}

function upstreamPath(action: Action, engine: Engine): string {
  return engine === "mongodb" ? `/mongo-lab/v1/${action}` : `/db-lab/v1/${action}`;
}

async function parseInput(request: Request): Promise<JsonObject | null> {
  try {
    const parsed = await request.json() as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : null;
  } catch {
    return null;
  }
}

async function proxyRequest(endpoint: URL, token: string, body: JsonObject): Promise<Response> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await response.json().catch(() => null) as unknown;
    const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as JsonObject : {};
    if (!response.ok) {
      const detail = text(payload.error, 2_000) || "Database playground request failed.";
      const status = response.status >= 400 && response.status < 600 ? response.status : 502;
      return json({ error: detail }, status);
    }
    return json(payload, response.status);
  } catch {
    return json({ error: "Database playground is temporarily unavailable." }, 502);
  }
}

export async function handleDatabasePlayground(request: Request, env: DatabasePlaygroundEnv): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });

  const input = await parseInput(request);
  if (!input) return json({ error: "Invalid request body." }, 400);

  const action = text(input.action, 20) as Action;
  const engine = text(input.engine, 20) as Engine;
  const sessionId = text(input.sessionId, MAX_SESSION_ID_LENGTH);
  if (!ALLOWED_ACTIONS.has(action)) return json({ error: "Unsupported database action." }, 400);
  if (!ALLOWED_ENGINES.has(engine)) return json({ error: "Unsupported database engine." }, 400);
  if (!validSessionId(sessionId)) return json({ error: "Invalid database lab session." }, 400);

  const rawQuery = action === "query" ? text(input.sql, MAX_QUERY_LENGTH + 1) : "";
  if (action === "query" && (!rawQuery || rawQuery.length > MAX_QUERY_LENGTH)) {
    return json({ error: "Query must be between 1 and 20,000 characters." }, 400);
  }
  const query = action === "query" ? stripDatabaseGuideComments(rawQuery) : "";
  if (action === "query" && !query) return json({ error: "Query must contain an executable statement." }, 400);

  const base = aiBaseUrl(env);
  const token = env.GIMMEJOB_AI_SERVICE_TOKEN?.trim();
  if (!base || !token) return json({ error: "Database playground service is not configured." }, 503);

  const endpoint = new URL(upstreamPath(action, engine).replace(/^\/+/, ""), base.href.endsWith("/") ? base : `${base.href}/`);
  if (endpoint.origin !== base.origin) return json({ error: "Database playground service configuration is invalid." }, 503);

  return proxyRequest(endpoint, token, { engine, sessionId, ...(action === "query" ? { sql: query } : {}) });
}

export async function POST(request: Request): Promise<Response> {
  const runtime = await import("cloudflare:workers");
  return handleDatabasePlayground(request, runtime.env as unknown as DatabasePlaygroundEnv);
}
