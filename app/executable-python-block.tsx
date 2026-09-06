"use client";

import { type ReactNode } from "react";
import ExecutableCodeRunner, { type WorkerRunnerMessage } from "./executable-code-runner";
import styles from "./executable-python-block.module.css";

const MAX_CODE_LENGTH = 8_000;
const MAX_RUNS_PER_WORKER = 20;

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

function compactPythonSignature(parameters: string) {
  return parameters.replace(/\s+/g, " ").trim();
}

function silentPythonRunSummary(source: string) {
  const functionDetails = [...source.matchAll(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:->[^:]+)?\s*:\s*(?:\n\s+(?:"""([\s\S]*?)"""|'''([\s\S]*?)'''))?/gm)]
    .map((match) => {
      const signature = `${match[1]}(${compactPythonSignature(match[2])})`;
      const docstring = (match[3] ?? match[4] ?? "").trim().replace(/\s+/g, " ");
      return docstring ? `${signature} — ${docstring}` : signature;
    });
  const classes = [...source.matchAll(/^\s*class\s+([A-Za-z_]\w*)\b/gm)].map((match) => match[1]);

  if (functionDetails.length || classes.length) {
    const lines = ["Executed successfully."];
    if (functionDetails.length) lines.push(`Defined function${functionDetails.length === 1 ? "" : "s"}: ${functionDetails.join("; ")}`);
    if (classes.length) lines.push(`Defined class${classes.length === 1 ? "" : "es"}: ${classes.join(", ")}`);
    lines.push("This example defines reusable code, so it does not print a value until that code is called.");
    return lines.join("\n");
  }

  const assignments = [...source.matchAll(/^([A-Za-z_]\w*)\s*=(?!=)/gm)].map((match) => match[1]);
  if (assignments.length) {
    return `Executed successfully.\nCreated value${assignments.length === 1 ? "" : "s"}: ${assignments.join(", ")}.\nThis example stores values but does not print them.`;
  }

  return "Executed successfully. This example has no printed or expression result.";
}

function formatPythonResult(message: WorkerRunnerMessage, source: string) {
  if (message.error) return [message.output, message.error].filter(Boolean).join("\n");
  return message.output || silentPythonRunSummary(source);
}

export default function ExecutablePythonBlock({ code }: { code: string }) {
  return (
    <ExecutableCodeRunner
      code={code}
      formatResult={(message) => formatPythonResult(message, code)}
      highlight={highlightPython}
      initialMessage="Run the code to see the result."
      key={code}
      language="Python"
      loadingErrorMessage="Python runtime could not be loaded. Try again."
      loadingMessage="Loading Python runtime…"
      maxCodeLength={MAX_CODE_LENGTH}
      maxRunsPerWorker={MAX_RUNS_PER_WORKER}
      readyMeta="editable · browser sandbox"
      runnerErrorMessage="Python runner failed to start. Try again."
      workerUrl="/python-runner.worker.mjs"
    />
  );
}
