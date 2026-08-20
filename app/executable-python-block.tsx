"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./executable-python-block.module.css";

type RunnerStatus = "idle" | "loading" | "running";

type RunnerMessage = {
  id: number;
  type: "running" | "result";
  output?: string;
  error?: string;
};

const LOAD_TIMEOUT_MS = 60_000;
const EXECUTION_TIMEOUT_MS = 5_000;
const MAX_CODE_LENGTH = 8_000;
const MAX_RUNS_PER_WORKER = 20;
const EDITOR_LINE_HEIGHT_PX = 21;
const EDITOR_VERTICAL_CHROME_PX = 68;
const EDITOR_MIN_HEIGHT_PX = 118;
const EDITOR_MAX_HEIGHT_PX = 520;

const pythonTokenPattern = /(#[^\n]*)|((?:'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"))|\b(False|None|True|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b|\b(abs|all|any|bool|dict|enumerate|filter|float|int|len|list|map|max|min|next|object|print|range|repr|reversed|round|set|sorted|str|sum|super|tuple|type|zip)\b|\b(\d+(?:\.\d+)?)\b/gm;

function highlightPython(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;
  pythonTokenPattern.lastIndex = 0;

  while ((match = pythonTokenPattern.exec(source)) !== null) {
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
    nodes.push(<span className={className} key={`token-${tokenIndex++}`}>{match[0]}</span>);
    lastIndex = pythonTokenPattern.lastIndex;
  }

  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes;
}

export default function ExecutablePythonBlock({ code }: { code: string }) {
  return <ExecutablePythonBlockInstance code={code} key={code} />;
}

function ExecutablePythonBlockInstance({ code }: { code: string }) {
  const [draft, setDraft] = useState(code);
  const [output, setOutput] = useState("Run the code to see the result.");
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

  const failAfter = (milliseconds: number, message: string) => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      destroyWorker();
      setStatus("idle");
      setOutput(message);
    }, milliseconds);
  };

  const run = () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const worker = workerRef.current ?? new Worker("/python-runner.worker.mjs", { type: "module" });
    workerRef.current = worker;

    setStatus("loading");
    setOutput("Loading Python runtime…");
    failAfter(LOAD_TIMEOUT_MS, "Python runtime could not be loaded. Try again.");

    const cleanupListeners = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const handleMessage = (event: MessageEvent<RunnerMessage>) => {
      const message = event.data;
      if (message.id !== requestId) return;

      if (message.type === "running") {
        setStatus("running");
        setOutput("Running…");
        failAfter(EXECUTION_TIMEOUT_MS, "Execution stopped after 5 seconds.");
        return;
      }

      cleanupListeners();
      clearTimer();
      setStatus("idle");
      setOutput(message.error ? [message.output, message.error].filter(Boolean).join("\n") : message.output || "No output. Add print(...) or leave an expression on the last line.");
      runCountRef.current += 1;
      if (runCountRef.current >= MAX_RUNS_PER_WORKER) destroyWorker();
    };

    const handleError = () => {
      cleanupListeners();
      destroyWorker();
      setStatus("idle");
      setOutput("Python runner failed to start. Try again.");
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ id: requestId, code: draft });
  };

  const stop = () => {
    destroyWorker();
    setStatus("idle");
    setOutput("Execution stopped.");
  };

  const reset = () => {
    destroyWorker();
    clearCopiedTimer();
    setCopied(false);
    setDraft(code);
    setStatus("idle");
    setOutput("Run the code to see the result.");
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
        <section className={styles.panel} aria-label="Editable Python code">
          <div className={styles.header}>
            <div className={styles.headerStart}>
              <button
                aria-label={expanded ? "Collapse Python runner" : "Expand Python runner"}
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
              <span>Python</span>
            </div>
            <span className={styles.meta}>{status === "loading" ? "loading runtime" : "editable · browser sandbox"}</span>
          </div>
          <div className={styles.editorFrame} style={{ height: `${editorViewportHeight}px` }}>
            <div className={styles.editorScroll}>
              <div
                className={styles.editorCanvas}
                style={{ height: `${editorContentHeight}px`, width: `max(100%, ${editorColumns}ch)` }}
              >
                <pre aria-hidden="true" className={styles.highlight}>{highlightPython(draft)}{"\n"}</pre>
                <textarea
                  aria-label="Python code"
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

        <section className={`${styles.panel} ${styles.resultPanel}`} aria-label="Python execution result">
          <div className={styles.header}>
            <span>Result</span>
            <button className={styles.clearButton} onClick={() => setOutput("")} type="button">Clear</button>
          </div>
          <div className={styles.outputScroll}>
            <pre aria-live="polite" className={styles.output}>{output}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}
