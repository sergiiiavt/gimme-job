"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../../site-navigation";
import styles from "./database-playground.module.css";

type Engine = "mysql" | "postgres" | "mongodb";
type LeftTab = "database" | "examples";
type ExampleCategory = "basics" | "schema" | "joins" | "aggregation" | "constraints" | "engine" | "indexes" | "filtering" | "documents" | "writes" | "advanced";
type ColumnInfo = { name: string; type: string; nullable: boolean; default: string | null; key: string | null };
type TableInfo = { name: string; columns: ColumnInfo[] };
type SchemaResponse = { tables: TableInfo[] };
type QueryResponse = {
  statementType: string;
  columns: string[];
  rows: Array<Array<string | null>>;
  documents?: unknown[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  message: string | null;
};
type DatabaseExample = { category: ExampleCategory; title: string; description: string; sql: string };
type QueryTab = {
  id: string;
  title: string;
  engine: Engine;
  query: string;
  result: QueryResponse | null;
  error: string;
};

const SESSION_KEY = "gimmejob-db-lab-session-v1";
const TABS_KEY = "gimmejob-db-lab-tabs-v1";
const ACTIVE_TAB_KEY = "gimmejob-db-lab-active-tab-v1";
const LEGACY_ENGINE_KEY = "gimmejob-db-lab-engine-v1";
const LEGACY_SQL_KEY = "gimmejob-db-lab-sql-v1";
const MAX_QUERY_TABS = 12;
const STARTER_SQL: Record<Engine, string> = {
  mysql: "SELECT id, user_id, status, total_amount, created_at\nFROM orders\nORDER BY id DESC\nLIMIT 20;",
  postgres: "SELECT id, user_id, status, total_amount, created_at\nFROM orders\nORDER BY id DESC\nLIMIT 20;",
  mongodb: "db.orders.find({\"status\":\"paid\"}).sort({\"createdAt\":-1}).limit(20);",
};
const SQL_CATEGORIES: Array<{ id: ExampleCategory; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "schema", label: "Tables & data" },
  { id: "joins", label: "Joins" },
  { id: "aggregation", label: "Aggregation" },
  { id: "constraints", label: "Keys & constraints" },
  { id: "indexes", label: "Indexes & plans" },
  { id: "advanced", label: "Advanced SQL" },
  { id: "engine", label: "Engine differences" },
];
const MONGO_CATEGORIES: Array<{ id: ExampleCategory; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "filtering", label: "Filtering" },
  { id: "documents", label: "Documents & arrays" },
  { id: "aggregation", label: "Aggregation" },
  { id: "writes", label: "Writes" },
  { id: "indexes", label: "Indexes & plans" },
  { id: "advanced", label: "Advanced pipelines" },
];

function newSessionId(): string {
  return `db_${crypto.randomUUID().replaceAll("-", "")}`;
}

function newTabId(): string {
  return `query_${crypto.randomUUID().replaceAll("-", "")}`;
}

function isEngine(value: unknown): value is Engine {
  return value === "mysql" || value === "postgres" || value === "mongodb";
}

function starterTab(engine: Engine, id = newTabId()): QueryTab {
  return { id, title: `New ${engineLabel(engine)}`, engine, query: STARTER_SQL[engine], result: null, error: "" };
}

function restoreTabs(raw: string | null): QueryTab[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_QUERY_TABS).flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const candidate = value as Partial<QueryTab>;
      if (typeof candidate.id !== "string" || typeof candidate.title !== "string" || !isEngine(candidate.engine) || typeof candidate.query !== "string") return [];
      return [{
        id: candidate.id,
        title: candidate.title,
        engine: candidate.engine,
        query: candidate.query,
        result: candidate.result && typeof candidate.result === "object" ? candidate.result as QueryResponse : null,
        error: typeof candidate.error === "string" ? candidate.error : "",
      }];
    });
  } catch {
    return [];
  }
}

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/playgrounds/databases", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

function example(category: ExampleCategory, title: string, description: string, sql: string): DatabaseExample {
  return { category, title, description, sql };
}

function engineLabel(engine: Engine): string {
  if (engine === "mysql") return "MySQL 8";
  if (engine === "postgres") return "PostgreSQL 16";
  return "MongoDB 8";
}

