"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import ExecutableCodeRunner, { type WorkerRunnerMessage } from "./executable-code-runner";
import styles from "./executable-python-block.module.css";

const MAX_CODE_LENGTH = 12_000;
const MAX_RUNS_PER_WORKER = 30;
const INSPECT_TIMEOUT_MS = 60_000;

type SqlCell = string | number | null;
type SqlColumnInfo = {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
};
type SqlTableInfo = {
  name: string;
  columns: SqlColumnInfo[];
  rows: SqlCell[][];
  rowCount: number;
  truncated: boolean;
};
type SqlDatabaseInfo = {
  tables: SqlTableInfo[];
};
type SqlResult = {
  columns: string[];
  rows: SqlCell[][];
  changes: number;
  statementCount: number;
  truncated: boolean;
  message: string;
  database?: SqlDatabaseInfo;
};

const sqlTokenPattern = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|\b(SELECT|FROM|WHERE|GROUP|BY|HAVING|ORDER|ASC|DESC|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|AS|WITH|RECURSIVE|UNION|ALL|EXCEPT|INTERSECT|DISTINCT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|INDEX|VIEW|CASE|WHEN|THEN|ELSE|END|OVER|PARTITION|ROWS|BETWEEN|UNBOUNDED|PRECEDING|CURRENT|ROW|AND|OR|NOT|NULL|IS|IN|EXISTS|LIKE|LIMIT|OFFSET|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|CHECK|UNIQUE|BEGIN|COMMIT|ROLLBACK|EXPLAIN)\b|\b(COUNT|SUM|AVG|MIN|MAX|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|COALESCE|NULLIF|ROUND|LOWER|UPPER|LENGTH|CAST)\b|\b(\d+(?:\.\d+)?)\b/gim;

function highlightSql(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;
  sqlTokenPattern.lastIndex = 0;

  while ((match = sqlTokenPattern.exec(source)) !== null) {
    if (match.index > lastIndex) nodes.push(source.slice(lastIndex, match.index));
    const className = match[1]
      ? styles.tokenComment
      : match[2]
        ? styles.tokenString
        : match[3]
          ? styles.tokenKeyword
          : match[4]
            ? styles.tokenBuiltin
            : styles.tokenNumber;
    nodes.push(<span className={className} key={`sql-token-${tokenIndex++}`}>{match[0]}</span>);
    lastIndex = sqlTokenPattern.lastIndex;
  }

  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes;
}

function getSqlResult(message: WorkerRunnerMessage): SqlResult | null {
  if (!message.result || typeof message.result !== "object") return null;
  const candidate = message.result as Partial<SqlResult>;
  if (!Array.isArray(candidate.columns) || !Array.isArray(candidate.rows)) return null;
  return candidate as SqlResult;
}

function getDatabaseInfo(message: WorkerRunnerMessage): SqlDatabaseInfo | null {
  if (!message.result || typeof message.result !== "object") return null;
  const candidate = message.result as Partial<SqlResult> & Partial<SqlDatabaseInfo>;
  if (candidate.database && Array.isArray(candidate.database.tables)) return candidate.database;
  if (Array.isArray(candidate.tables)) return { tables: candidate.tables as SqlTableInfo[] };
  return null;
}

function formatSqlResult(message: WorkerRunnerMessage) {
  if (message.error) return message.error;
  return getSqlResult(message)?.message ?? "Query completed without a result.";
}

