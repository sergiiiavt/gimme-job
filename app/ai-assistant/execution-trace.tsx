"use client";

import { useEffect, useState } from "react";
import {
  LEARNING_PATH_TRACE_EVENT,
  type LiveTraceEvent,
} from "./learning-path-stream-events";
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

type LiveTraceState = {
  requestId: string;
  sessionId: string;
  model: string;
  langfuseTracing: boolean;
  langfuseTraceUrl: string | null;
  prompt: string;
  events: LiveTraceEvent[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function liveEventLabel(event: LiveTraceEvent): string {
  const label = typeof event.label === "string" && event.label.trim() ? event.label.trim() : null;
  switch (event.type) {
    case "trace.start": return "Request received";
    case "node.start": return label ?? "Graph node started";
    case "node.complete": return label ?? "Graph node completed";
    case "retrieval.complete": return label ?? "Canonical RAG retrieval complete";
    case "llm.start": return label ?? "Model call started";
    case "llm.complete": return label ?? "Model call completed";
    case "trace.complete": return "Response verified";
    case "trace.error": return "Workflow fallback";
    default: return event.type;
  }
}

function liveEventDetail(event: LiveTraceEvent): string {
  if (event.type === "node.start") return "Running now…";
  if (event.type === "node.complete" && isRecord(event.step)) {
    const detail = event.step.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  if (event.type === "retrieval.complete") {
    const resultCount = typeof event.resultCount === "number" ? event.resultCount : 0;
    const strategy = typeof event.strategy === "string" ? event.strategy : "unknown";
    return `${resultCount} results · ${strategy}`;
  }
  if (event.type === "llm.start") {
    const model = typeof event.model === "string" ? event.model : "configured model";
    return `${model} is generating the structured response.`;
  }
  if (event.type === "llm.complete" && isRecord(event.tokenUsage)) {
    const total = event.tokenUsage.totalTokens;
    if (typeof total === "number") return `${total.toLocaleString()} total tokens`;
  }
  if (event.type === "trace.complete") {
    const steps = typeof event.workflowSteps === "number" ? event.workflowSteps : 0;
    return `${steps} graph steps completed.`;
  }
  if (event.type === "trace.error") {
    return typeof event.detail === "string" ? event.detail : "The workflow failed safely and returned a fallback.";
  }
  return "Observable runtime event.";
}

function liveEventDuration(event: LiveTraceEvent): number | null {
  if (event.type === "node.complete" && isRecord(event.step)) {
    const duration = event.step.durationMs;
    return typeof duration === "number" && Number.isFinite(duration) ? duration : null;
  }
  if (event.type === "trace.complete") {
    const duration = event.totalDurationMs;
    return typeof duration === "number" && Number.isFinite(duration) ? duration : null;
  }
  return null;
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

function LiveExecutionTrace({ live }: Readonly<{ live: LiveTraceState }>) {
  const latest = live.events.at(-1);
  const elapsed = latest?.elapsedMs ?? 0;
  const traceComplete = live.events.some((event) => event.type === "trace.complete");

  return (
    <>
      <dl className={styles.metadata}>
        <div><dt>Orchestration</dt><dd>LangGraph</dd></div>
        <div><dt>Status</dt><dd>{traceComplete ? "Finishing" : "Live"}</dd></div>
        <div><dt>Tracing</dt><dd>{live.langfuseTracing ? "Langfuse on" : "Langfuse off"}</dd></div>
        <div><dt>Model</dt><dd title={live.model}>{live.model}</dd></div>
        <div><dt>Elapsed</dt><dd>{formatDuration(elapsed)}</dd></div>
        <div><dt>Events</dt><dd>{live.events.length}</dd></div>
        <div><dt>Request</dt><dd title={live.requestId}>{shortIdentifier(live.requestId)}</dd></div>
        <div><dt>Session</dt><dd title={live.sessionId}>{shortIdentifier(live.sessionId)}</dd></div>
      </dl>

      {live.langfuseTraceUrl && (
        <div className={styles.langfuseLink}>
          <a href={live.langfuseTraceUrl} rel="noreferrer" target="_blank">Open live trace in Langfuse ↗</a>
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
              <pre>{live.prompt}</pre>
            </div>
          </details>
        </li>
        {live.events.filter((event) => event.type !== "trace.start" && event.type !== "result").map((event, index, events) => {
          const duration = liveEventDuration(event);
          const active = index === events.length - 1 && !traceComplete && event.type.endsWith(".start");
          return (
            <li key={`${event.sequence}-${event.type}-${index}`}>
              <TraceIcon active={active}/>
              <details open>
                <summary>
                  <span>{String(index + 2).padStart(2, "0")}</span>
                  <strong>{liveEventLabel(event)}</strong>
                  <code>{duration === null ? formatDuration(event.elapsedMs) : formatDuration(duration)}</code>
                </summary>
                <div className={styles.stepBody}>
                  <div className={styles.stepMeta}>
                    {typeof event.nodeId === "string" && <code>{event.nodeId}</code>}
                    <p>{liveEventDetail(event)}</p>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <p className={styles.disclaimer}>This live view is fed by the running LangGraph request. It shows observable application execution and model-call metadata, not private model chain-of-thought.</p>
    </>
  );
}

export function ExecutionTrace({ prompt, result }: Readonly<{
  prompt: string;
  result: ExecutionTraceData | null;
}>) {
  const [live, setLive] = useState<LiveTraceState | null>(null);

  useEffect(() => {
    const onTraceEvent = (rawEvent: Event) => {
      const detail = (rawEvent as CustomEvent<LiveTraceEvent>).detail;
      if (!detail || typeof detail.type !== "string") return;

      if (detail.type === "trace.start") {
        const requestId = typeof detail.requestId === "string" ? detail.requestId : "";
        const sessionId = typeof detail.sessionId === "string" ? detail.sessionId : "";
        const model = typeof detail.model === "string" ? detail.model : "unknown";
        const promptText = typeof detail.prompt === "string" ? detail.prompt : "";
        const traceUrl = typeof detail.langfuseTraceUrl === "string" ? detail.langfuseTraceUrl : null;
        setLive({
          requestId,
          sessionId,
          model,
          langfuseTracing: detail.langfuseTracing === true,
          langfuseTraceUrl: traceUrl,
          prompt: promptText,
          events: [detail],
        });
        return;
      }

      setLive((current) => {
        if (!current) return current;
        return { ...current, events: [...current.events, detail].slice(-64) };
      });
    };

    window.addEventListener(LEARNING_PATH_TRACE_EVENT, onTraceEvent);
    return () => window.removeEventListener(LEARNING_PATH_TRACE_EVENT, onTraceEvent);
  }, []);

  const visibleLive = live && result?.requestId !== live.requestId ? live : null;
  const headerDuration = visibleLive
    ? `Live · ${formatDuration(visibleLive.events.at(-1)?.elapsedMs ?? 0)}`
    : result
      ? formatDuration(result.totalDurationMs)
      : "Idle";

  return (
    <aside aria-label="AI execution trace" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span>Runtime debugger</span>
          <h2>Execution trace</h2>
        </div>
        <small>{headerDuration}</small>
      </header>

      {visibleLive ? (
        <LiveExecutionTrace live={visibleLive}/>
      ) : !result ? (
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
