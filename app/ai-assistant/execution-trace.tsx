import styles from "./execution-trace.module.css";

export type ExecutionStep = {
  id: string;
  label: string;
  detail: string;
};

export type ExecutionTraceData = {
  requestId: string;
  sessionId: string;
  model: string;
  langfuseTracing: boolean;
  orchestration: "langgraph";
  retrievalMode: "repository" | "general";
  workflowSteps: ExecutionStep[];
};

function TraceIcon({ active = false }: Readonly<{ active?: boolean }>) {
  return <span aria-hidden="true" className={active ? styles.activeDot : styles.dot}/>;
}

function shortIdentifier(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function ExecutionTrace({ prompt, result }: Readonly<{
  prompt: string;
  result: ExecutionTraceData | null;
}>) {
  return (
    <aside aria-label="AI execution trace" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span>Runtime</span>
          <h2>Execution trace</h2>
        </div>
        <small>{result ? "Completed" : "Idle"}</small>
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
            <div><dt>Request</dt><dd title={result.requestId}>{shortIdentifier(result.requestId)}</dd></div>
            <div><dt>Session</dt><dd title={result.sessionId}>{shortIdentifier(result.sessionId)}</dd></div>
          </dl>

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
                    <code>{step.id}</code>
                  </summary>
                  <div className={styles.stepBody}>
                    <span>Runtime result</span>
                    <p>{step.detail}</p>
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
                </summary>
                <div className={styles.stepBody}>
                  <span>Output</span>
                  <p>The verified assistant response was returned to the chat.</p>
                </div>
              </details>
            </li>
          </ol>

          <p className={styles.disclaimer}>This is the observable application trace: graph nodes, retrieval, model calls and verification. It does not expose private model chain-of-thought.</p>
        </>
      )}
    </aside>
  );
}

export default ExecutionTrace;