function ResultTable({ result }: { result: SqlResult }) {
  if (!result.columns.length) {
    return <pre aria-live="polite" className={styles.output}>{result.message}</pre>;
  }

  return (
    <div aria-live="polite" style={{ direction: "ltr", minWidth: "100%", padding: "14px 16px 18px 24px" }}>
      <table style={{ borderCollapse: "collapse", color: "#d4d4d4", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, minWidth: `${Math.max(360, result.columns.length * 96)}px`, tableLayout: "auto", width: "100%" }}>
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th key={column} style={{ borderBottom: "1px solid #454545", color: "#c8c8c8", fontWeight: 700, maxWidth: 240, overflowWrap: "anywhere", padding: "7px 10px", textAlign: "left" }}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {result.columns.map((column, columnIndex) => (
                <td key={`${column}-${columnIndex}`} style={{ borderBottom: "1px solid #303030", maxWidth: 240, overflowWrap: "anywhere", padding: "7px 10px", textAlign: "left", verticalAlign: "top" }}>
                  {row[columnIndex] === null ? <span style={{ color: "#858585" }}>NULL</span> : String(row[columnIndex] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ color: "#858585", fontSize: 11, paddingTop: 9 }}>
        {result.rows.length} row{result.rows.length === 1 ? "" : "s"}{result.truncated ? " shown · result truncated" : ""}
      </div>
    </div>
  );
}

function renderSqlResult(message: WorkerRunnerMessage) {
  const result = getSqlResult(message);
  return result ? <ResultTable result={result} /> : null;
}

function DatabasePanel({
  database,
  error,
  loading,
  selectedTable,
  onSelectTable,
}: {
  database: SqlDatabaseInfo | null;
  error: string;
  loading: boolean;
  selectedTable: string;
  onSelectTable: (name: string) => void;
}) {
  const table = database?.tables.find((candidate) => candidate.name === selectedTable) ?? database?.tables[0] ?? null;

  return (
    <section className={styles.databasePanel} aria-label="SQL sample database">
      <div className={styles.databaseHeader}>
        <div>
          <strong>Sample database</strong>
          <span>Current session · Reset restores sample data</span>
        </div>
        {database ? <span>{database.tables.length} tables</span> : null}
      </div>

      {loading ? <div className={styles.databaseState}>Loading sample database…</div> : null}
      {error ? <div className={styles.databaseError}>{error}</div> : null}

      {database && table ? (
        <>
          <div className={styles.databaseTabs} role="tablist" aria-label="Database tables">
            {database.tables.map((candidate) => (
              <button
                aria-selected={candidate.name === table.name}
                className={`${styles.databaseTab} ${candidate.name === table.name ? styles.databaseTabActive : ""}`}
                key={candidate.name}
                onClick={() => onSelectTable(candidate.name)}
                role="tab"
                type="button"
              >
                <span className={styles.databaseTabName}>{candidate.name}</span>
                <span className={styles.databaseTabCount}>{candidate.rowCount}</span>
              </button>
            ))}
          </div>

          <div className={styles.databaseTableMeta}>
            <strong>{table.name}</strong>
            <span>{table.rowCount} row{table.rowCount === 1 ? "" : "s"} · {table.columns.length} columns</span>
          </div>

          <div className={styles.databaseTableScroll}>
            <table className={styles.databaseTable} style={{ minWidth: `${Math.max(360, table.columns.length * 96)}px` }}>
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <th key={column.name}>
                      <span>{column.name}</span>
                      <small>{column.type || "ANY"}{column.primaryKey ? " · PK" : ""}{column.notNull ? " · NOT NULL" : ""}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {table.columns.map((column, columnIndex) => (
                      <td key={`${column.name}-${columnIndex}`}>
                        {row[columnIndex] === null ? <span className={styles.databaseNull}>NULL</span> : String(row[columnIndex] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.truncated ? <div className={styles.databaseState}>Showing the first {table.rows.length} rows.</div> : null}
        </>
      ) : null}
    </section>
  );
}

export default function ExecutableSqlBlock({ code }: { code: string }) {
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [database, setDatabase] = useState<SqlDatabaseInfo | null>(null);
  const [selectedTable, setSelectedTable] = useState("");
  const inspectorWorkerRef = useRef<Worker | null>(null);
  const inspectorTimeoutRef = useRef<number | null>(null);
  const inspectorRequestIdRef = useRef(0);

  const stopInspector = () => {
    if (inspectorTimeoutRef.current !== null) {
      window.clearTimeout(inspectorTimeoutRef.current);
      inspectorTimeoutRef.current = null;
    }
    inspectorWorkerRef.current?.terminate();
    inspectorWorkerRef.current = null;
  };

  useEffect(() => () => {
    if (inspectorTimeoutRef.current !== null) window.clearTimeout(inspectorTimeoutRef.current);
    inspectorWorkerRef.current?.terminate();
  }, []);

  const applyDatabase = (nextDatabase: SqlDatabaseInfo) => {
    setDatabase(nextDatabase);
    setDatabaseError("");
    setDatabaseLoading(false);
    setSelectedTable((current) => {
      if (current && nextDatabase.tables.some((table) => table.name === current)) return current;
      const normalizedCode = code.toLowerCase();
      const referenced = nextDatabase.tables.find((table) => normalizedCode.includes(table.name.toLowerCase()));
      return referenced?.name ?? nextDatabase.tables[0]?.name ?? "";
    });
  };

  const loadDatabase = (force = false) => {
    if (!force && (database || databaseLoading)) return;
    if (force) stopInspector();

    const requestId = inspectorRequestIdRef.current + 1;
    inspectorRequestIdRef.current = requestId;
    const worker = new Worker("/sql-runner.worker.mjs", { type: "module" });
    inspectorWorkerRef.current = worker;
    setDatabaseLoading(true);
    setDatabaseError("");

    const cleanup = () => {
      if (inspectorTimeoutRef.current !== null) {
        window.clearTimeout(inspectorTimeoutRef.current);
        inspectorTimeoutRef.current = null;
      }
      worker.terminate();
      if (inspectorWorkerRef.current === worker) inspectorWorkerRef.current = null;
    };

    const handleMessage = (event: MessageEvent<WorkerRunnerMessage>) => {
      const next = event.data;
      if (next.id !== requestId || next.type === "running") return;
      cleanup();
      if (next.error) {
        setDatabaseLoading(false);
        setDatabaseError(next.error);
        return;
      }

      const nextDatabase = getDatabaseInfo(next);
      if (!nextDatabase) {
        setDatabaseLoading(false);
        setDatabaseError("Sample database could not be read.");
        return;
      }

      applyDatabase(nextDatabase);
    };

    const handleError = () => {
      cleanup();
      setDatabaseLoading(false);
      setDatabaseError("Sample database viewer failed to start.");
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    inspectorTimeoutRef.current = window.setTimeout(() => {
      cleanup();
      setDatabaseLoading(false);
      setDatabaseError("Sample database viewer timed out while loading.");
    }, INSPECT_TIMEOUT_MS);
    worker.postMessage({ id: requestId, action: "inspect" });
  };

  const toggleDatabase = () => {
    const nextOpen = !databaseOpen;
    setDatabaseOpen(nextOpen);
    if (nextOpen && !database && !databaseLoading) loadDatabase();
  };

  const handleRunComplete = (message: WorkerRunnerMessage) => {
    if (message.error) return;
    const nextDatabase = getDatabaseInfo(message);
    if (nextDatabase) applyDatabase(nextDatabase);
  };

  const handleReset = () => {
    stopInspector();
    setDatabase(null);
    setSelectedTable("");
    setDatabaseError("");
    setDatabaseLoading(false);
    if (databaseOpen) loadDatabase(true);
  };

  return (
    <ExecutableCodeRunner
      additionalActions={(
        <button
          aria-expanded={databaseOpen}
          className={`${styles.secondaryButton} ${databaseOpen ? styles.databaseButtonActive : ""}`}
          onClick={toggleDatabase}
          title="View the sample SQLite database"
          type="button"
        >
          Database
        </button>
      )}
      additionalPanel={databaseOpen ? (
        <DatabasePanel
          database={database}
          error={databaseError}
          loading={databaseLoading}
          onSelectTable={setSelectedTable}
          selectedTable={selectedTable}
        />
      ) : null}
      code={code}
      formatResult={formatSqlResult}
      highlight={highlightSql}
      initialMessage="Run the query to see the result."
      key={code}
      language="SQL"
      loadingErrorMessage="SQLite runtime could not be loaded. Try again."
      loadingMessage="Loading SQLite runtime…"
      maxCodeLength={MAX_CODE_LENGTH}
      maxRunsPerWorker={MAX_RUNS_PER_WORKER}
      onReset={handleReset}
      onRunComplete={handleRunComplete}
      readyMeta="SQLite · sample DB · browser sandbox"
      renderResult={renderSqlResult}
      runnerErrorMessage="SQL runner failed to start. Try again."
      workerUrl="/sql-runner.worker.mjs"
    />
  );
}
