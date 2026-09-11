"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { SiteSidebar } from "../../site-navigation";
import styles from "./database-playground.module.css";

type Engine = "mysql" | "postgres";
type LeftTab = "database" | "examples";
type ColumnInfo = { name: string; type: string; nullable: boolean; default: string | null; key: string | null };
type TableInfo = { name: string; columns: ColumnInfo[] };
type SchemaResponse = { engine: Engine; workspace: string; tables: TableInfo[] };
type QueryResponse = {
  engine: Engine;
  workspace: string;
  statementType: string;
  columns: string[];
  rows: Array<Array<string | null>>;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  message: string | null;
};
type QueryExample = { title: string; description: string; sql: string };

const SESSION_KEY = "gimmejob-db-lab-session-v1";
const ENGINE_KEY = "gimmejob-db-lab-engine-v1";
const SQL_KEY = "gimmejob-db-lab-sql-v1";
const PAGE_SIZE = 25;
const STARTER_SQL: Record<Engine, string> = {
  mysql: "SELECT id, user_id, status, total_amount, created_at\nFROM orders\nORDER BY id DESC\nLIMIT 20;",
  postgres: "SELECT id, user_id, status, total_amount, created_at\nFROM orders\nORDER BY id DESC\nLIMIT 20;",
};

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

function quoteIdentifier(value: string, engine: Engine): string {
  return engine === "mysql" ? `\`${value.replaceAll("`", "``")}\`` : `"${value.replaceAll('"', '""')}"`;
}

function examplesFor(engine: Engine): QueryExample[] {
  return [
    {
      title: "Select rows",
      description: "Read recent rows from a table.",
      sql: "SELECT *\nFROM orders\nORDER BY id DESC\nLIMIT 20;",
    },
    {
      title: "Filter rows",
      description: "Return only rows matching a condition.",
      sql: "SELECT id, user_id, status, total_amount\nFROM orders\nWHERE status = 'paid'\nORDER BY id DESC\nLIMIT 20;",
    },
    {
      title: "JOIN tables",
      description: "Combine orders with their related users.",
      sql: "SELECT o.id, u.email, u.region, o.status, o.total_amount\nFROM orders o\nJOIN users u ON u.id = o.user_id\nORDER BY o.id DESC\nLIMIT 20;",
    },
    {
      title: "GROUP BY",
      description: "Aggregate rows and compare groups.",
      sql: "SELECT channel, COUNT(*) AS orders_count, ROUND(SUM(total_amount), 2) AS revenue\nFROM orders\nGROUP BY channel\nORDER BY revenue DESC;",
    },
    {
      title: "EXPLAIN",
      description: "Inspect how the database plans a query.",
      sql: engine === "mysql"
        ? "EXPLAIN SELECT * FROM orders WHERE user_id = 1234;"
        : "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 1234;",
    },
    {
      title: "CREATE INDEX",
      description: "Add an index, then compare the query plan.",
      sql: "CREATE INDEX idx_orders_user_id ON orders(user_id);",
    },
  ];
}

