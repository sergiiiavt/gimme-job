import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildDatabaseGuide, stripDatabaseGuideComments } from "../app/playgrounds/databases/database-code-guide.ts";
import { handleDatabasePlayground } from "../app/api/playgrounds/databases/route.ts";

const SERVICE_TOKEN = "service-token-that-is-at-least-32-characters-long";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function withFetch(mock: typeof fetch, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("SQL guides deeply explain clauses while preserving the executable statement", () => {
  const sql = "SELECT id, total_amount\nFROM orders\nWHERE status = 'paid'\nORDER BY total_amount DESC\nLIMIT 20;";
  const guided = buildDatabaseGuide(sql, "Paid orders", "Return the highest-value paid orders.", "sql");

  assert.match(guided, /-- \[Guide\] Paid orders/);
  assert.match(guided, /Purpose: Return the highest-value paid orders/);
  assert.match(guided, /SELECT is the projection step/);
  assert.match(guided, /FROM establishes the source rows/);
  assert.match(guided, /WHERE filters individual source rows/);
  assert.match(guided, /ORDER BY sorts/);
  assert.match(guided, /LIMIT is applied at the end/);
  assert.match(guided, /Logical reading order is FROM\/JOIN → WHERE → SELECT\/window expressions → ORDER BY → LIMIT/);
  assert.equal(stripDatabaseGuideComments(guided), sql);
});

test("MongoDB guides explain collection operations and aggregation stages", () => {
  const query = `db.orders.aggregate([\n  { "$match": { "status": "paid" } },\n  { "$group": { "_id": "$channel", "revenue": { "$sum": "$totalAmount" } } },\n  { "$sort": { "revenue": -1 } }\n]);`;
  const guided = buildDatabaseGuide(query, "Revenue by channel", "Calculate paid revenue for each sales channel.", "mongodb");

  assert.match(guided, /\/\/ \[Guide\] Revenue by channel/);
  assert.match(guided, /db\.orders selects the 'orders' collection and aggregate\(\) is the operation/);
  assert.match(guided, /aggregate\(\) runs a pipeline/);
  assert.match(guided, /\$match filters pipeline documents/);
  assert.match(guided, /\$group creates one output document/);
  assert.equal(stripDatabaseGuideComments(guided), query);
});

test("database proxy removes only generated guide comments before execution", async () => {
  const executable = 'db.orders.find({"status":"paid"}).limit(1);';
  const guided = buildDatabaseGuide(executable, "Paid order", "Return one paid order.", "mongodb");
  let upstreamBody: Record<string, unknown> | null = null;

  await withFetch(async (_input, init) => {
    upstreamBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      engine: "mongodb",
      statementType: "FIND",
      columns: ["document"],
      rows: [["{\"orderId\":1}"]],
      documents: [{ orderId: 1 }],
      rowCount: 1,
      truncated: false,
      durationMs: 1.2,
      message: null,
    });
  }, async () => {
    const response = await handleDatabasePlayground(new Request("https://gimme-job.com/api/playgrounds/databases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "query", engine: "mongodb", sessionId: "db_session_guide", sql: guided }),
    }), {
      GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
      GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
    });
    assert.equal(response.status, 200);
  });

  assert.equal(upstreamBody?.sql, executable);
});

test("Database Playground uses the shared Learning Path highlighter for examples and the live editor", async () => {
  const [enhancer, page, styles] = await Promise.all([
    source("app/playgrounds/databases/database-code-enhancer.tsx"),
    source("app/playgrounds/databases/page.tsx"),
    source("app/playgrounds/databases/database-workbench.css"),
  ]);

  assert.match(enhancer, /highlightInterviewCode/);
  assert.match(enhancer, /highlightLanguage\(dialect\)/);
  assert.match(enhancer, /textContent\?\.trim\(\) === "Use example"/);
  assert.match(enhancer, /setControlledTextareaValue/);
  assert.match(page, /DatabaseCodeEnhancer/);
  assert.match(styles, /\.db-query-highlight/);
  assert.match(styles, /textarea\.db-query-editor-overlay/);
});