function shortEngineLabel(engine: Engine): string {
  if (engine === "mysql") return "MySQL";
  if (engine === "postgres") return "PG";
  return "Mongo";
}

function categoriesFor(engine: Engine) {
  return engine === "mongodb" ? MONGO_CATEGORIES : SQL_CATEGORIES;
}

function defaultExpandedTables(engine: Engine, tables: TableInfo[]): string[] {
  return engine === "mongodb" ? [] : tables.map((table) => table.name);
}

function quoteTable(engine: Engine, name: string): string {
  if (engine === "mysql") return `\`${name.replaceAll("`", "``")}\``;
  return `"${name.replaceAll('"', '""')}"`;
}

function firstRowsQuery(engine: Engine, tableName: string): string {
  if (engine === "mongodb") return `db.${tableName}.find({}).limit(100);`;
  return `SELECT *\nFROM ${quoteTable(engine, tableName)}\nLIMIT 100;`;
}

function mongoExamples(): DatabaseExample[] {
  return [
    example("basics", "Find recent paid orders", "Read matching documents, sort them, and limit the result.", `db.orders.find({
  "status": "paid"
}).sort({
  "createdAt": -1
}).limit(20);`),
    example("basics", "Find one user", "Return the first document matching a filter.", `db.users.findOne({
  "userId": 42
});`),
    example("filtering", "Projection", "Return only selected fields from matching documents.", `db.orders.find(
  { "status": "shipped" },
  {
    "orderId": 1,
    "status": 1,
    "totalAmount": 1,
    "_id": 0
  }
).limit(20);`),
    example("filtering", "Nested field filter", "Filter directly on an embedded document field.", `db.orders.find({
  "user.region": "EU",
  "totalAmount": { "$gt": 100 }
}).limit(20);`),
    example("documents", "Match an array element", "Use $elemMatch against embedded item documents.", `db.orders.find({
  "items": {
    "$elemMatch": {
      "category": "audio",
      "quantity": { "$gte": 2 }
    }
  }
}).limit(20);`),
    example("documents", "Nested user and shipping data", "Query two embedded objects without a SQL JOIN.", `db.orders.find({
  "user.tier": "pro",
  "shipping.expedited": true
}).limit(20);`),
    example("aggregation", "Revenue by channel", "Group documents and calculate order count and revenue.", `db.orders.aggregate([
  {
    "$group": {
      "_id": "$channel",
      "orders": { "$sum": 1 },
      "revenue": { "$sum": "$totalAmount" }
    }
  },
  { "$sort": { "revenue": -1 } }
]);`),
    example("aggregation", "Items by category", "Unwind the items array before grouping its embedded documents.", `db.orders.aggregate([
  { "$unwind": "$items" },
  {
    "$group": {
      "_id": "$items.category",
      "quantity": { "$sum": "$items.quantity" }
    }
  },
  { "$sort": { "quantity": -1 } }
]);`),
    example("writes", "Insert a document", "Insert a document; MongoDB creates qa_notes automatically if it does not exist.", `db.qa_notes.insertOne({
  "title": "Checkout regression",
  "severity": "high",
  "tags": ["checkout", "regression"]
});`),
    example("writes", "Update one document", "Use $set without replacing the full document.", `db.orders.updateOne(
  { "orderId": 42 },
  {
    "$set": {
      "status": "paid",
      "shipping.expedited": true
    }
  }
);`),
    example("writes", "Increment stock", "Atomically increment one numeric field.", `db.products.updateOne(
  { "productId": 10 },
  { "$inc": { "stock": 5 } }
);`),
    example("writes", "Delete one document", "Delete one matching document from the sandbox collection.", `db.qa_notes.deleteOne({
  "title": "Checkout regression"
});`),
    example("indexes", "Create an index", "Create a compound index on nested and top-level fields.", `db.orders.createIndex({
  "user.region": 1,
  "createdAt": -1
});`),
    example("indexes", "List indexes", "Inspect indexes currently defined on the collection.", "db.orders.getIndexes();"),
    example("indexes", "Explain a query", "Inspect the MongoDB execution plan for a filtered find.", `db.orders.find({
  "status": "paid"
}).explain("executionStats");`),
    example("advanced", "$lookup across collections", "Join order documents to the users collection using an aggregation lookup.", `db.orders.aggregate([
  { "$match": { "status": "paid" } },
  { "$limit": 20 },
  {
    "$lookup": {
      "from": "users",
      "localField": "user.userId",
      "foreignField": "userId",
      "as": "userRecord"
    }
  },
  { "$unwind": "$userRecord" },
  {
    "$project": {
      "_id": 0,
      "orderId": 1,
      "totalAmount": 1,
      "email": "$userRecord.email",
      "tier": "$userRecord.profile.tier"
    }
  }
]);`),
    example("advanced", "$facet dashboard", "Run several aggregations over the same matching set in one pipeline.", `db.orders.aggregate([
  { "$match": { "status": { "$ne": "cancelled" } } },
  {
    "$facet": {
      "byChannel": [
        { "$group": { "_id": "$channel", "orders": { "$sum": 1 } } },
        { "$sort": { "orders": -1 } }
      ],
      "highValue": [
        { "$match": { "totalAmount": { "$gte": 250 } } },
        { "$count": "orders" }
      ],
      "averageValue": [
        { "$group": { "_id": null, "average": { "$avg": "$totalAmount" } } }
      ]
    }
  }
]);`),
    example("advanced", "$let variables", "Define reusable expression variables inside a projection.", `db.orders.aggregate([
  { "$limit": 20 },
  {
    "$project": {
      "_id": 0,
      "orderId": 1,
      "pricing": {
        "$let": {
          "vars": {
            "taxRate": 0.2,
            "subtotal": "$totalAmount"
          },
          "in": {
            "subtotal": "$$subtotal",
            "tax": { "$multiply": ["$$subtotal", "$$taxRate"] },
            "withTax": { "$multiply": ["$$subtotal", { "$add": [1, "$$taxRate"] }] }
          }
        }
      }
    }
  }
]);`),
    example("advanced", "Computed fields and conditions", "Derive values without modifying stored documents.", `db.orders.aggregate([
  {
    "$set": {
      "itemCount": { "$size": "$items" },
      "valueBand": {
        "$cond": [
          { "$gte": ["$totalAmount", 250] },
          "high",
          "standard"
        ]
      }
    }
  },
  { "$project": { "_id": 0, "orderId": 1, "itemCount": 1, "valueBand": 1 } },
  { "$limit": 20 }
]);`),
  ];
}

