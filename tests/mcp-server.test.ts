import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { handleMcpRequest, MCP_TOOL_NAMES } = await import("../worker/mcp.ts");
const { default: interviewCatalog } = await import("../content/interview/catalog.ts");

type Row = Record<string, unknown>;

const firstQuestion = interviewCatalog.questions[0];

class FakeStatement {
  private bindings: unknown[] = [];

  constructor(private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const normalized = this.sql.replace(/\s+/g, " ");
    if (normalized.includes("FROM jobs AS j")) {
      return {
        results: [{
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
          discovered_at: "2026-08-22T10:00:00.000Z",
          url: "https://example.test/job-1",
          description: "Senior QA role with Python, Playwright, API testing and SQL.",
        }] as T[],
      };
    }
    if (normalized.includes("FROM interview_progress")) {
      return {
        results: [{
          question_id: firstQuestion.id,
          status: "LEARNED",
          updated_at: "2026-08-22T11:00:00.000Z",
        }] as T[],
      };
    }
    throw new Error(`Unexpected all() query: ${normalized}; bindings=${JSON.stringify(this.bindings)}`);
  }

  async first<T>(): Promise<T | null> {
    throw new Error(`Unexpected first() query: ${this.sql}; bindings=${JSON.stringify(this.bindings)}`);
  }
}

const env = {
  DB: {
    prepare(sql: string) {
      return new FakeStatement(sql);
    },
  },
};

async function rpc(method: string, params?: Record<string, unknown>, id = 1) {
  const request = new Request("https://example.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    }),
  });
  const response = await handleMcpRequest(request, env as never);
  return {
    status: response.status,
    payload: response.status === 204 || response.status === 202 ? null : await response.json() as Record<string, unknown>,
  };
}

function structuredContent(payload: Record<string, unknown>): Record<string, unknown> {
  const result = payload.result as Record<string, unknown>;
  return result.structuredContent as Record<string, unknown>;
}

test("MCP server initializes and exposes exactly the four GimmeJob tools", async () => {
  const initialized = await rpc("initialize", {
    protocolVersion: "2026-07-28",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(initialized.status, 200);
  assert.equal(((initialized.payload?.result as Record<string, unknown>).serverInfo as Record<string, unknown>).name, "gimmejob");

  const listed = await rpc("tools/list");
  const tools = ((listed.payload?.result as Record<string, unknown>).tools as Array<Record<string, unknown>>);
  assert.deepEqual(tools.map((tool) => tool.name), [...MCP_TOOL_NAMES]);
  assert.deepEqual([...MCP_TOOL_NAMES], [
    "search_jobs",
    "get_interview_questions",
    "get_learning_progress",
    "analyze_vacancy",
  ]);
});

test("search_jobs falls back to local lexical ranking when Vectorize is unavailable", async () => {
  const response = await rpc("tools/call", {
    name: "search_jobs",
    arguments: { query: "Senior QA", limit: 5 },
  });
  const content = structuredContent(response.payload!);
  const jobs = content.jobs as Array<Record<string, unknown>>;

  assert.equal(content.retrieval, "lexical-fallback");
  assert.equal(content.count, 1);
  assert.equal(jobs[0].id, "job-1");
  assert.equal(jobs[0].title, "Senior QA Automation Engineer");
});

test("get_interview_questions can read the canonical Git-backed catalog without Vectorize", async () => {
  const response = await rpc("tools/call", {
    name: "get_interview_questions",
    arguments: { limit: 2 },
  });
  const content = structuredContent(response.payload!);
  const questions = content.questions as Array<Record<string, unknown>>;

  assert.equal(content.retrieval, "catalog");
  assert.equal(content.count, 2);
  assert.equal(questions[0].id, firstQuestion.id);
  assert.equal(typeof questions[0].answer, "string");
});

test("get_learning_progress returns persisted private-state shape and catalog context", async () => {
  const response = await rpc("tools/call", {
    name: "get_learning_progress",
    arguments: {},
  });
  const content = structuredContent(response.payload!);
  const counts = content.statusCounts as Record<string, number>;
  const items = content.items as Array<Record<string, unknown>>;

  assert.equal(content.scope, "interview_questions");
  assert.equal(content.totalQuestions, interviewCatalog.questions.length);
  assert.equal(content.trackedQuestions, 1);
  assert.equal(counts.LEARNED, 1);
  assert.equal(items[0].questionId, firstQuestion.id);
  assert.equal(items[0].question, firstQuestion.question);
});

test("MCP server returns tool errors without turning them into transport errors", async () => {
  const invalidArguments = await rpc("tools/call", {
    name: "search_jobs",
    arguments: { query: "", limit: 999 },
  });
  assert.equal(invalidArguments.status, 200);
  const invalidResult = invalidArguments.payload?.result as Record<string, unknown>;
  assert.equal(invalidResult.isError, true);
  assert.match(((invalidResult.content as Array<Record<string, unknown>>)[0].text as string), /Invalid tool arguments/);

  const unknown = await rpc("tools/call", { name: "not_a_tool", arguments: {} });
  assert.equal((unknown.payload?.error as Record<string, unknown>).code, -32602);
});

test("MCP transport rejects malformed JSON and acknowledges notifications without a body", async () => {
  const malformed = await handleMcpRequest(new Request("https://example.test/mcp", {
    method: "POST",
    body: "{",
  }), env as never);
  assert.equal(malformed.status, 400);
  assert.equal(((await malformed.json()) as Record<string, unknown>).jsonrpc, "2.0");

  const notification = await handleMcpRequest(new Request("https://example.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }), env as never);
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), "");
});
