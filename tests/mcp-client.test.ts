import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const { GimmeJobMcpClient, McpRpcError, MCP_PROTOCOL_VERSION } = await import("../agent/src/mcp-client.ts");
const { handleMcpRequest, MCP_TOOL_NAMES } = await import("../worker/mcp.ts");

type Json = Record<string, unknown>;

const emptyDb = {
  prepare() {
    const statement = {
      bind() { return statement; },
      async all() { return { results: [] }; },
      async first() { return null; },
    };
    return statement;
  },
};

/** Routes the client's fetch calls into the real MCP handler, recording what went over the wire. */
function serverFetch(requests: Request[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return handleMcpRequest(request, { DB: emptyDb } as never);
  }) as typeof fetch;
}

function replyWith(...responses: Response[]): typeof fetch {
  return (async () => {
    const response = responses.shift();
    assert.ok(response, "Unexpected extra MCP request.");
    return response;
  }) as typeof fetch;
}

test("the client speaks stateless 2026-07-28 to the real server: discover, list and call", async () => {
  const requests: Request[] = [];
  const client = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "mcp-secret-token",
    userEmail: "qa@example.com",
    fetchImpl: serverFetch(requests),
  });

  const discovered = await client.discover();
  const tools = await client.listTools();
  const questions = await client.getInterviewQuestions({ limit: 1 });

  assert.deepEqual(discovered.supportedVersions, [MCP_PROTOCOL_VERSION]);
  assert.equal(MCP_PROTOCOL_VERSION, "2026-07-28");
  assert.deepEqual(tools.map((tool) => tool.name), [...MCP_TOOL_NAMES]);
  assert.equal(questions.isError, false);
  assert.equal((questions.structuredContent as Json).count, 1);

  assert.deepEqual(await Promise.all(requests.map(async (request) => ((await request.json()) as Json).method)),
    ["server/discover", "tools/list", "tools/call"]);
  for (const request of requests) {
    assert.equal(request.headers.get("x-gimmejob-mcp-token"), "mcp-secret-token");
    assert.equal(request.headers.get("x-gimmejob-mcp-user-email"), "qa@example.com");
    assert.equal(request.headers.get("mcp-protocol-version"), "2026-07-28");
    assert.match(request.headers.get("accept") ?? "", /application\/json.*text\/event-stream/);
  }
  assert.equal(requests[2].headers.get("mcp-name"), "get_interview_questions");
});

test("every request carries the revision and client capabilities in params._meta", async () => {
  const requests: Request[] = [];
  const client = new GimmeJobMcpClient({ url: "https://example.test/mcp", token: "t", fetchImpl: serverFetch(requests) });

  await client.searchJobs({ query: "senior qa" });
  const body = await requests[0].json() as Json;
  const params = body.params as Json;

  assert.deepEqual(params.arguments, { query: "senior qa" });
  assert.equal(params.name, "search_jobs");
  assert.deepEqual(params._meta, {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
    "io.modelcontextprotocol/clientInfo": { name: "gimmejob-local-client", version: "0.2.0" },
  });
});

test("tool failures from the real server surface as errors with the server's message", async () => {
  const client = new GimmeJobMcpClient({ url: "https://example.test/mcp", token: "t", fetchImpl: serverFetch([]) });

  await assert.rejects(() => client.analyzeVacancy({ job_id: "missing" }), /Job not found\./);
  await assert.rejects(() => client.searchJobs({ query: "" }), /Invalid tool arguments/);
});

test("protocol errors become McpRpcError with code, data and HTTP status", async () => {
  const client = new GimmeJobMcpClient({ url: "https://example.test/mcp", token: "t", fetchImpl: serverFetch([]) });
  const unknownTool = await client.callTool("not_a_tool").catch((error: unknown) => error);
  assert.ok(unknownTool instanceof McpRpcError);
  assert.equal(unknownTool.code, -32602);
  assert.equal(unknownTool.status, 400);

  const unsupported = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "t",
    fetchImpl: replyWith(Response.json({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32022, message: "Unsupported protocol version", data: { supported: ["2099-01-01"], requested: "2026-07-28" } },
    }, { status: 400 })),
  });
  const versionError = await unsupported.listTools().catch((error: unknown) => error);
  assert.ok(versionError instanceof McpRpcError);
  assert.equal(versionError.code, -32022);
  assert.deepEqual(versionError.data, { supported: ["2099-01-01"], requested: "2026-07-28" });
});

test("non-JSON-RPC failures such as a rejected service token keep the HTTP status and body", async () => {
  const client = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "wrong",
    fetchImpl: replyWith(Response.json({ error: "MCP service authentication required." }, { status: 401 })),
  });
  await assert.rejects(() => client.listTools(), /request failed \(401\): .*MCP service authentication required/);
});

test("the client reads responses delivered as a server-sent event stream", async () => {
  const stream = [
    "event: message",
    `data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: { progress: 1 } })}`,
    "",
    "event: message",
    `data: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { resultType: "complete", tools: [{ name: "search_jobs", inputSchema: {} }] } })}`,
    "",
  ].join("\n");
  const client = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "t",
    fetchImpl: replyWith(new Response(stream, { headers: { "content-type": "text/event-stream" } })),
  });

  assert.deepEqual((await client.listTools()).map((tool) => tool.name), ["search_jobs"]);
});

test("the client refuses results it cannot interpret", async () => {
  const pending = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "t",
    fetchImpl: replyWith(Response.json({ jsonrpc: "2.0", id: 1, result: { resultType: "input_required", inputRequests: {} } })),
  });
  await assert.rejects(() => pending.listTools(), /unsupported resultType: input_required/);

  const html = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "t",
    fetchImpl: replyWith(new Response("<html></html>", { headers: { "content-type": "text/html" } })),
  });
  await assert.rejects(() => html.listTools(), /unsupported content type: text\/html/);

  const otherServer = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "t",
    fetchImpl: replyWith(Response.json({ jsonrpc: "2.0", id: 1, result: { resultType: "complete", supportedVersions: ["2025-11-25"] } })),
  });
  await assert.rejects(() => otherServer.discover(), /does not support protocol 2026-07-28/);

  const wrongId = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "t",
    fetchImpl: replyWith(Response.json({ jsonrpc: "2.0", id: 99, result: { resultType: "complete", tools: [] } })),
  });
  await assert.rejects(() => wrongId.listTools(), /invalid JSON-RPC response/);
});

test("a tool name that is not plain ASCII travels base64-encoded in Mcp-Name", async () => {
  const requests: Request[] = [];
  const client = new GimmeJobMcpClient({ url: "https://example.test/mcp", token: "t", fetchImpl: serverFetch(requests) });

  const failure = await client.callTool("пошук").catch((error: unknown) => error);
  assert.ok(failure instanceof McpRpcError);
  assert.equal(failure.code, -32602, "the server decoded the header and reached the unknown-tool check");
  assert.equal(requests[0].headers.get("mcp-name"), `=?base64?${Buffer.from("пошук").toString("base64")}?=`);
});
