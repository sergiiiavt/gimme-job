"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../../site-navigation";
import styles from "./database-playground.module.css";

type Engine = "mysql" | "postgres";
type LeftTab = "database" | "examples";
type ExampleCategory = "basics" | "joins" | "aggregation" | "engine" | "indexes";
type ColumnInfo = { name: string; type: string; nullable: boolean; default: string | null; key: string | null };
type TableInfo = { name: string; columns: ColumnInfo[] };
type SchemaResponse = { tables: TableInfo[] };
type QueryResponse = {
  statementType: string;
  columns: string[];
  rows: Array<Array<string | null>>;
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
};
const EXAMPLE_CATEGORIES: Array<{ id: ExampleCategory; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "joins", label: "Joins" },
  { id: "aggregation", label: "Aggregation" },
  { id: "engine", label: "Engine differences" },
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

function examplesFor(engine: Engine): QueryExample[] {
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
      const nextEngine: Engine = savedEngine === "postgres" ? "postgres" : "mysql";
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
      setError(reason instanceof Error ? reason.message : "Could not load database schema.");
    } finally {
      setSchemaLoading(false);
    }
  }, [engine, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setTimeout(() => void refreshSchema(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSchema, sessionId]);

  const runSql = useCallback(async () => {
    const statement = sql.trim();
    if (!sessionId || !statement || loading) return;
    localStorage.setItem(`${SQL_KEY}:${engine}`, statement);
    setLoading(true);
    setError("");
    try {
      const payload = await api<QueryResponse>({ action: "query", engine, sessionId, sql: statement });
      setResult(payload);
      if (!["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"].includes(payload.statementType)) void refreshSchema();
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
    const engineName = engine === "mysql" ? "MySQL" : "PostgreSQL";
    if (!window.confirm(`Reset ${engineName} database? All changes made in this playground database will be deleted.`)) return;
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
      void runSql();
    }
  }

  const queryExamples = examplesFor(engine).filter((example) => example.category === exampleCategory);

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
                  <p className={styles.sideHint}>Click a table to expand or collapse its columns.</p>
                </div>
              ) : (
                <div className={styles.examplesView}>
                  <div className={styles.exampleCategories} role="tablist" aria-label="SQL example categories">
                    {EXAMPLE_CATEGORIES.map((category) => (
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
                  <div><strong>Query</strong><span>{engine === "mysql" ? "MySQL 8" : "PostgreSQL 16"}</span></div>
                  <span>Ctrl/Cmd + Enter</span>
                </div>
                <textarea
                  aria-label="SQL editor"
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
                    <button className={styles.runButton} disabled={!sessionId || loading || !sql.trim()} onClick={() => void runSql()} type="button">{loading ? "Running…" : "Run SQL"}</button>
                  </div>
                </div>
              </section>

              <section className={styles.resultsPane}>
                <div className={styles.sectionHeader}>
                  <div><strong>Results</strong><span>{result ? result.statementType : "Query output"}</span></div>
                  <div className={styles.resultMeta}>
                    {result && !error ? <><span>{result.rows.length} rows</span><span>{result.durationMs} ms</span>{result.truncated && <span>truncated</span>}</> : null}
                  </div>
                </div>

                {error ? (
                  <div className={styles.error} role="alert"><strong>Query error</strong><pre>{error}</pre></div>
                ) : (
                  <div className={styles.dataView}>
                    {result?.columns.length ? (
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