function sqlExamples(engine: Engine): DatabaseExample[] {
  const mysql = engine === "mysql";
  const createNotes = mysql
    ? `CREATE TABLE IF NOT EXISTS qa_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);`
    : `CREATE TABLE IF NOT EXISTS qa_notes (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  const createRunsWithForeignKey = mysql
    ? `CREATE TABLE IF NOT EXISTS qa_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_qa_runs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
);`
    : `CREATE TABLE IF NOT EXISTS qa_runs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  status VARCHAR(32) NOT NULL
);`;
  const parameterExample = mysql
    ? `SET @min_total = 250;

SELECT id, user_id, total_amount
FROM orders
WHERE total_amount >= @min_total
ORDER BY total_amount DESC
LIMIT 20;`
    : `WITH params AS (
  SELECT 250::numeric AS min_total
)
SELECT o.id, o.user_id, o.total_amount
FROM orders o
CROSS JOIN params p
WHERE o.total_amount >= p.min_total
ORDER BY o.total_amount DESC
LIMIT 20;`;

  return [
    example("basics", "Select recent orders", "Read rows and control their order and count.", `SELECT *
FROM orders
ORDER BY id DESC
LIMIT 20;`),
    example("basics", "Filter paid orders", "Return only rows matching a WHERE condition.", `SELECT id, user_id, status, total_amount
FROM orders
WHERE status = 'paid'
ORDER BY id DESC
LIMIT 20;`),
    example("schema", "Create a table", "Create a sandbox table with a generated primary key, defaults, and required fields.", createNotes),
    example("schema", "Insert a row", "Insert one row into qa_notes after creating the table.", `INSERT INTO qa_notes (title, severity)
VALUES ('Checkout regression', 'high');`),
    example("schema", "Update rows", "Change existing data with an UPDATE statement.", `UPDATE qa_notes
