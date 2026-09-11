"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../../site-navigation";
import styles from "./database-playground.module.css";

type Engine = "mysql" | "postgres" | "mongodb";
type LeftTab = "database" | "examples";
type ExampleCategory = "basics" | "joins" | "aggregation" | "engine" | "indexes" | "filtering" | "documents" | "writes";
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
type QueryExample = { category: ExampleCategory; title: string; description: string; sql: string };

const SESSION_KEY = "gimmejob-db-lab-session-v1";
const ENGINE_KEY = "gimmejob-db-lab-engine-v1";
const SQL_KEY = "gimmejob-db-lab-sql-v1";
const STARTER_SQL: Record<Engine, string> = {
  mysql: "SELECT id, user_id, status, total_amount, created_at\nFROM orders\nORDER BY id DESC\nLIMIT 20;",
  postgres: "SELECT id, user_id, status, total_amount, created_at\nFROM orders\nORDER BY id DESC\nLIMIT 20;",
  mongodb: "db.orders.find({\"status\":\"paid\"}).sort({\"createdAt\":-1}).limit(20);",
};
const SQL_CATEGORIES: Array<{ id: ExampleCategory; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "joins", label: "Joins" },
  { id: "aggregation", label: "Aggregation" },
  { id: "engine", label: "Engine differences" },
  { id: "indexes", label: "Indexes & plans" },
];
const MONGO_CATEGORIES: Array<{ id: ExampleCategory; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "filtering", label: "Filtering" },
  { id: "documents", label: "Documents & arrays" },
  { id: "aggregation", label: "Aggregation" },
  { id: "writes", label: "Updates" },
  { id: "indexes", label: "Indexes & plans" },
];

