import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const { handleMcpRequest, MCP_TOOL_NAMES } = await import("../worker/mcp.ts");
const { default: interviewCatalog } = await import("../content/interview/catalog.ts");
const { default: pythonInterviewCatalog } = await import("../content/python-interview/catalog.ts");

type Json = Record<string, unknown>;

const VERSION = "2026-07-28";
const META = {
  "io.modelcontextprotocol/protocolVersion": VERSION,
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
};
const firstQuestion = interviewCatalog.questions[0];
const job = {
  id: "job-1",
  title: "Senior QA Automation Engineer",
  company: "Example",
  location: "Kyiv",
  remote: 0,
  source: "DOU",
  status: "NEW",
  tracked_status: "NEW",
  salary_text: null,
  posted_at: "2026-08-22T10:00:00.000Z",
  updated_at: "2026-08-22T10:00:00.000Z",
  discovered_at: "2026-08-22T10:00:00.000Z",
  url: "https://example.test/job-1",
  description: "Senior QA role with Python, Playwright, API testing and SQL.",
};
const queries: string[] = [];

class FakeStatement {
  private bindings: unknown[] = [];
  private readonly sql: string;

  constructor(sql: string) { this.sql = sql; }
  bind(...values: unknown[]) { this.bindings = values; return this; }

  async all<T>(): Promise<{ results: T[] }> {
    const normalized = this.sql.replace(/\s+/g, " ");
    queries.push(normalized);
    if (normalized.includes("FROM jobs AS j") || normalized.includes("FROM jobs ORDER BY id ASC")) {
      return { results: [job] as T[] };
    }
    if (normalized.includes("FROM interview_progress")) {
      return { results: [{ question_id: firstQuestion.id, status: "LEARNED", updated_at: "2026-08-22T11:00:00.000Z" }] as T[] };
    }
    throw new Error(`Unexpected all() query: ${normalized}; bindings=${JSON.stringify(this.bindings)}`);
  }

  async first<T>(): Promise<T | null> {
    queries.push(this.sql);
    return null;
  }
}

const env = { DB: { prepare(sql: string) { return new FakeStatement(sql); } } };

type Exchange = { status: number; headers: Headers; payload: Json | null };