SET severity = 'low'
WHERE title = 'Checkout regression';`),
    example("schema", "Delete rows", "Delete matching data while keeping the table itself.", `DELETE FROM qa_notes
WHERE title = 'Checkout regression';`),
    example("schema", "Drop a table", "Remove the sandbox table and its data.", "DROP TABLE IF EXISTS qa_notes;"),
    example("joins", "Orders with users", "Join orders to users through user_id.", `SELECT o.id, u.email, u.region, o.status, o.total_amount
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY o.id DESC
LIMIT 20;`),
    example("joins", "Orders with products", "Join orders to products through product_id.", `SELECT o.id, p.sku, p.category, o.status, o.total_amount
FROM orders o
JOIN products p ON p.id = o.product_id
ORDER BY o.id DESC
LIMIT 20;`),
    example("aggregation", "Revenue by channel", "Group orders and calculate count and revenue.", `SELECT channel,
       COUNT(*) AS orders_count,
       ROUND(SUM(total_amount), 2) AS revenue
FROM orders
GROUP BY channel
ORDER BY revenue DESC;`),
    example("aggregation", "Orders by region", "Combine JOIN and GROUP BY in one query.", `SELECT u.region,
       COUNT(*) AS orders_count,
       ROUND(SUM(o.total_amount), 2) AS revenue
FROM orders o
JOIN users u ON u.id = o.user_id
GROUP BY u.region
ORDER BY revenue DESC;`),
    example("constraints", "Primary key", "Create a small table whose id column is the primary key and whose name must be unique.", `CREATE TABLE IF NOT EXISTS qa_suites (
  id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);`),
    example("constraints", "Foreign key", "Create qa_runs with a foreign key that must reference an existing user.", createRunsWithForeignKey),
    example("constraints", "Unique index", "Enforce unique qa_notes titles with a unique index.", "CREATE UNIQUE INDEX uq_qa_notes_title ON qa_notes(title);"),
    example("advanced", "CTE + window ranking", "Use a common table expression and a window function to rank orders inside each user.", `WITH ranked_orders AS (
  SELECT id,
         user_id,
         total_amount,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY total_amount DESC, id DESC
         ) AS order_rank
  FROM orders
)
SELECT id, user_id, total_amount, order_rank
FROM ranked_orders
WHERE order_rank <= 3
ORDER BY user_id, order_rank
LIMIT 100;`),
    example("advanced", mysql ? "Session variable" : "Parameter CTE", mysql ? "Set a session variable and reuse it in the following statement." : "Model a reusable query parameter with a one-row CTE.", parameterExample),
    example("advanced", "Conditional aggregation", "Calculate several business metrics in one grouped scan.", mysql
      ? `SELECT channel,
       COUNT(*) AS all_orders,
       SUM(status = 'paid') AS paid_orders,
       SUM(status = 'cancelled') AS cancelled_orders,
       ROUND(AVG(total_amount), 2) AS average_value
FROM orders
GROUP BY channel
ORDER BY all_orders DESC;`
      : `SELECT channel,
       COUNT(*) AS all_orders,
       COUNT(*) FILTER (WHERE status = 'paid') AS paid_orders,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders,
       ROUND(AVG(total_amount), 2) AS average_value
FROM orders
GROUP BY channel
ORDER BY all_orders DESC;`),
    example("advanced", "Correlated EXISTS", "Find users for whom at least one qualifying order exists without returning duplicate users.", `SELECT u.id, u.email, u.region
FROM users u
WHERE EXISTS (
  SELECT 1
  FROM orders o
  WHERE o.user_id = u.id
    AND o.status = 'paid'
    AND o.total_amount >= 250
)
ORDER BY u.id
LIMIT 50;`),
    example("advanced", "Create a reusable view", "Persist a read-only query shape inside the sandbox for later SELECTs.", `CREATE OR REPLACE VIEW paid_order_summary AS
SELECT user_id,
       COUNT(*) AS paid_orders,
       ROUND(SUM(total_amount), 2) AS paid_revenue