function newSessionId(): string {
  return `db_${crypto.randomUUID().replaceAll("-", "")}`;
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

function queryExample(category: ExampleCategory, title: string, description: string, sql: string): QueryExample {
  return { category, title, description, sql };
}

function engineLabel(engine: Engine): string {
  if (engine === "mysql") return "MySQL 8";
  if (engine === "postgres") return "PostgreSQL 16";
  return "MongoDB 8";
}

function categoriesFor(engine: Engine) {
  return engine === "mongodb" ? MONGO_CATEGORIES : SQL_CATEGORIES;
}

function mongoExamples(): QueryExample[] {
  return [
    queryExample("basics", "Find recent paid orders", "Read matching documents, sort them, and limit the result.",
      "db.orders.find({\"status\":\"paid\"}).sort({\"createdAt\":-1}).limit(20);"),
    queryExample("basics", "Find one user", "Return the first document matching a filter.",
      "db.users.findOne({\"userId\":42});"),
    queryExample("filtering", "Projection", "Return only selected fields from matching documents.",
      "db.orders.find({\"status\":\"shipped\"},{\"orderId\":1,\"status\":1,\"totalAmount\":1,\"_id\":0}).limit(20);"),
    queryExample("filtering", "Nested field filter", "Filter directly on an embedded document field.",
      "db.orders.find({\"user.region\":\"EU\",\"totalAmount\":{\"$gt\":100}}).limit(20);"),
    queryExample("documents", "Match an array element", "Use $elemMatch against embedded item documents.",
      "db.orders.find({\"items\":{\"$elemMatch\":{\"category\":\"audio\",\"quantity\":{\"$gte\":2}}}}).limit(20);"),
    queryExample("documents", "Nested user and shipping data", "Query two embedded objects without a SQL JOIN.",
      "db.orders.find({\"user.tier\":\"pro\",\"shipping.expedited\":true}).limit(20);"),
    queryExample("aggregation", "Revenue by channel", "Group documents and calculate order count and revenue.",
      "db.orders.aggregate([{\"$group\":{\"_id\":\"$channel\",\"orders\":{\"$sum\":1},\"revenue\":{\"$sum\":\"$totalAmount\"}}},{\"$sort\":{\"revenue\":-1}}]);"),
    queryExample("aggregation", "Items by category", "Unwind the items array before grouping its embedded documents.",
      "db.orders.aggregate([{\"$unwind\":\"$items\"},{\"$group\":{\"_id\":\"$items.category\",\"quantity\":{\"$sum\":\"$items.quantity\"}}},{\"$sort\":{\"quantity\":-1}}]);"),
    queryExample("writes", "Update one document", "Use $set without replacing the full document.",
      "db.orders.updateOne({\"orderId\":42},{\"$set\":{\"status\":\"paid\",\"shipping.expedited\":true}});"),
    queryExample("writes", "Increment stock", "Atomically increment one numeric field.",
      "db.products.updateOne({\"productId\":10},{\"$inc\":{\"stock\":5}});"),
    queryExample("indexes", "Create an index", "Create a compound index on nested and top-level fields.",
      "db.orders.createIndex({\"user.region\":1,\"createdAt\":-1});"),
    queryExample("indexes", "Explain a query", "Inspect the MongoDB execution plan for a filtered find.",
      "db.orders.find({\"status\":\"paid\"}).explain(\"executionStats\");"),
  ];
}

function sqlExamples(engine: Engine): QueryExample[] {
  const mysql = engine === "mysql";
  return [
    queryExample("basics", "Select recent orders", "Read rows and control their order and count.",
      "SELECT *\nFROM orders\nORDER BY id DESC\nLIMIT 20;"),
    queryExample("basics", "Filter paid orders", "Return only rows matching a WHERE condition.",
      "SELECT id, user_id, status, total_amount\nFROM orders\nWHERE status = 'paid'\nORDER BY id DESC\nLIMIT 20;"),
    queryExample("joins", "Orders with users", "Join orders to users through user_id.",
      "SELECT o.id, u.email, u.region, o.status, o.total_amount\nFROM orders o\nJOIN users u ON u.id = o.user_id\nORDER BY o.id DESC\nLIMIT 20;"),
    queryExample("joins", "Orders with products", "Join orders to products through product_id.",
      "SELECT o.id, p.sku, p.category, o.status, o.total_amount\nFROM orders o\nJOIN products p ON p.id = o.product_id\nORDER BY o.id DESC\nLIMIT 20;"),
    queryExample("aggregation", "Revenue by channel", "Group orders and calculate count and revenue.",
      "SELECT channel, COUNT(*) AS orders_count, ROUND(SUM(total_amount), 2) AS revenue\nFROM orders\nGROUP BY channel\nORDER BY revenue DESC;"),
    queryExample("aggregation", "Orders by region", "Combine JOIN and GROUP BY in one query.",
      "SELECT u.region, COUNT(*) AS orders_count, ROUND(SUM(o.total_amount), 2) AS revenue\nFROM orders o\nJOIN users u ON u.id = o.user_id\nGROUP BY u.region\nORDER BY revenue DESC;"),
    queryExample("engine", "String concatenation",
      mysql ? "MySQL commonly uses CONCAT(); PostgreSQL can use the || operator." : "PostgreSQL can concatenate with ||; MySQL commonly uses CONCAT().",
      mysql
        ? "SELECT id, CONCAT(email, ' · ', region) AS user_label\nFROM users\nORDER BY id\nLIMIT 10;"
        : "SELECT id, email || ' · ' || region AS user_label\nFROM users\nORDER BY id\nLIMIT 10;"),
    queryExample("engine", "JSON value extraction",
      mysql ? "MySQL uses JSON_EXTRACT / JSON_UNQUOTE for this form of extraction." : "PostgreSQL supports JSONB operators such as ->> for text extraction.",
      mysql
        ? "SELECT JSON_UNQUOTE(JSON_EXTRACT('{\"status\":\"paid\",\"channel\":\"web\"}', '$.status')) AS status;"
        : "SELECT '{\"status\":\"paid\",\"channel\":\"web\"}'::jsonb ->> 'status' AS status;"),
    queryExample("indexes", "Inspect a query plan", "See how the selected database engine plans the query.",
      mysql ? "EXPLAIN SELECT * FROM orders WHERE user_id = 1234;" : "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 1234;"),
    queryExample("indexes", "Create an index", "Add an index on orders.user_id, then run EXPLAIN again to compare.",
      "CREATE INDEX idx_orders_user_id ON orders(user_id);"),
  ];
}

function examplesFor(engine: Engine): QueryExample[] {
  return engine === "mongodb" ? mongoExamples() : sqlExamples(engine);
}

export default function DatabasePlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [engine, setEngine] = useState<Engine>("mysql");
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("database");
  const [exampleCategory, setExampleCategory] = useState<ExampleCategory>("basics");
  const [sql, setSql] = useState(STARTER_SQL.mysql);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const existing = localStorage.getItem(SESSION_KEY);
      const nextSession = existing && /^[A-Za-z0-9_-]{8,200}$/.test(existing) ? existing : newSessionId();
      localStorage.setItem(SESSION_KEY, nextSession);
      setSessionId(nextSession);
      const savedEngine = localStorage.getItem(ENGINE_KEY);
      const nextEngine: Engine = savedEngine === "postgres" || savedEngine === "mongodb" ? savedEngine : "mysql";
      setEngine(nextEngine);
      setSql(localStorage.getItem(`${SQL_KEY}:${nextEngine}`) || STARTER_SQL[nextEngine]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refreshSchema = useCallback(async () => {
    if (!sessionId) return;
    setSchemaLoading(true);
    setError("");
    try {
      const payload = await api<SchemaResponse>({ action: "schema", engine, sessionId });
      const tables = payload.tables || [];
      setSchema(tables);
      setSelectedTable((current) => tables.some((table) => table.name === current) ? current : "");
    } catch (reason) {
      setSchema([]);
      setSelectedTable("");
      setError(reason instanceof Error ? reason.message : "Could not load database structure.");
    } finally {
      setSchemaLoading(false);
    }
  }, [engine, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setTimeout(() => void refreshSchema(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSchema, sessionId]);

  const runQuery = useCallback(async () => {
    const statement = sql.trim();
    if (!sessionId || !statement || loading) return;
    localStorage.setItem(`${SQL_KEY}:${engine}`, statement);
    setLoading(true);
    setError("");
    try {
      const payload = await api<QueryResponse>({ action: "query", engine, sessionId, sql: statement });
      setResult(payload);
      const readOnly = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "FIND", "FINDONE", "COUNTDOCUMENTS", "AGGREGATE", "GETINDEXES"];
      if (!readOnly.includes(payload.statementType)) void refreshSchema();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Query failed.");
    } finally {
      setLoading(false);
    }
  }, [engine, loading, refreshSchema, sessionId, sql]);

  function changeEngine(next: Engine) {
    if (next === engine) return;
    localStorage.setItem(`${SQL_KEY}:${engine}`, sql);
    localStorage.setItem(ENGINE_KEY, next);
    setEngine(next);
    setSelectedTable("");
    setExampleCategory("basics");
    setSql(localStorage.getItem(`${SQL_KEY}:${next}`) || STARTER_SQL[next]);
    setResult(null);
    setError("");
  }

  function loadQuery(statement: string) {
    setSql(statement);
    setError("");
    editorRef.current?.focus();
  }

  async function resetDatabase() {
    if (!sessionId || loading) return;
    const name = engineLabel(engine);
    if (!window.confirm(`Reset ${name} database? All changes made in this playground database will be deleted.`)) return;
    setLoading(true);
    setError("");
    try {
      await api({ action: "reset", engine, sessionId });
      setResult(null);
      setSelectedTable("");
      setSql(STARTER_SQL[engine]);
      localStorage.setItem(`${SQL_KEY}:${engine}`, STARTER_SQL[engine]);
      await refreshSchema();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reset database.");
    } finally {
      setLoading(false);
    }
  }

  function handleEditorKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void runQuery();
    }
  }

  const categories = categoriesFor(engine);
  const queryExamples = examplesFor(engine).filter((example) => example.category === exampleCategory);
  const mongo = engine === "mongodb";

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
            <aside className={styles.technicalPanel}>
              <div className={styles.sideTabs} role="tablist" aria-label="Database playground sections">
                <button aria-selected={leftTab === "database"} className={leftTab === "database" ? styles.activeSideTab : ""} onClick={() => setLeftTab("database")} role="tab" type="button">Database</button>
                <button aria-selected={leftTab === "examples"} className={leftTab === "examples" ? styles.activeSideTab : ""} onClick={() => setLeftTab("examples")} role="tab" type="button">Examples</button>
              </div>

              {leftTab === "database" ? (
                <div className={styles.databaseView}>
                  <section className={styles.engineSection}>
                    <span className={styles.sectionLabel}>Database type</span>
                    <fieldset aria-label="Database engine" className={styles.engineSwitch}>
                      <button className={engine === "mysql" ? styles.activeEngine : ""} onClick={() => changeEngine("mysql")} type="button">MySQL 8</button>
                      <button className={engine === "postgres" ? styles.activeEngine : ""} onClick={() => changeEngine("postgres")} type="button">PostgreSQL 16</button>
                      <button className={engine === "mongodb" ? styles.activeEngine : ""} onClick={() => changeEngine("mongodb")} type="button">MongoDB 8</button>
                    </fieldset>
                  </section>

                  <div className={styles.tables}>
                    {schema.map((table) => {
                      const expanded = selectedTable === table.name;
                      return (
                        <div className={`${styles.tableCard} ${expanded ? styles.selectedTable : ""}`} key={table.name}>
                          <button className={styles.tableButton} onClick={() => setSelectedTable((current) => current === table.name ? "" : table.name)} type="button">
                            <span className={styles.chevron}>{expanded ? "⌄" : "›"}</span>
                            <strong>{table.name}</strong>
                            <span>{table.columns.length}</span>
                          </button>
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
                  <p className={styles.sideHint}>Click a {mongo ? "collection" : "table"} to expand or collapse its fields.</p>
                </div>
              ) : (
                <div className={styles.examplesView}>
                  <div className={styles.exampleCategories} role="tablist" aria-label="Database example categories">
                    {categories.map((category) => (
                      <button
                        aria-selected={exampleCategory === category.id}
                        className={exampleCategory === category.id ? styles.activeCategory : ""}
                        key={category.id}
                        onClick={() => setExampleCategory(category.id)}
                        role="tab"
                        type="button"
                      >{category.label}</button>
                    ))}
                  </div>
                  <div className={styles.examplesList}>
                    {queryExamples.map((example) => (
                      <article className={styles.exampleCard} key={example.title}>
                        <h2>{example.title}</h2>
                        <p>{example.description}</p>
                        <pre><code>{example.sql}</code></pre>
                        <button onClick={() => loadQuery(example.sql)} type="button">Use query</button>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            <section className={styles.workbench}>
              <section className={styles.editorPane}>
                <div className={styles.sectionHeader}>
                  <div><strong>Query</strong><span>{engineLabel(engine)}</span></div>
                  <span>Ctrl/Cmd + Enter</span>
                </div>
                <textarea
                  aria-label={mongo ? "MongoDB query editor" : "SQL editor"}
                  className={styles.editor}
                  onChange={(event) => setSql(event.target.value)}
                  onKeyDown={handleEditorKey}
                  ref={editorRef}
                  spellCheck={false}
                  value={sql}
                />
                <div className={styles.editorFooter}>
                  <div className={styles.editorActions}>
                    <button className={styles.ghostButton} disabled={schemaLoading} onClick={() => void refreshSchema()} type="button">Refresh</button>
                    <button className={styles.dangerButton} disabled={loading} onClick={() => void resetDatabase()} type="button">Reset</button>
                    <button className={styles.runButton} disabled={!sessionId || loading || !sql.trim()} onClick={() => void runQuery()} type="button">{loading ? "Running…" : mongo ? "Run query" : "Run SQL"}</button>
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
                      <div className={result ? styles.successResult : styles.emptyResult}>
                        {result?.message || "Run a query to see the result."}
                      </div>
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