async function post(body: unknown, headers: Record<string, string | undefined> = {}, init: RequestInit = {}): Promise<Exchange> {
  const definedHeaders = Object.fromEntries(Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const request = new Request("https://example.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...definedHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
  const response = await handleMcpRequest(request, env as never);
  const text = await response.text();
  return { status: response.status, headers: response.headers, payload: text ? JSON.parse(text) as Json : null };
}

/** Sends one request the way a 2026-07-28 client does: _meta in the body and the matching Streamable HTTP headers. */
async function rpc(method: string, params: Json = {}, options: { headers?: Record<string, string | undefined>; meta?: Json | null; id?: unknown } = {}) {
  const meta = options.meta === null ? undefined : { ...META, ...options.meta };
  const body = { jsonrpc: "2.0", id: options.id ?? 1, method, params: { ...params, ...(meta ? { _meta: meta } : {}) } };
  const toolName = method === "tools/call" && typeof params.name === "string" ? params.name : undefined;
  return post(body, {
    "mcp-protocol-version": VERSION,
    "mcp-method": method,
    ...(toolName ? { "mcp-name": toolName } : {}),
    ...options.headers,
  });
}

function result(exchange: Exchange): Json {
  assert.equal(exchange.status, 200, JSON.stringify(exchange.payload));
  return exchange.payload?.result as Json;
}
function rpcError(exchange: Exchange): Json {
  return exchange.payload?.error as Json;
}
function structuredContent(exchange: Exchange): Json {
  return result(exchange).structuredContent as Json;
}

test("server/discover advertises the supported revision, capabilities, caching and server info", async () => {
  const discovered = await rpc("server/discover");
  const body = result(discovered);

  assert.equal(discovered.payload?.id, 1);
  assert.equal(body.resultType, "complete");
  assert.deepEqual(body.supportedVersions, [VERSION]);
  assert.deepEqual(body.capabilities, { tools: {} });
  assert.equal(typeof body.instructions, "string");
  assert.ok(Number.isInteger(body.ttlMs) && (body.ttlMs as number) > 0);
  assert.equal(body.cacheScope, "public");
  assert.deepEqual((body._meta as Json)["io.modelcontextprotocol/serverInfo"], { name: "gimmejob", version: "0.2.0" });
  assert.equal(discovered.headers.get("cache-control"), "no-store");
});

test("tools/list exposes exactly the four GimmeJob tools as a cacheable complete result", async () => {
  const body = result(await rpc("tools/list"));
  const tools = body.tools as Json[];

  assert.equal(body.resultType, "complete");
  assert.equal(body.cacheScope, "public");
  assert.ok(Number.isInteger(body.ttlMs) && (body.ttlMs as number) > 0);
  assert.deepEqual(tools.map((tool) => tool.name), [...MCP_TOOL_NAMES]);
  assert.deepEqual([...MCP_TOOL_NAMES], ["search_jobs", "get_interview_questions", "get_learning_progress", "analyze_vacancy"]);
  assert.ok(tools.every((tool) => (tool.inputSchema as Json).additionalProperties === false));
});

test("search_jobs degrades inside canonical RAG when Vectorize is unavailable", async () => {
  const exchange = await rpc("tools/call", { name: "search_jobs", arguments: { query: "Senior QA", limit: 5 } });
  const content = structuredContent(exchange);
  const jobs = content.jobs as Json[];

  assert.equal(result(exchange).resultType, "complete");
  assert.equal(result(exchange).isError, false);
  assert.equal(content.retrieval, "lexical-fallback");
  assert.equal(content.count, 1);
  assert.equal(jobs[0].id, "job-1");
  assert.equal(jobs[0].title, "Senior QA Automation Engineer");
  assert.equal(typeof jobs[0].retrievalScore, "number");
});

test("get_interview_questions can read the canonical Git-backed catalog without a query", async () => {
  const content = structuredContent(await rpc("tools/call", { name: "get_interview_questions", arguments: { limit: 2 } }));
  const questions = content.questions as Json[];

  assert.equal(content.retrieval, "catalog");
  assert.equal(content.count, 2);
  assert.equal(questions[0].id, firstQuestion.id);
  assert.equal(questions[0].track, "qa");
  assert.equal(typeof questions[0].answer, "string");
});

test("get_learning_progress returns persisted private-state shape and both interview corpus counts", async () => {
  const content = structuredContent(await rpc("tools/call", { name: "get_learning_progress", arguments: {} }));
  const counts = content.statusCounts as Record<string, number>;
  const items = content.items as Json[];

  assert.equal(content.scope, "interview_questions");
  assert.equal(content.totalQuestions, interviewCatalog.questions.length + pythonInterviewCatalog.questions.length);
  assert.equal(content.trackedQuestions, 1);
  assert.equal(counts.LEARNED, 1);
  assert.equal(items[0].questionId, firstQuestion.id);
  assert.equal(items[0].question, firstQuestion.question);
});

test("invalid tool arguments and failing tools are results with isError, not protocol errors", async () => {
  const invalid = result(await rpc("tools/call", { name: "search_jobs", arguments: { query: "", limit: 999 } }));
  assert.equal(invalid.resultType, "complete");
  assert.equal(invalid.isError, true);
  assert.match((invalid.content as Json[])[0].text as string, /Invalid tool arguments/);

  const unexpected = result(await rpc("tools/call", { name: "search_jobs", arguments: { query: "qa", unexpected: true } }));
  assert.equal(unexpected.isError, true);

  const missingJob = result(await rpc("tools/call", { name: "analyze_vacancy", arguments: { job_id: "missing" } }));
  assert.equal(missingJob.isError, true);
  assert.equal((missingJob.content as Json[])[0].text, "Job not found.");
});

test("an unknown tool is a JSON-RPC invalid-params error", async () => {
  const unknown = await rpc("tools/call", { name: "not_a_tool", arguments: {} });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.payload?.id, 1);
  assert.equal(rpcError(unknown).code, -32602);
  assert.match(rpcError(unknown).message as string, /Unknown tool: not_a_tool/);
  assert.equal(unknown.payload?.result, undefined);
});

test("an unsupported protocol version is refused with the versions the server does support", async () => {
  const old = await rpc("tools/list", {}, {
    meta: { "io.modelcontextprotocol/protocolVersion": "2025-06-18" },
    headers: { "mcp-protocol-version": "2025-06-18" },
  });
  assert.equal(old.status, 400);
  assert.equal(rpcError(old).code, -32022);
  assert.equal(rpcError(old).message, "Unsupported protocol version");
  assert.deepEqual(rpcError(old).data, { supported: [VERSION], requested: "2025-06-18" });

  // An older client that only sends the header (no _meta) learns the supported versions too.
  const headerOnly = await rpc("tools/list", {}, { meta: null, headers: { "mcp-protocol-version": "2025-11-25" } });
  assert.equal(headerOnly.status, 400);
  assert.deepEqual(rpcError(headerOnly).data, { supported: [VERSION], requested: "2025-11-25" });
});

test("the legacy initialize handshake is answered with an unsupported-version error, not a session", async () => {
  const initialize = await post({
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "legacy", version: "1" } },
  });
  assert.equal(initialize.status, 400);
  assert.equal(initialize.payload?.id, "init-1");
  assert.equal(rpcError(initialize).code, -32022);
  assert.deepEqual(rpcError(initialize).data, { supported: [VERSION], requested: "2025-11-25" });
  assert.equal(initialize.headers.get("mcp-session-id"), null);
});

