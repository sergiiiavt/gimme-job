"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./executable-python-block.module.css";

type RunnerStatus = "idle" | "loading" | "running";
type SqlCell = string | number | null;
type SqlResult = {
  columns: string[];
  rows: SqlCell[][];
  changes: number;
  statementCount: number;
  truncated: boolean;
  message: string;
};
type RunnerMessage = {
  id: number;
  type: "running" | "result";
  result?: SqlResult;
  error?: string;
};

const LOAD_TIMEOUT_MS = 60_000;
const EXECUTION_TIMEOUT_MS = 5_000;
const MAX_CODE_LENGTH = 12_000;
const MAX_RUNS_PER_WORKER = 30;
const EDITOR_LINE_HEIGHT_PX = 21;
const EDITOR_VERTICAL_CHROME_PX = 68;
const EDITOR_MIN_HEIGHT_PX = 118;
const EDITOR_MAX_HEIGHT_PX = 520;

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

function ResultTable({ result }: { result: SqlResult }) {
  if (!result.columns.length) {
    return <pre aria-live="polite" className={styles.output}>{result.message}</pre>;
  }

  return (
    <div aria-live="polite" style={{ direction: "ltr", minWidth: "100%", padding: "14px 16px 18px 24px" }}>
      <table style={{ borderCollapse: "collapse", color: "#d4d4d4", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, minWidth: "100%", whiteSpace: "nowrap" }}>
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th key={column} style={{ borderBottom: "1px solid #454545", color: "#c8c8c8", fontWeight: 700, padding: "7px 10px", textAlign: "left" }}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {result.columns.map((column, columnIndex) => (
                <td key={`${column}-${columnIndex}`} style={{ borderBottom: "1px solid #303030", padding: "7px 10px", textAlign: "left" }}>
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

export default function ExecutableSqlBlock({ code }: { code: string }) {
  return <ExecutableSqlBlockInstance code={code} key={code} />;
}

function ExecutableSqlBlockInstance({ code }: { code: string }) {
  const [draft, setDraft] = useState(code);
  const [message, setMessage] = useState("Run the query to see the result.");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [status, setStatus] = useState<RunnerStatus>("idle");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const runCountRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const clearCopiedTimer = () => {
    if (copiedTimeoutRef.current !== null) {
      window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
  };

  const destroyWorker = () => {
    clearTimer();
    workerRef.current?.terminate();
    workerRef.current = null;
    runCountRef.current = 0;
  };

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current);
    workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  const failAfter = (milliseconds: number, nextMessage: string) => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      destroyWorker();
      setStatus("idle");
      setResult(null);
      setMessage(nextMessage);
    }, milliseconds);
  };

  const run = () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const worker = workerRef.current ?? new Worker("/sql-runner.worker.mjs", { type: "module" });
    workerRef.current = worker;

    setStatus("loading");
    setResult(null);
    setMessage("Loading SQLite runtime…");
    failAfter(LOAD_TIMEOUT_MS, "SQLite runtime could not be loaded. Try again.");

    const cleanupListeners = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const handleMessage = (event: MessageEvent<RunnerMessage>) => {
      const next = event.data;
      if (next.id !== requestId) return;

      if (next.type === "running") {
        setStatus("running");
        setMessage("Running…");
        failAfter(EXECUTION_TIMEOUT_MS, "Execution stopped after 5 seconds.");
        return;
      }

      cleanupListeners();
      clearTimer();
      setStatus("idle");
      if (next.error) {
        setResult(null);
        setMessage(next.error);
      } else if (next.result) {
        setResult(next.result);
        setMessage(next.result.message);
      } else {
        setResult(null);
        setMessage("Query completed without a result.");
      }
      runCountRef.current += 1;
      if (runCountRef.current >= MAX_RUNS_PER_WORKER) destroyWorker();
    };

    const handleError = () => {
      cleanupListeners();
      destroyWorker();
      setStatus("idle");
      setResult(null);
      setMessage("SQL runner failed to start. Try again.");
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ id: requestId, code: draft });
  };

  const stop = () => {
    destroyWorker();
    setStatus("idle");
    setResult(null);
    setMessage("Execution stopped.");
  };

  const reset = () => {
    destroyWorker();
    clearCopiedTimer();
    setCopied(false);
    setDraft(code);
    setStatus("idle");
    setResult(null);
    setMessage("Run the query to see the result.");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      clearCopiedTimer();
      setCopied(true);
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 1_400);
    } catch {
      setCopied(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setMessage("");
  };

  const codeLines = draft.split("\n");
  const editorContentHeight = Math.max(
    EDITOR_MIN_HEIGHT_PX,
    codeLines.length * EDITOR_LINE_HEIGHT_PX + EDITOR_VERTICAL_CHROME_PX,
  );
  const editorViewportHeight = Math.min(EDITOR_MAX_HEIGHT_PX, editorContentHeight);
  const editorColumns = Math.max(1, ...codeLines.map((line) => line.length)) + 4;
  const busy = status !== "idle";

  return (
    <div className={`${styles.shell} ${expanded ? styles.expanded : ""}`}>
      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Editable SQL query">
          <div className={styles.header}>
            <div className={styles.headerStart}>
              <button
                aria-label={expanded ? "Collapse SQL runner" : "Expand SQL runner"}
                className={styles.expandButton}
                onClick={() => setExpanded((value) => !value)}
                title={expanded ? "Collapse" : "Expand"}
                type="button"
              >
                {expanded ? (
                  <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M6.5 2v4.5H2M9.5 14V9.5H14M6.5 6.5 2.5 2.5M9.5 9.5l4 4" /></svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M6 2H2v4M10 14h4v-4M2.5 5.5l4-4M9.5 14.5l4-4" /></svg>
                )}
              </button>
              <span>SQL</span>
            </div>
            <span className={styles.meta}>{status === "loading" ? "loading runtime" : "SQLite · sample DB · browser sandbox"}</span>
          </div>
          <div className={styles.editorFrame} style={{ height: `${editorViewportHeight}px` }}>
            <div className={styles.editorScroll}>
              <div
                className={styles.editorCanvas}
                style={{ height: `${editorContentHeight}px`, width: `max(100%, ${editorColumns}ch)` }}
              >
                <pre aria-hidden="true" className={styles.highlight}>{highlightSql(draft)}{"\n"}</pre>
                <textarea
                  aria-label="SQL query"
                  className={styles.editor}
                  maxLength={MAX_CODE_LENGTH}
                  onChange={(event) => setDraft(event.target.value)}
                  spellCheck={false}
                  value={draft}
                />
              </div>
            </div>
            <div className={styles.actionDock}>
              {busy ? (
                <button className={styles.primaryButton} onClick={stop} type="button">Stop</button>
              ) : (
                <button className={styles.primaryButton} onClick={run} type="button">Run</button>
              )}
              <button className={styles.secondaryButton} onClick={reset} type="button">Reset</button>
              <button className={styles.secondaryButton} onClick={copy} type="button">{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.resultPanel}`} aria-label="SQL execution result">
          <div className={styles.header}>
            <span>Result</span>
            <button className={styles.clearButton} onClick={clearResult} type="button">Clear</button>
          </div>
          <div className={styles.outputScroll}>
            {result ? <ResultTable result={result} /> : <pre aria-live="polite" className={styles.output}>{message}</pre>}
          </div>
        </section>
      </div>
    </div>
  );
}
