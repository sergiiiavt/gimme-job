"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./executable-python-block.module.css";

type RunnerStatus = "idle" | "loading" | "running";

type RunnerMessage = {
  id: number;
  type: "running" | "result";
  output?: string;
  error?: string;
};

const LOAD_TIMEOUT_MS = 30_000;
const EXECUTION_TIMEOUT_MS = 5_000;

export default function ExecutablePythonBlock({ code }: { code: string }) {
  const [draft, setDraft] = useState(code);
  const [output, setOutput] = useState("Run the code to see the result.");
  const [status, setStatus] = useState<RunnerStatus>("idle");
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const destroyWorker = () => {
    clearTimer();
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    workerRef.current?.terminate();
  }, []);

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

    worker.onmessage = (event: MessageEvent<RunnerMessage>) => {
      const message = event.data;
      if (message.id !== requestId) return;

      if (message.type === "running") {
        setStatus("running");
        setOutput("Running…");
        failAfter(EXECUTION_TIMEOUT_MS, "Execution stopped after 5 seconds.");
        return;
      }

      clearTimer();
      setStatus("idle");
      setOutput(message.error ? [message.output, message.error].filter(Boolean).join("\n") : message.output || "No output. Add print(...) to display a value.");
    };

    worker.onerror = () => {
      destroyWorker();
      setStatus("idle");
      setOutput("Python runner failed to start. Try again.");
    };

    worker.postMessage({ id: requestId, code: draft });
  };

  const stop = () => {
    destroyWorker();
    setStatus("idle");
    setOutput("Execution stopped.");
  };

  const reset = () => {
    if (status !== "idle") destroyWorker();
    setDraft(code);
    setStatus("idle");
    setOutput("Run the code to see the result.");
  };

  const busy = status !== "idle";

  return (
    <div className={styles.shell}>
      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Editable Python code">
          <div className={styles.header}>
            <span>Python</span>
            <span className={styles.meta}>editable</span>
          </div>
          <textarea
            aria-label="Python code"
            className={styles.editor}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            value={draft}
          />
          <div className={styles.toolbar}>
            {busy ? (
              <button className={styles.primaryButton} onClick={stop} type="button">Stop</button>
            ) : (
              <button className={styles.primaryButton} onClick={run} type="button">Run</button>
            )}
            <button className={styles.secondaryButton} onClick={reset} type="button">Reset</button>
            {status === "loading" ? <span className={styles.status}>Loading runtime</span> : null}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.resultPanel}`} aria-label="Python execution result">
          <div className={styles.header}>
            <span>Result</span>
            <button className={styles.clearButton} onClick={() => setOutput("")} type="button">Clear</button>
          </div>
          <pre aria-live="polite" className={styles.output}>{output}</pre>
        </section>
      </div>
    </div>
  );
}