test("requests must carry the protocol version and client capabilities in params._meta", async () => {
  const noMeta = await rpc("tools/list", {}, { meta: null });
  assert.equal(noMeta.status, 400);
  assert.equal(rpcError(noMeta).code, -32602);
  assert.match(rpcError(noMeta).message as string, /io\.modelcontextprotocol\/protocolVersion/);

  const noCapabilities = await rpc("tools/list", {}, { meta: { "io.modelcontextprotocol/clientCapabilities": undefined } });
  assert.equal(noCapabilities.status, 400);
  assert.equal(rpcError(noCapabilities).code, -32602);
  assert.match(rpcError(noCapabilities).message as string, /clientCapabilities/);
});

test("Streamable HTTP headers must be present and match the body", async () => {
  const before = queries.length;
  const cases: Array<[string, Exchange]> = [
    ["missing MCP-Protocol-Version", await rpc("tools/list", {}, { headers: { "mcp-protocol-version": undefined } })],
    ["MCP-Protocol-Version differs from _meta", await rpc("tools/list", {}, { headers: { "mcp-protocol-version": "2025-11-25" } })],
    ["missing Mcp-Method", await rpc("tools/list", {}, { headers: { "mcp-method": undefined } })],
    ["Mcp-Method differs from the body", await rpc("tools/list", {}, { headers: { "mcp-method": "tools/call" } })],
    ["Mcp-Method differs only in case", await rpc("tools/list", {}, { headers: { "mcp-method": "TOOLS/LIST" } })],
    ["missing Mcp-Name", await rpc("tools/call", { name: "search_jobs", arguments: { query: "qa" } }, { headers: { "mcp-name": undefined } })],
    ["Mcp-Name differs from the tool", await rpc("tools/call", { name: "search_jobs", arguments: { query: "qa" } }, { headers: { "mcp-name": "analyze_vacancy" } })],
    ["Mcp-Name is broken base64", await rpc("tools/call", { name: "search_jobs", arguments: { query: "qa" } }, { headers: { "mcp-name": "=?base64?a?=" } })],
  ];
  for (const [label, exchange] of cases) {
    assert.equal(exchange.status, 400, label);
    assert.equal(rpcError(exchange).code, -32020, label);
  }
  assert.match(rpcError(cases[3][1]).message as string, /Mcp-Method header value 'tools\/call' does not match body value 'tools\/list'/);
  assert.equal(queries.length, before, "header failures must not reach a tool");

  const encodedName = await rpc("tools/call", { name: "get_interview_questions", arguments: { limit: 1 } }, {
    headers: { "mcp-name": `=?base64?${Buffer.from("get_interview_questions").toString("base64")}?=` },
  });
  assert.equal(result(encodedName).isError, false);
});