FROM orders
WHERE status = 'paid'
GROUP BY user_id;`),
    example("advanced", "Recursive CTE", "Generate a small sequence recursively and join it to real order IDs.", `WITH RECURSIVE sequence(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1
  FROM sequence
  WHERE n < 10
)
SELECT s.n, o.status, o.total_amount
FROM sequence s
LEFT JOIN orders o ON o.id = s.n
ORDER BY s.n;`),
    example("engine", "String concatenation",
      mysql ? "MySQL commonly uses CONCAT(); PostgreSQL can use the || operator." : "PostgreSQL can concatenate with ||; MySQL commonly uses CONCAT().",
      mysql
        ? `SELECT id, CONCAT(email, ' · ', region) AS user_label
FROM users
ORDER BY id
LIMIT 10;`
        : `SELECT id, email || ' · ' || region AS user_label
FROM users
ORDER BY id
LIMIT 10;`),
    example("engine", "JSON value extraction",
      mysql ? "MySQL uses JSON_EXTRACT / JSON_UNQUOTE for this form of extraction." : "PostgreSQL supports JSONB operators such as ->> for text extraction.",
      mysql
        ? `SELECT JSON_UNQUOTE(
  JSON_EXTRACT('{"status":"paid","channel":"web"}', '$.status')
) AS status;`
        : `SELECT '{"status":"paid","channel":"web"}'::jsonb
  ->> 'status' AS status;`),
    example("indexes", "Inspect a query plan", "See how the selected database engine plans the query.", mysql ? "EXPLAIN SELECT * FROM orders WHERE user_id = 1234;" : "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 1234;"),
    example("indexes", "Create an index", "Add an index on orders.user_id, then run EXPLAIN again to compare.", "CREATE INDEX idx_orders_user_id ON orders(user_id);"),
  ];
}

function examplesFor(engine: Engine): DatabaseExample[] {
  return engine === "mongodb" ? mongoExamples() : sqlExamples(engine);
}

export default function DatabasePlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [tabs, setTabs] = useState<QueryTab[]>([{ id: "initial", title: "New MySQL 8", engine: "mysql", query: STARTER_SQL.mysql, result: null, error: "" }]);
  const [activeTabId, setActiveTabId] = useState("initial");
  const [hydrated, setHydrated] = useState(false);
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [expandedTables, setExpandedTables] = useState<string[] | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("database");
  const [exampleCategory, setExampleCategory] = useState<ExampleCategory>("basics");
  const [loadingTabId, setLoadingTabId] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const engine = activeTab?.engine || "mysql";
  const sql = activeTab?.query || STARTER_SQL[engine];
  const result = activeTab?.result || null;
  const error = activeTab?.error || pageError;
  const loading = loadingTabId === activeTab?.id;
  const mongo = engine === "mongodb";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const existingSession = localStorage.getItem(SESSION_KEY);
      const nextSession = existingSession && /^[A-Za-z0-9_-]{8,200}$/.test(existingSession) ? existingSession : newSessionId();
      localStorage.setItem(SESSION_KEY, nextSession);
      setSessionId(nextSession);

      let restored = restoreTabs(localStorage.getItem(TABS_KEY));
      if (!restored.length) {
        const savedEngine = localStorage.getItem(LEGACY_ENGINE_KEY);
        const legacyEngine: Engine = savedEngine === "postgres" || savedEngine === "mongodb" ? savedEngine : "mysql";
        const legacyQuery = localStorage.getItem(`${LEGACY_SQL_KEY}:${legacyEngine}`) || STARTER_SQL[legacyEngine];
        restored = [{ ...starterTab(legacyEngine), query: legacyQuery }];
      }
      const savedActive = localStorage.getItem(ACTIVE_TAB_KEY);
      setTabs(restored);
      setActiveTabId(restored.some((tab) => tab.id === savedActive) ? savedActive! : restored[0].id);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
      localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
    } catch {
      try {
        localStorage.setItem(TABS_KEY, JSON.stringify(tabs.map((tab) => ({ ...tab, result: null }))));
        localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
      } catch {
        // Storage can be unavailable or full; the live workspace still remains usable.
      }
    }
  }, [activeTabId, hydrated, tabs]);

  const refreshSchema = useCallback(async () => {
    if (!sessionId) return;
    setSchemaLoading(true);
    setPageError("");
    try {
      const payload = await api<SchemaResponse>({ action: "schema", engine, sessionId });
      const tables = payload.tables || [];
      setSchema(tables);
      setExpandedTables((current) => {
        if (current === null) return defaultExpandedTables(engine, tables);
        return current.filter((name) => tables.some((table) => table.name === name));
      });
    } catch (reason) {
      setSchema([]);
      setExpandedTables(null);
      setPageError(reason instanceof Error ? reason.message : "Could not load database structure.");
    } finally {
      setSchemaLoading(false);
    }
  }, [engine, sessionId]);

  useEffect(() => {
    setSchema([]);
    setExpandedTables(null);
    setExampleCategory("basics");
    if (!sessionId) return;
    const timer = window.setTimeout(() => void refreshSchema(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSchema, sessionId]);

  function updateTab(tabId: string, patch: Partial<QueryTab>) {
    setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, ...patch } : tab));
  }

  function addTab(nextEngine: Engine, query: string, title: string): string {
    const id = newTabId();
    const tab: QueryTab = { id, title, engine: nextEngine, query, result: null, error: "" };
    setTabs((current) => [...current, tab].slice(-MAX_QUERY_TABS));
    setActiveTabId(id);
    return id;
  }

  function newBlankTab() {
    const tab = starterTab(engine);
    setTabs((current) => [...current, tab].slice(-MAX_QUERY_TABS));
    setActiveTabId(tab.id);
  }

  function closeTab(tabId: string) {
    if (tabs.length === 1) {
      const replacement = starterTab(engine);
      setTabs([replacement]);
      setActiveTabId(replacement.id);
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === tabId);
    const next = tabs.filter((tab) => tab.id !== tabId);
    setTabs(next);
    if (activeTabId === tabId) setActiveTabId(next[Math.max(0, index - 1)]?.id || next[0].id);
  }

  async function executeStatement(tabId: string, runEngine: Engine, statement: string) {
    const trimmed = statement.trim();
    if (!sessionId || !trimmed || loadingTabId) return;
    setLoadingTabId(tabId);
    setPageError("");
    updateTab(tabId, { query: statement, error: "" });
    try {
      const payload = await api<QueryResponse>({ action: "query", engine: runEngine, sessionId, sql: trimmed });
      updateTab(tabId, { result: payload, error: "" });
      const readOnly = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH", "FIND", "FINDONE", "COUNTDOCUMENTS", "AGGREGATE", "GETINDEXES"];
      if (!readOnly.includes(payload.statementType) && runEngine === engine) void refreshSchema();
    } catch (reason) {
      updateTab(tabId, { error: reason instanceof Error ? reason.message : "Query failed." });
    } finally {
      setLoadingTabId((current) => current === tabId ? null : current);
    }
  }

  function runCurrentQuery() {
    if (!activeTab) return;
    void executeStatement(activeTab.id, activeTab.engine, activeTab.query);
  }

  function changeEngine(next: Engine) {
    if (!activeTab || next === activeTab.engine) return;
    updateTab(activeTab.id, {
      engine: next,
      title: `New ${engineLabel(next)}`,
      query: STARTER_SQL[next],
      result: null,
      error: "",
    });
    setExpandedTables(null);
    setExampleCategory("basics");
    setPageError("");
  }

  function toggleTable(name: string) {
    setExpandedTables((current) => {
      const expanded = current || [];
      return expanded.includes(name) ? expanded.filter((entry) => entry !== name) : [...expanded, name];
    });
  }

  function expandAll() {
    setExpandedTables(schema.map((table) => table.name));
  }

  function collapseAll() {
    setExpandedTables([]);
  }

  function loadExample(entry: DatabaseExample) {
    addTab(engine, entry.sql, entry.title);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  }

  function selectFirstRows(tableName: string) {
    const statement = firstRowsQuery(engine, tableName);
    const tabId = addTab(engine, statement, `${tableName} · first 100`);
    void executeStatement(tabId, engine, statement);
  }

  async function resetDatabase() {
    if (!sessionId || loadingTabId) return;
    const name = engineLabel(engine);
    if (!window.confirm(`Reset ${name} database? All changes made in this playground database will be deleted.`)) return;
    setLoadingTabId(activeTab?.id || "reset");
    setPageError("");
    try {
      await api({ action: "reset", engine, sessionId });
      setTabs((current) => current.map((tab) => tab.engine === engine ? { ...tab, result: null, error: "" } : tab));
      setExpandedTables(null);
      await refreshSchema();
    } catch (reason) {
      setPageError(reason instanceof Error ? reason.message : "Could not reset database.");
    } finally {
      setLoadingTabId(null);
    }
  }

  function handleEditorKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      runCurrentQuery();
    }
  }

  const categories = categoriesFor(engine);
  const queryExamples = examplesFor(engine).filter((entry) => entry.category === exampleCategory);

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeExternalId="database-playground"
        activeSection={null}
        activeSubsection=""
        hideSecondary
        mobileOpen={mobileNav}
        mode="public"
        onSelectSubsection={() => undefined}
        personalHref="/playgrounds/databases"
        secondaryItems={[]}
        secondaryTitle="Database Playground"
      />

      <section className="kb-main">
        <button aria-expanded={mobileNav} aria-label="Toggle navigation" className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} type="button">☰</button>
        <div className={`kb-content ${styles.page}`}>
          <div className={styles.workspaceLayout}>
            <div className={styles.leftRail}>
              <div className={styles.engineSwitch} role="group" aria-label="Database engine">
                <button className={engine === "mysql" ? styles.activeEngine : ""} onClick={() => changeEngine("mysql")} type="button">MySQL 8</button>
                <button className={engine === "postgres" ? styles.activeEngine : ""} onClick={() => changeEngine("postgres")} type="button">PostgreSQL 16</button>
                <button className={engine === "mongodb" ? styles.activeEngine : ""} onClick={() => changeEngine("mongodb")} type="button">MongoDB 8</button>
              </div>

              <aside className={styles.technicalPanel}>
                <div className={styles.sideTabs} role="tablist" aria-label="Database playground sections">
                  <button aria-selected={leftTab === "database"} className={leftTab === "database" ? styles.activeSideTab : ""} onClick={() => setLeftTab("database")} role="tab" type="button">Database</button>
                  <button aria-selected={leftTab === "examples"} className={leftTab === "examples" ? styles.activeSideTab : ""} onClick={() => setLeftTab("examples")} role="tab" type="button">Examples</button>
                </div>

                {leftTab === "database" ? (
                  <div className={styles.databaseView}>
                    <div className={styles.databaseTools}>
                      <span>{mongo ? "Collections" : "Tables"}</span>
                      <div>
                        <button disabled={!schema.length} onClick={expandAll} type="button">Expand all</button>
                        <button disabled={!schema.length} onClick={collapseAll} type="button">Collapse all</button>
                      </div>
                    </div>
                    <div className={styles.tables}>
                      {schema.map((table) => {
                        const expanded = expandedTables?.includes(table.name) ?? false;
                        return (
                          <div className={`${styles.tableCard} ${expanded ? styles.selectedTable : ""}`} key={table.name}>
                            <div className={styles.tableHeader}>
                              <button aria-expanded={expanded} className={styles.tableButton} onClick={() => toggleTable(table.name)} type="button">
                                <span className={styles.chevron}>{expanded ? "⌄" : "›"}</span>
                                <strong>{table.name}</strong>
                                <span>{table.columns.length}</span>
                              </button>
                              <button aria-label={`Select first 100 rows from ${table.name}`} className={styles.quickSelect} disabled={Boolean(loadingTabId)} onClick={() => selectFirstRows(table.name)} title="Run first 100" type="button">100</button>
                            </div>
                            {expanded && (
                              <div className={styles.columnList}>
                                {table.columns.map((column) => (
                                  <div className={styles.columnRow} key={column.name}>
                                    <span className={styles.columnName}>{column.name}{column.key ? <em>{column.key}</em> : null}</span>
                                    <small>{column.type}</small>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {schemaLoading && !schema.length && <p className={styles.empty}>Loading database…</p>}
                      {!schemaLoading && !schema.length && <p className={styles.empty}>Database structure is unavailable.</p>}
                    </div>
                    <p className={styles.sideHint}>The 100 button opens a query tab and immediately runs the first 100 {mongo ? "documents" : "rows"}.</p>
                  </div>
                ) : (
                  <div className={styles.examplesView}>
                    <div className={styles.exampleCategories} role="tablist" aria-label="Database example categories">
                      {categories.map((category) => (
                        <button aria-selected={exampleCategory === category.id} className={exampleCategory === category.id ? styles.activeCategory : ""} key={category.id} onClick={() => setExampleCategory(category.id)} role="tab" type="button">{category.label}</button>
                      ))}
                    </div>
                    <div className={styles.examplesList}>
                      {queryExamples.map((entry) => (
                        <article className={styles.exampleCard} key={entry.title}>
                          <h2>{entry.title}</h2>
                          <p>{entry.description}</p>
                          <pre><code>{entry.sql}</code></pre>
                          <button onClick={() => loadExample(entry)} type="button">Use example</button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>

            <section className={styles.workbench}>
              <div className={styles.queryTabs} role="tablist" aria-label="Query tabs">
                <div className={styles.queryTabsScroll}>
                  {tabs.map((tab) => (
                    <div className={`${styles.queryTab} ${tab.id === activeTabId ? styles.activeQueryTab : ""}`} key={tab.id}>
                      <button aria-selected={tab.id === activeTabId} className={styles.queryTabSelect} onClick={() => setActiveTabId(tab.id)} role="tab" title={tab.title} type="button">
                        <small>{shortEngineLabel(tab.engine)}</small>
                        <span>{tab.title}</span>
                      </button>
                      <button aria-label={`Close ${tab.title}`} className={styles.closeTab} onClick={() => closeTab(tab.id)} title="Close query tab" type="button">×</button>
                    </div>
                  ))}
                </div>
                <button aria-label="New query tab" className={styles.newTabButton} onClick={newBlankTab} title="New query tab" type="button">+</button>
              </div>

              <section className={styles.editorPane}>
                <div className={styles.sectionHeader}>
                  <div><strong>Query</strong><span>{engineLabel(engine)}</span></div>
                  <span>Ctrl/Cmd + Enter</span>
                </div>
                <div className={styles.editorBody}>
                  <textarea
                    aria-label={mongo ? "MongoDB query editor" : "SQL editor"}
                    className={styles.editor}
                    onChange={(event) => activeTab && updateTab(activeTab.id, { query: event.target.value })}
                    onKeyDown={handleEditorKey}
                    ref={editorRef}
                    spellCheck={false}
                    value={sql}
                  />
                  <div className={styles.editorActions}>
                    <button className={styles.ghostButton} disabled={schemaLoading} onClick={() => void refreshSchema()} type="button">Refresh</button>
                    <button className={styles.dangerButton} disabled={Boolean(loadingTabId)} onClick={() => void resetDatabase()} type="button">Reset</button>
                    <button className={styles.runButton} disabled={!sessionId || Boolean(loadingTabId) || !sql.trim()} onClick={runCurrentQuery} type="button">{loading ? "Running…" : mongo ? "Run query" : "Run SQL"}</button>
                  </div>
                </div>
              </section>

              <section className={styles.resultsPane}>
                <div className={styles.sectionHeader}>
                  <div><strong>Results</strong><span>{result ? result.statementType : "Query output"}</span></div>
                  <div className={styles.resultMeta}>
                    {result && !error ? <><span>{result.rowCount} results</span><span>{result.durationMs} ms</span>{result.truncated && <span>truncated</span>}</> : null}
                  </div>
                </div>

                {error ? (
                  <div className={styles.error} role="alert"><strong>Query error</strong><pre>{error}</pre></div>
                ) : (
                  <div className={styles.dataView}>
                    {mongo && result?.documents?.length ? (
                      <div className={styles.mongoDocuments}>
                        {result.documents.map((document, index) => <pre key={index}>{JSON.stringify(document, null, 2)}</pre>)}
                      </div>
                    ) : result?.columns.length ? (
                      <div className={styles.gridWrap}>
                        <table className={styles.grid}>
                          <thead><tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                          <tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td className={cell === null ? styles.nullCell : ""} key={`${rowIndex}-${cellIndex}`}>{cell ?? "NULL"}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={result ? styles.successResult : styles.emptyResult}>{result?.message || "Run a query to see the result."}</div>
                    )}
                  </div>
                )}
              </section>
            </section>
          </div>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