export default function DatabasePlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [engine, setEngine] = useState<Engine>("mysql");
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [workspace, setWorkspace] = useState("Workspace");
  const [selectedTable, setSelectedTable] = useState("orders");
  const [leftTab, setLeftTab] = useState<LeftTab>("database");
  const [sql, setSql] = useState(STARTER_SQL.mysql);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [page, setPage] = useState(0);
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
      setWorkspace(payload.workspace || "Workspace");
      setSelectedTable((current) => tables.some((table) => table.name === current) ? current : (tables[0]?.name || ""));
    } catch (reason) {
      setSchema([]);
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

  const runSql = useCallback(async (override?: string) => {
    const statement = (override ?? sql).trim();
    if (!sessionId || !statement || loading) return;
    if (override !== undefined) setSql(statement);
    localStorage.setItem(`${SQL_KEY}:${engine}`, statement);
    setLoading(true);
    setError("");
    setPage(0);
    try {
      const payload = await api<QueryResponse>({ action: "query", engine, sessionId, sql: statement });
      setResult(payload);
      setWorkspace(payload.workspace || workspace);
      if (!["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"].includes(payload.statementType)) void refreshSchema();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Query failed.");
    } finally {
      setLoading(false);
    }
  }, [engine, loading, refreshSchema, sessionId, sql, workspace]);

  function changeEngine(next: Engine) {
    if (next === engine) return;
    localStorage.setItem(`${SQL_KEY}:${engine}`, sql);
    localStorage.setItem(ENGINE_KEY, next);
    setEngine(next);
    setSql(localStorage.getItem(`${SQL_KEY}:${next}`) || STARTER_SQL[next]);
    setResult(null);
    setPage(0);
    setError("");
  }

  function loadQuery(statement: string) {
    setSql(statement);
    setError("");
    editorRef.current?.focus();
  }

  function previewTable(table: string) {
    setSelectedTable(table);
    setLeftTab("database");
    const statement = `SELECT * FROM ${quoteIdentifier(table, engine)} LIMIT 100;`;
    void runSql(statement);
  }

  function insertIdentifier(identifier: string) {
    const value = quoteIdentifier(identifier, engine);
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? sql.length;
    const end = editor?.selectionEnd ?? sql.length;
    const next = `${sql.slice(0, start)}${value}${sql.slice(end)}`;
    setSql(next);
    window.requestAnimationFrame(() => {
      if (!editor) return;
      const cursor = start + value.length;
      editor.focus();
      editor.setSelectionRange(cursor, cursor);
    });
  }

  async function resetWorkspace() {
    if (!sessionId || loading) return;
    if (!window.confirm(`Reset ${engine === "mysql" ? "MySQL" : "PostgreSQL"} ${workspace}? All changes in this playground workspace will be deleted.`)) return;
    setLoading(true);
    setError("");
    try {
      await api({ action: "reset", engine, sessionId });
      setResult(null);
      setSql(STARTER_SQL[engine]);
      localStorage.setItem(`${SQL_KEY}:${engine}`, STARTER_SQL[engine]);
      await refreshSchema();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reset workspace.");
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

  const totalPages = result ? Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE)) : 1;
  const visibleRows = result?.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) || [];
  const queryExamples = examplesFor(engine);

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
          <section className={styles.client}>
            <header className={styles.toolbar}>
              <div>
                <h1>Database Playground</h1>
                <p>Explore the database, write SQL, and inspect the result.</p>
              </div>
              <div className={styles.toolbarActions}>
                <fieldset aria-label="Database engine" className={styles.engineSwitch}>
                  <button className={engine === "mysql" ? styles.activeEngine : ""} onClick={() => changeEngine("mysql")} type="button">MySQL 8</button>
                  <button className={engine === "postgres" ? styles.activeEngine : ""} onClick={() => changeEngine("postgres")} type="button">PostgreSQL 16</button>
                </fieldset>
                <button className={styles.ghostButton} disabled={schemaLoading} onClick={() => void refreshSchema()} type="button">Refresh</button>
                <button className={styles.dangerButton} disabled={loading} onClick={() => void resetWorkspace()} type="button">Reset</button>
              </div>
            </header>

            <div className={styles.body}>
              <aside className={styles.sidePane}>
                <div className={styles.sideTabs} role="tablist" aria-label="Database sidebar">
                  <button aria-selected={leftTab === "database"} className={leftTab === "database" ? styles.activeSideTab : ""} onClick={() => setLeftTab("database")} role="tab" type="button">Database</button>
                  <button aria-selected={leftTab === "examples"} className={leftTab === "examples" ? styles.activeSideTab : ""} onClick={() => setLeftTab("examples")} role="tab" type="button">Examples</button>
                </div>

                {leftTab === "database" ? (
                  <div className={styles.databaseView}>
                    <div className={styles.paneHeading}>
                      <div><strong>{workspace}</strong><span>{engine === "mysql" ? "MySQL 8" : "PostgreSQL 16"}</span></div>
                      <span>{schemaLoading ? "loading…" : `${schema.length} tables`}</span>
                    </div>
                    <div className={styles.tables}>
                      {schema.map((table) => (
                        <div className={`${styles.tableCard} ${selectedTable === table.name ? styles.selectedTable : ""}`} key={table.name}>
                          <button className={styles.tableButton} onClick={() => setSelectedTable(table.name)} type="button">
                            <span className={styles.chevron}>{selectedTable === table.name ? "⌄" : "›"}</span>
                            <strong>{table.name}</strong>
                            <span>{table.columns.length}</span>
                          </button>
                          {selectedTable === table.name && (
                            <div className={styles.columnList}>
                              {table.columns.map((column) => (
                                <button key={column.name} onClick={() => insertIdentifier(column.name)} title={`Insert ${column.name} into the query`} type="button">
                                  <span className={styles.columnName}>{column.name}{column.key ? <em>{column.key}</em> : null}</span>
                                  <small>{column.type}</small>
                                </button>
                              ))}
                              <button className={styles.previewButton} onClick={() => previewTable(table.name)} type="button">Preview rows</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {!schemaLoading && !schema.length && <p className={styles.empty}>Database structure is unavailable.</p>}
                    </div>
                    <p className={styles.sideHint}>Select a table to see its columns. Click a column to insert it into the query.</p>
                  </div>
                ) : (
                  <div className={styles.examplesView}>
                    <div className={styles.paneHeading}>
                      <div><strong>Typical queries</strong><span>Start from a working example</span></div>
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

              <div className={styles.workPane}>
                <section className={styles.editorPane}>
                  <div className={styles.sectionHeader}>
                    <div><strong>Query</strong><span>{engine === "mysql" ? "MySQL 8" : "PostgreSQL 16"} · {workspace}</span></div>
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
                    <span>Queries run against your persistent test workspace.</span>
                    <button className={styles.runButton} disabled={!sessionId || loading || !sql.trim()} onClick={() => void runSql()} type="button">{loading ? "Running…" : "Run SQL"}</button>
                  </div>
                </section>

                <section className={styles.resultsPane}>
                  <div className={styles.sectionHeader}>
                    <div><strong>Results</strong><span>{result ? result.statementType : "Query output"}</span></div>
                    <div className={styles.resultMeta}>
                      {result && !error ? <><span>{result.rowCount} rows</span><span>{result.durationMs} ms</span>{result.truncated && <span>truncated</span>}</> : null}
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
                            <tbody>{visibleRows.map((row, rowIndex) => <tr key={`${page}-${rowIndex}`}>{row.map((cell, cellIndex) => <td className={cell === null ? styles.nullCell : ""} key={`${rowIndex}-${cellIndex}`}>{cell ?? "NULL"}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      ) : (
                        <div className={result ? styles.successResult : styles.emptyResult}>
                          {result?.message || "Run a query to see the result."}
                        </div>
                      )}
                      {result?.columns.length ? (
                        <div className={styles.pagination}>
                          <span>Page {page + 1} of {totalPages}</span>
                          <div>
                            <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Previous</button>
                            <button disabled={page + 1 >= totalPages} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} type="button">Next</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </section>
        </div>
      </section>
      {mobileNav && <button aria-label="Close navigation" className="kb-backdrop" onClick={() => setMobileNav(false)} type="button"/>}
    </main>
  );
}