test("a JSON-RPC batch is rejected as a whole and runs nothing", async () => {
  const before = queries.length;
  const batch = await post([
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_jobs", arguments: { query: "qa" }, _meta: META } },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: { _meta: META } },
  ], { "mcp-protocol-version": VERSION, "mcp-method": "tools/call", "mcp-name": "search_jobs" });

  assert.equal(batch.status, 400);
  assert.equal(Array.isArray(batch.payload), false);
  assert.equal(rpcError(batch).code, -32600);
  assert.match(rpcError(batch).message as string, /batching is not supported/);
  assert.equal(queries.length, before);
});

test("methods outside 2026-07-28, including the removed ping, are not found", async () => {
  for (const method of ["ping", "resources/list", "logging/setLevel"]) {
    const exchange = await rpc(method);
    assert.equal(exchange.status, 404, method);
    assert.equal(rpcError(exchange).code, -32601, method);
  }
});

test("malformed messages are rejected with JSON-RPC parse and request errors", async () => {
  const malformed = await post("{");
  assert.equal(malformed.status, 400);
  assert.equal(malformed.payload?.jsonrpc, "2.0");
  assert.equal(rpcError(malformed).code, -32700);
  assert.equal("id" in (malformed.payload ?? {}), false);

  const noVersion = await post({ id: 1, method: "tools/list", params: { _meta: META } });
  assert.equal(rpcError(noVersion).code, -32600);
  assert.equal(noVersion.payload?.id, 1);

  const nullId = await post({ jsonrpc: "2.0", id: null, method: "tools/list", params: { _meta: META } });
  assert.equal(nullId.status, 400);
  assert.equal(rpcError(nullId).code, -32600);

  const arrayParams = await post({ jsonrpc: "2.0", id: 3, method: "tools/list", params: [] });
  assert.equal(arrayParams.status, 400);
  assert.equal(rpcError(arrayParams).code, -32602);
});

test("notifications are acknowledged with 202 and no body when their headers are valid", async () => {
  const accepted = await post({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } }, {
    "mcp-protocol-version": VERSION,
    "mcp-method": "notifications/cancelled",
  });
  assert.equal(accepted.status, 202);
  assert.equal(accepted.payload, null);

  const legacy = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(legacy.status, 400);
  assert.equal(rpcError(legacy).code, -32020);
  assert.equal("id" in (legacy.payload ?? {}), false);

  const oldVersion = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, {
    "mcp-protocol-version": "2025-06-18",
    "mcp-method": "notifications/initialized",
  });
  assert.equal(rpcError(oldVersion).code, -32022);
});

test("the endpoint is stateless: no sessions, GET and DELETE are not allowed", async () => {
  const withSession = await rpc("tools/list", {}, { headers: { "mcp-session-id": "stale-session" } });
  assert.equal(withSession.status, 200);
  assert.equal(withSession.headers.get("mcp-session-id"), null);

  for (const method of ["GET", "DELETE"]) {
    const response = await handleMcpRequest(new Request("https://example.test/mcp", { method }), env as never);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("allow"), "POST, OPTIONS");
  }
});

test("a browser Origin other than the endpoint's own is forbidden", async () => {
  const foreign = await rpc("tools/list", {}, { headers: { origin: "https://evil.example" } });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.payload?.result, undefined);

  const opaque = await rpc("tools/list", {}, { headers: { origin: "null" } });
  assert.equal(opaque.status, 403);

  const sameOrigin = await rpc("tools/list", {}, { headers: { origin: "https://example.test" } });
  assert.equal(sameOrigin.status, 200);
});
