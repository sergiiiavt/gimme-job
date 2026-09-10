"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SiteSidebar } from "../../site-navigation";
import styles from "./database-playground.module.css";

type Engine = "mysql" | "postgres";
type ResultTab = "data" | "structure" | "history";
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
type HistoryItem = { id: string; engine: Engine; sql: string; durationMs: number | null; ok: boolean; at: string };

const SESSION_KEY = "gimmejob-db-lab-session-v1";
const HISTORY_KEY = "gimmejob-db-lab-history-v1";
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

function readHistory(): HistoryItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is HistoryItem => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const candidate = item as Partial<HistoryItem>;
      return typeof candidate.sql === "string" && (candidate.engine === "mysql" || candidate.engine === "postgres");
    }).slice(0, 50);
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

function quoteIdentifier(value: string, engine: Engine): string {
  return engine === "mysql" ? `\`${value.replaceAll("`", "``")}\`` : `"${value.replaceAll('"', '""')}"`;
}

export default function DatabasePlayground() {
  const [mobileNav, setMobileNav] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [engine, setEngine] = useState<Engine>("mysql");
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [workspace, setWorkspace] = useState("Workspace");
  const [selectedTable, setSelectedTable] = useState("orders");
  const [sql, setSql] = useState(STARTER_SQL.mysql);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [tab, setTab] = useState<ResultTab>("data");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = localStorage.getItem(SESSION_KEY);
    const nextSession = existing && /^[A-Za-z0-9_-]{8,200}$/.test(existing) ? existing : newSessionId();
    localStorage.setItem(SESSION_KEY, nextSession);
    setSessionId(nextSession);
    const savedEngine = localStorage.getItem(ENGINE_KEY);
    const nextEngine: Engine = savedEngine === "postgres" ? "postgres" : "mysql";
    setEngine(nextEngine);
    setSql(localStorage.getItem(`${SQL_KEY}:${nextEngine}`) || STARTER_SQL[nextEngine]);
    setHistory(readHistory());
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
    if (sessionId) void refreshSchema();
  }, [refreshSchema, sessionId]);

  const selectedStructure = useMemo(
    () => schema.find((table) => table.name === selectedTable)?.columns || [],
    [schema, selectedTable],
  );

  const addHistory = useCallback((item: HistoryItem) => {
    setHistory((current) => {
      const next = [item, ...current].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

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
      setTab("data");
      addHistory({ id: crypto.randomUUID(), engine, sql: statement, durationMs: payload.durationMs, ok: true, at: new Date().toISOString() });
      if (!["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"].includes(payload.statementType)) void refreshSchema();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Query failed.");
      addHistory({ id: crypto.randomUUID(), engine, sql: statement, durationMs: null, ok: false, at: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [addHistory, engine, loading, refreshSchema, sessionId, sql, workspace]);

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

  function openTable(table: string) {
    setSelectedTable(table);
    const name = quoteIdentifier(table, engine);
    const statement = `SELECT * FROM ${name} LIMIT 100;`;
    setSql(statement);
    void runSql(statement);
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
              <div><h1>Database Playground</h1><p>Real MySQL and PostgreSQL · persistent test workspace</p></div>
              <div className={styles.toolbarActions}>
                <div aria-label="Database engine" className={styles.engineSwitch} role="group">
                  <button className={engine === "mysql" ? styles.activeEngine : ""} onClick={() => changeEngine("mysql")} type="button">MySQL 8</button>
                  <button className={engine === "postgres" ? styles.activeEngine : ""} onClick={() => changeEngine("postgres")} type="button">PostgreSQL 16</button>
                </div>
                <button className={styles.ghostButton} disabled={schemaLoading} onClick={() => void refreshSchema()} type="button">Refresh</button>
                <button className={styles.dangerButton} disabled={loading} onClick={() => void resetWorkspace()} type="button">Reset</button>
              </div>
            </header>

            <div className={styles.statusBar}>
              <span className={styles.liveDot}/><strong>{workspace}</strong><span>isolated test data</span><span>50k orders · 10k users · 200 products</span><span>7s query limit</span>
            </div>

            <div className={styles.body}>
              <aside className={styles.schemaPane}>
                <div className={styles.paneHeading}><strong>Schema</strong><span>{schemaLoading ? "loading…" : `${schema.length} tables`}</span></div>
                <div className={styles.tables}>
                  {schema.map((table) => (
                    <div className={`${styles.tableCard} ${selectedTable === table.name ? styles.selectedTable : ""}`} key={table.name}>
                      <button onClick={() => setSelectedTable(table.name)} type="button"><span className={styles.tableIcon}>▦</span><strong>{table.name}</strong><span>{table.columns.length}</span></button>
                      {selectedTable === table.name && (
                        <div className={styles.columnList}>
                          {table.columns.map((column) => <button key={column.name} onClick={() => setTab("structure")} type="button"><span>{column.name}</span><small>{column.type}</small></button>)}
                          <button className={styles.openTable} onClick={() => openTable(table.name)} type="button">Open table</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!schemaLoading && !schema.length && <p className={styles.empty}>Schema unavailable.</p>}
                </div>
              </aside>

              <div className={styles.workPane}>
                <section className={styles.editorPane}>
                  <div className={styles.editorHeader}>
                    <div className={styles.quickQueries}>
                      <button onClick={() => setSql(`SELECT * FROM ${quoteIdentifier(selectedTable || "orders", engine)} LIMIT 20;`)} type="button">SELECT</button>
                      <button onClick={() => setSql("SELECT u.region, COUNT(*) AS orders_count, ROUND(SUM(o.total_amount), 2) AS revenue\nFROM orders o\nJOIN users u ON u.id = o.user_id\nGROUP BY u.region\nORDER BY revenue DESC;")} type="button">JOIN + GROUP BY</button>
                      <button onClick={() => setSql(engine === "mysql" ? "EXPLAIN SELECT * FROM orders WHERE user_id = 1234;" : "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 1234;")} type="button">EXPLAIN</button>
                      <button onClick={() => setSql("CREATE INDEX idx_orders_user_id ON orders(user_id);")} type="button">CREATE INDEX</button>
                    </div>
                    <span>Ctrl/Cmd + Enter</span>
                  </div>
                  <textarea aria-label="SQL editor" className={styles.editor} onChange={(event) => setSql(event.target.value)} onKeyDown={handleEditorKey} spellCheck={false} value={sql}/>
                  <div className={styles.editorFooter}><span>{engine === "mysql" ? "database workspace" : "schema workspace"}</span><button className={styles.runButton} disabled={!sessionId || loading || !sql.trim()} onClick={() => void runSql()} type="button">{loading ? "Running…" : "Run SQL"}</button></div>
                </section>

                <section className={styles.resultsPane}>
                  <div className={styles.resultTabs}>
                    <button className={tab === "data" ? styles.activeTab : ""} onClick={() => setTab("data")} type="button">Data</button>
                    <button className={tab === "structure" ? styles.activeTab : ""} onClick={() => setTab("structure")} type="button">Structure</button>
                    <button className={tab === "history" ? styles.activeTab : ""} onClick={() => setTab("history")} type="button">History <span>{history.length}</span></button>
                    <div className={styles.resultMeta}>{result && <><span>{result.rowCount} rows</span><span>{result.durationMs} ms</span>{result.truncated && <span>truncated</span>}</>}</div>
                  </div>

                  {error && <div className={styles.error} role="alert"><strong>Query error</strong><pre>{error}</pre></div>}

                  {tab === "data" && !error && (
                    <div className={styles.dataView}>
                      {result?.columns.length ? (
                        <div className={styles.gridWrap}><table className={styles.grid}><thead><tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleRows.map((row, rowIndex) => <tr key={`${page}-${rowIndex}`}>{row.map((cell, cellIndex) => <td className={cell === null ? styles.nullCell : ""} key={`${rowIndex}-${cellIndex}`}>{cell === null ? "NULL" : cell}</td>)}</tr>)}</tbody></table></div>
                      ) : <div className={styles.emptyResult}>{result?.message || "Run a query to see real database results."}</div>}
                      {result?.columns.length ? <div className={styles.pagination}><span>Page {page + 1} of {totalPages}</span><div><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Previous</button><button disabled={page + 1 >= totalPages} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} type="button">Next</button></div></div> : null}
                    </div>
                  )}

                  {tab === "structure" && (
                    <div className={styles.structureView}><h2>{selectedTable || "Table"}</h2><table className={styles.structureTable}><thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>Default</th><th>Key</th></tr></thead><tbody>{selectedStructure.map((column) => <tr key={column.name}><td>{column.name}</td><td><code>{column.type}</code></td><td>{column.nullable ? "YES" : "NO"}</td><td>{column.default || "—"}</td><td>{column.key || "—"}</td></tr>)}</tbody></table></div>
                  )}

                  {tab === "history" && (
                    <div className={styles.historyView}>
                      {history.map((item) => <button key={item.id} onClick={() => { changeEngine(item.engine); setSql(item.sql); }} type="button"><div><strong>{item.ok ? "OK" : "ERROR"}</strong><span>{item.engine === "mysql" ? "MySQL" : "PostgreSQL"}</span><span>{item.durationMs === null ? "—" : `${item.durationMs} ms`}</span><time>{new Date(item.at).toLocaleString()}</time></div><code>{item.sql}</code></button>)}
                      {!history.length && <div className={styles.emptyResult}>Query history is stored in this browser.</div>}
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
