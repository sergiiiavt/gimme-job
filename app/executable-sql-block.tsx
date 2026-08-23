"use client";

import { type ReactNode } from "react";
import ExecutableCodeRunner, { type WorkerRunnerMessage } from "./executable-code-runner";
import styles from "./executable-python-block.module.css";

const MAX_CODE_LENGTH = 12_000;
const MAX_RUNS_PER_WORKER = 30;

type SqlCell = string | number | null;
type SqlResult = {
  columns: string[];
  rows: SqlCell[][];
  changes: number;
  statementCount: number;
  truncated: boolean;
  message: string;
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

function renderSqlResult(message: WorkerRunnerMessage) {
  const result = getSqlResult(message);
  return result ? <ResultTable result={result} /> : null;
}

export default function ExecutableSqlBlock({ code }: { code: string }) {
  return (
    <ExecutableCodeRunner
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
      readyMeta="SQLite · sample DB · browser sandbox"
      renderResult={renderSqlResult}
      runnerErrorMessage="SQL runner failed to start. Try again."
      workerUrl="/sql-runner.worker.mjs"
    />
  );
}
