import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { GimmeJobMcpClient } = await import("../agent/src/mcp-client.ts");

test("MCP client initializes once and sends service and tenant headers", async () => {
  const requests: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
  const responses = [
    Response.json({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2026-07-28",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "gimmejob", version: "0.1.0" },
      },
    }),
    new Response(null, { status: 202 }),
    Response.json({
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [{ name: "search_jobs", inputSchema: { type: "object" } }],
      },
    }),
    Response.json({
      jsonrpc: "2.0",
      id: 3,
      result: {
        content: [{ type: "text", text: "{}" }],
        structuredContent: { count: 0, jobs: [] },
        isError: false,
      },
    }),
  ];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({
      url: request.url,
      headers: request.headers,
      body: await request.json() as Record<string, unknown>,
    });
    const response = responses.shift();
    assert.ok(response, "Unexpected extra MCP request.");
    return response;
  }) as typeof fetch;

  const client = new GimmeJobMcpClient({
    url: "https://example.test/mcp",
    token: "mcp-secret-token",
    userEmail: "qa@example.com",
    fetchImpl,
  });

  const tools = await client.listTools();
  const search = await client.searchJobs({ query: "senior qa" });

  assert.deepEqual(tools.map((tool) => tool.name), ["search_jobs"]);
  assert.deepEqual(search.structuredContent, { count: 0, jobs: [] });
  assert.equal(requests.length, 4);
  assert.ok(requests.every((request) => request.url === "https://example.test/mcp"));
  assert.ok(requests.every((request) => request.headers.get("x-gimmejob-mcp-token") === "mcp-secret-token"));
  assert.ok(requests.every((request) => request.headers.get("x-gimmejob-mcp-user-email") === "qa@example.com"));
  assert.equal(requests[0].body.method, "initialize");
  assert.equal((requests[0].body.params as Record<string, unknown>).protocolVersion, "2026-07-28");
  assert.equal(requests[1].body.method, "notifications/initialized");
  assert.equal(requests[2].body.method, "tools/list");
  assert.equal(requests[3].body.method, "tools/call");
  assert.deepEqual(requests[3].body.params, { name: "search_jobs", arguments: { query: "senior qa" } });
});

test("MCP client surfaces tool-level errors", async () => {
  const responses = [
    Response.json({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2026-07-28", capabilities: {}, serverInfo: {} } }),
    new Response(null, { status: 202 }),
    Response.json({
      jsonrpc: "2.0",
      id: 2,
      result: {
        content: [{ type: "text", text: "Job not found." }],
        isError: true,
      },
    }),
  ];
  const fetchImpl = (async () => {
    const response = responses.shift();
    assert.ok(response);
    return response;
  }) as typeof fetch;
  const client = new GimmeJobMcpClient({ url: "https://example.test/mcp", token: "secret", fetchImpl });

  await assert.rejects(
    () => client.analyzeVacancy({ job_id: "missing" }),
    /Job not found\./,
  );
});
