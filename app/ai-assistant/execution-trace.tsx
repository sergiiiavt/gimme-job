import styles from "./execution-trace.module.css";

export type TraceScalar = string | number | boolean | null;

export type TraceRetrievalResult = {
  title: string;
  kind: "learning" | "question";
  score: number;
  sourcePath: string;
  excerpt: string;
};

export type TraceTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ExecutionStep = {
  id: string;
  label: string;
  detail: string;
  durationMs: number;
  input: Record<string, TraceScalar>;
  output: Record<string, TraceScalar>;
  retrievalResults: TraceRetrievalResult[];
  tokenUsage: TraceTokenUsage | null;
};

export type ExecutionTraceData = {
  requestId: string;
  sessionId: string;
  model: string;
  langfuseTracing: boolean;
  langfuseTraceUrl: string | null;
  orchestration: "langgraph";
  retrievalMode: "repository" | "general";
  totalDurationMs: number;
  workflowSteps: ExecutionStep[];
};

function TraceIcon({ active = false }: Readonly<{ active?: boolean }>) {
  return <span aria-hidden="true" className={active ? styles.activeDot : styles.dot}/>;
}

function shortIdentifier(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatDuration(value: number): string {
  if (value < 1) return "<1 ms";
  if (value < 1_000) return `${Math.round(value)} ms`;
  return `${(value / 1_000).toFixed(value < 10_000 ? 2 : 1)} s`;
}

function formatTraceValue(value: TraceScalar): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return value;
}

function TraceFields({ label, values }: Readonly<{
  label: string;
  values: Record<string, TraceScalar>;
}>) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;
  return (
    <section className={styles.traceFields}>
      <span>{label}</span>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>{formatTraceValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RetrievalResults({ results }: Readonly<{ results: TraceRetrievalResult[] }>) {
  if (results.length === 0) return null;
  return (
    <section className={styles.retrievalBlock}>
      <span>Retrieved context</span>
      <ol>
        {results.map((result, index) => (
          <li key={`${result.sourcePath}-${index}`}>
            <header>
              <strong>{result.title}</strong>
              <code>{result.score.toFixed(4)}</code>
            </header>
            <small>{result.kind} · {result.sourcePath}</small>
            <pre>{result.excerpt}</pre>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TokenUsage({ usage }: Readonly<{ usage: TraceTokenUsage | null }>) {
  if (!usage) return null;
  return (
    <section className={styles.tokenUsage}>
      <span>Token usage</span>
      <dl>
        <div><dt>Input</dt><dd>{usage.inputTokens.toLocaleString()}</dd></div>
        <div><dt>Output</dt><dd>{usage.outputTokens.toLocaleString()}</dd></div>
        <div><dt>Total</dt><dd>{usage.totalTokens.toLocaleString()}</dd></div>
      </dl>
    </section>
  );
}

export function ExecutionTrace({ prompt, result }: Readonly<{
  prompt: string;
  result: ExecutionTraceData | null;
}>) {
  return (
    <aside aria-label="AI execution trace" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span>Runtime debugger</span>
          <h2>Execution trace</h2>
        </div>
        <small>{result ? formatDuration(result.totalDurationMs) : "Idle"}</small>
      </header>

      {!result ? (
        <div className={styles.empty}>
          <strong>No execution yet</strong>
          <p>Send a message to inspect the exact application workflow that handled it.</p>
        </div>
      ) : (
        <>
          <dl className={styles.metadata}>
            <div><dt>Orchestration</dt><dd>LangGraph</dd></div>
            <div><dt>Tracing</dt><dd>{result.langfuseTracing ? "Langfuse on" : "Langfuse off"}</dd></div>
            <div><dt>Model</dt><dd title={result.model}>{result.model}</dd></div>
            <div><dt>Retrieval</dt><dd>{result.retrievalMode}</dd></div>
            <div><dt>Total time</dt><dd>{formatDuration(result.totalDurationMs)}</dd></div>
            <div><dt>Steps</dt><dd>{result.workflowSteps.length}</dd></div>
            <div><dt>Request</dt><dd title={result.requestId}>{shortIdentifier(result.requestId)}</dd></div>
            <div><dt>Session</dt><dd title={result.sessionId}>{shortIdentifier(result.sessionId)}</dd></div>
          </dl>

          {result.langfuseTraceUrl && (
            <div className={styles.langfuseLink}>
              <a href={result.langfuseTraceUrl} rel="noreferrer" target="_blank">Open exact trace in Langfuse ↗</a>
              <small>Requires access to the GimmeJob Langfuse project.</small>
            </div>
          )}

          <ol className={styles.timeline}>
            <li>
              <TraceIcon/>
              <details open>
                <summary><span>01</span><strong>User input</strong></summary>
                <div className={styles.stepBody}>
                  <span>Input</span>
                  <pre>{prompt}</pre>
                </div>
              </details>
            </li>

            {result.workflowSteps.map((step, index) => (
              <li key={`${step.id}-${index}`}>
                <TraceIcon/>
                <details open>
                  <summary>
                    <span>{String(index + 2).padStart(2, "0")}</span>
                    <strong>{step.label}</strong>
                    <code>{formatDuration(step.durationMs)}</code>
                  </summary>
                  <div className={styles.stepBody}>
                    <div className={styles.stepMeta}>
                      <code>{step.id}</code>
                      <p>{step.detail}</p>
                    </div>
                    <TraceFields label="Input" values={step.input}/>
                    <TraceFields label="Output" values={step.output}/>
                    <RetrievalResults results={step.retrievalResults}/>
                    <TokenUsage usage={step.tokenUsage}/>
                  </div>
                </details>
              </li>
            ))}

            <li>
              <TraceIcon active/>
              <details open>
                <summary>
                  <span>{String(result.workflowSteps.length + 2).padStart(2, "0")}</span>
                  <strong>Response delivered</strong>
                  <code>{formatDuration(result.totalDurationMs)}</code>
                </summary>
                <div className={styles.stepBody}>
                  <span>Output</span>
                  <p>The verified assistant response was returned to the chat.</p>
                </div>
              </details>
            </li>
          </ol>

          <p className={styles.disclaimer}>This is observable application execution: actual graph nodes, retrieval query and results, routing, model-call metrics and verification output. It does not expose or invent private model chain-of-thought.</p>
        </>
      )}
    </aside>
  );
}

export default ExecutionTrace;
