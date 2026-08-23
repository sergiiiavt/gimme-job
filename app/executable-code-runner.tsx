"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./executable-python-block.module.css";

export type WorkerRunnerMessage = {
  id: number;
  type: "running" | "result";
  output?: string;
  result?: unknown;
  error?: string;
};

type RunnerStatus = "idle" | "loading" | "running";

type ExecutableCodeRunnerProps = {
  code: string;
  language: string;
  workerUrl: string;
  maxCodeLength: number;
  maxRunsPerWorker: number;
  readyMeta: string;
  initialMessage: string;
  loadingMessage: string;
  loadingErrorMessage: string;
  runnerErrorMessage: string;
  highlight: (source: string) => ReactNode[];
  formatResult: (message: WorkerRunnerMessage) => string;
  renderResult?: (message: WorkerRunnerMessage) => ReactNode | null;
  additionalActions?: ReactNode;
  additionalPanel?: ReactNode;
};

const LOAD_TIMEOUT_MS = 60_000;
const EXECUTION_TIMEOUT_MS = 5_000;
const EDITOR_LINE_HEIGHT_PX = 21;
const EDITOR_VERTICAL_CHROME_PX = 68;
const EDITOR_MIN_HEIGHT_PX = 118;
const EDITOR_MAX_HEIGHT_PX = 520;

function resetHorizontalScroll(element: HTMLElement | null) {
  if (!element) return;
  window.requestAnimationFrame(() => {
    // The scroll container is RTL only so its vertical scrollbar stays on the left.
    // Chromium/Firefox use negative scrollLeft values for the physical left edge.
    element.scrollLeft = -element.scrollWidth;
  });
}

export default function ExecutableCodeRunner(props: ExecutableCodeRunnerProps) {
  const {
    code,
    language,
    workerUrl,
    maxCodeLength,
    maxRunsPerWorker,
    readyMeta,
    initialMessage,
    loadingMessage,
    loadingErrorMessage,
    runnerErrorMessage,
    highlight,
    formatResult,
    renderResult,
    additionalActions,
    additionalPanel,
  } = props;
  const [draft, setDraft] = useState(code);
  const [message, setMessage] = useState(initialMessage);
  const [outcome, setOutcome] = useState<WorkerRunnerMessage | null>(null);
  const [status, setStatus] = useState<RunnerStatus>("idle");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const runCountRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const outputScrollRef = useRef<HTMLDivElement | null>(null);

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
    resetHorizontalScroll(editorScrollRef.current);
  }, [code, expanded]);

  useEffect(() => {
    resetHorizontalScroll(outputScrollRef.current);
  }, [outcome, expanded]);

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
      setOutcome(null);
      setMessage(nextMessage);
    }, milliseconds);
  };

  const run = () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const worker = workerRef.current ?? new Worker(workerUrl, { type: "module" });
    workerRef.current = worker;

    setStatus("loading");
    setOutcome(null);
    setMessage(loadingMessage);
    failAfter(LOAD_TIMEOUT_MS, loadingErrorMessage);

    const cleanupListeners = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const handleMessage = (event: MessageEvent<WorkerRunnerMessage>) => {
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
      setOutcome(next);
      setMessage(formatResult(next));
      runCountRef.current += 1;
      if (runCountRef.current >= maxRunsPerWorker) destroyWorker();
    };

    const handleError = () => {
      cleanupListeners();
      destroyWorker();
      setStatus("idle");
      setOutcome(null);
      setMessage(runnerErrorMessage);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ id: requestId, code: draft });
  };

  const stop = () => {
    destroyWorker();
    setStatus("idle");
    setOutcome(null);
    setMessage("Execution stopped.");
  };

  const reset = () => {
    destroyWorker();
    clearCopiedTimer();
    setCopied(false);
    setDraft(code);
    setStatus("idle");
    setOutcome(null);
    setMessage(initialMessage);
    resetHorizontalScroll(editorScrollRef.current);
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
    setOutcome(null);
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
  const renderedResult = outcome && renderResult ? renderResult(outcome) : null;

  return (
    <div className={`${styles.shell} ${expanded ? styles.expanded : ""}`}>
      <div className={styles.grid}>
        <section className={styles.panel} aria-label={`Editable ${language} code`}>
          <div className={styles.header}>
            <div className={styles.headerStart}>
              <button
                aria-label={expanded ? `Collapse ${language} runner` : `Expand ${language} runner`}
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
              <span>{language}</span>
            </div>
            <span className={styles.meta}>{status === "loading" ? "loading runtime" : readyMeta}</span>
          </div>
          <div className={styles.editorFrame} style={{ height: `${editorViewportHeight}px` }}>
            <div className={styles.editorScroll} ref={editorScrollRef}>
              <div
                className={styles.editorCanvas}
                style={{ height: `${editorContentHeight}px`, width: `max(100%, ${editorColumns}ch)` }}
              >
                <pre aria-hidden="true" className={styles.highlight}>{highlight(draft)}{"\n"}</pre>
                <textarea
                  aria-label={`${language} code`}
                  className={styles.editor}
                  maxLength={maxCodeLength}
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
              {additionalActions}
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.resultPanel}`} aria-label={`${language} execution result`}>
          <div className={styles.header}>
            <span>Result</span>
            <button className={styles.clearButton} onClick={clearResult} type="button">Clear</button>
          </div>
          <div className={styles.outputScroll} ref={outputScrollRef}>
            {renderedResult ?? <pre aria-live="polite" className={styles.output}>{message}</pre>}
          </div>
        </section>
      </div>
      {additionalPanel}
    </div>
  );
}
