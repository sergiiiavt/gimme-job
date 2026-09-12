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

test("SQL guide generator covers advanced DDL, DML, transaction, CTE, window, and expression semantics", () => {
  const statements = [
    `WITH RECURSIVE sequence AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM sequence WHERE n < 5
)
SELECT
  ROW_NUMBER() OVER (PARTITION BY o.status ORDER BY o.total_amount DESC) AS rank_in_status,
  CASE WHEN o.total_amount >= 250 THEN 'high' ELSE 'standard' END AS value_band,
  CONCAT(u.first_name, ' ', u.last_name) AS customer,
  JSON_EXTRACT(o.metadata, '$.channel') AS channel
FROM orders o
LEFT JOIN users u ON u.id = o.user_id
WHERE EXISTS (SELECT 1 FROM products p WHERE p.id = o.id)
GROUP BY o.status, o.total_amount, u.first_name, u.last_name, o.metadata
HAVING COUNT(*) > 0
ORDER BY o.total_amount DESC
LIMIT 10;`,
    `WITH params AS (SELECT 250 AS min_total)
SELECT o.id FROM orders o CROSS JOIN params p WHERE o.total_amount >= p.min_total;`,
    `SET @min_total = 250;
SELECT id FROM orders WHERE total_amount >= @min_total;`,
    `CREATE OR REPLACE VIEW paid_order_summary AS
SELECT user_id, SUM(total_amount) AS revenue FROM orders WHERE status = 'paid' GROUP BY user_id;`,
    `CREATE TABLE qa_runs (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  CONSTRAINT fk_run_user FOREIGN KEY (user_id) REFERENCES users(id)
);`,
    "CREATE UNIQUE INDEX uq_qa_notes_title ON qa_notes(title);",
    "CREATE INDEX idx_orders_status_created ON orders(status, created_at);",
    "EXPLAIN SELECT * FROM orders WHERE status = 'paid';",
    "INSERT INTO qa_notes (title, severity) VALUES ('Checkout regression', 'high');",
    "UPDATE qa_notes SET severity = 'low' WHERE title = 'Checkout regression';",
    "DELETE FROM qa_notes WHERE title = 'Checkout regression';",
    "DROP TABLE IF EXISTS qa_notes;",
    "BEGIN; UPDATE orders SET status = 'paid' WHERE id = 1; ROLLBACK; COMMIT;",
  ];

  const explanation = statements
    .map((statement, index) => buildDatabaseGuide(statement, `SQL ${index}`, "Explain this SQL feature.", "sql"))
    .join("\n");

  for (const phrase of [
    "WITH RECURSIVE builds a temporary result iteratively",
    "WITH defines a CTE",
    "SET stores a MySQL session variable",
    "CREATE VIEW saves the SELECT definition",
    "CREATE TABLE defines the schema first",
    "PRIMARY KEY makes the key unique and non-null",
    "FOREIGN KEY / REFERENCES enforces referential integrity",
    "A UNIQUE INDEX is both an access path and a uniqueness rule",
    "CREATE INDEX builds a secondary access path",
    "EXPLAIN asks the database for its execution plan",
    "INSERT maps the listed values",
    "UPDATE first finds rows that satisfy WHERE",
    "DELETE removes rows that satisfy WHERE",
    "DROP TABLE removes the table object itself",
    "BEGIN / START TRANSACTION groups the following changes",
    "ROLLBACK discards the uncommitted changes",
    "COMMIT makes all changes",
    "JOIN combines rows from two sources",
    "GROUP BY collapses rows",
    "HAVING filters groups after aggregation",
    "A window function uses OVER",
    "ROW_NUMBER assigns 1, 2, 3",
    "EXISTS is a boolean test",
    "CASE evaluates conditions in order",
    "The JSON expression reads a value",
    "The concatenation expression combines text values",
  ]) assert.match(explanation, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.equal(buildDatabaseGuide("   ", "Empty", "Nothing to run.", "sql"), "");
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

test("MongoDB guide generator covers reads, arrays, pipelines, writes, and index operations", () => {
  const statements = [
    `db.orders.find(
  { "user.region": "EU", "items": { "$elemMatch": { "quantity": { "$gte": 2 } } } },
  { "orderId": 1, "totalAmount": 1, "_id": 0 }
).sort({ "totalAmount": -1 }).limit(20);`,
    `db.users.findOne({ "userId": 42 });`,
    `db.orders.countDocuments({ "status": "paid" });`,
    `db.orders.aggregate([
  { "$match": { "status": "paid" } },
  { "$unwind": "$items" },
  { "$group": { "_id": "$items.category", "quantity": { "$sum": "$items.quantity" } } },
  { "$lookup": { "from": "users", "localField": "user.userId", "foreignField": "userId", "as": "userRecord" } },
  { "$facet": { "top": [{ "$limit": 3 }], "count": [{ "$count": "orders" }] } },
  { "$set": { "valueBand": { "$cond": [{ "$gte": ["$totalAmount", 250] }, "high", "standard"] } } },
  { "$project": { "_id": 0, "pricing": { "$let": { "vars": { "tax": 0.2 }, "in": "$$tax" } } } }
]);`,
    `db.qa_notes.insertOne({ "title": "Checkout regression" });`,
    `db.orders.updateOne({ "orderId": 42 }, { "$set": { "status": "paid" }, "$inc": { "retryCount": 1 } });`,
    `db.qa_notes.deleteOne({ "title": "Checkout regression" });`,
    `db.orders.createIndex({ "user.region": 1, "createdAt": -1 });`,
    `db.orders.getIndexes();`,
    `db.orders.find({ "status": "paid" }).explain("executionStats");`,
  ];

  const explanation = statements
    .map((statement, index) => buildDatabaseGuide(statement, `Mongo ${index}`, "Explain this MongoDB feature.", "mongodb"))
    .join("\n");

  for (const phrase of [
    "find() uses its first object as the filter",
    "The second find() object is a projection",
    "findOne() applies the filter",
    "countDocuments() applies the filter",
    "$elemMatch requires one array element",
    "Dot notation addresses a nested field directly",
    "aggregate() runs a pipeline",
    "$match filters pipeline documents",
    "$group creates one output document",
    "$unwind expands an array",
    "$lookup reads matching documents from another collection",
    "$facet sends the same incoming document set",
    "$let creates expression-local variables",
    "$project reshapes the output document",
    "Pipeline $set adds or replaces computed fields",
    "$cond is MongoDB's conditional expression",
    "sort() orders the matching documents",
    "limit() caps the cursor",
    "insertOne() stores exactly one new document",
    "updateOne() first finds one document",
    "Update operator $set changes only the named fields",
    "$inc performs an atomic numeric increment",
    "deleteOne() removes at most one document",
    "createIndex() builds an ordered index",
    "getIndexes() returns index definitions",
    "explain('executionStats') returns the execution plan",
  ]) assert.ok(explanation.includes(phrase), `Expected Mongo guide phrase: ${phrase}`);
});

test("guide stripping removes generated notes but preserves ordinary user comments", () => {
  const source = `-- user's SQL comment
-- [Guide] generated explanation
SELECT 1;
// user's Mongo-style note
// [Guide] generated Mongo explanation`;
  assert.equal(stripDatabaseGuideComments(source), `-- user's SQL comment
SELECT 1;
// user's Mongo-style note`);
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
