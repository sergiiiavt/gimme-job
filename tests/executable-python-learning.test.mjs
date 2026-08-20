import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const markdownRenderer = readFileSync(new URL("../app/qa-markdown.tsx", import.meta.url), "utf8");
const runnerComponent = readFileSync(new URL("../app/executable-python-block.tsx", import.meta.url), "utf8");
const runnerStyles = readFileSync(new URL("../app/executable-python-block.module.css", import.meta.url), "utf8");
const runnerWorker = readFileSync(new URL("../public/python-runner.worker.mjs", import.meta.url), "utf8");

test("supported Python learning blocks use the executable runner without requiring print", () => {
  assert.match(markdownRenderer, /ExecutablePythonBlock/);
  assert.match(markdownRenderer, /language !== "python"/);
  assert.match(markdownRenderer, /unsupportedRunnablePythonPatterns/);
  assert.match(markdownRenderer, /runnablePythonImports/);
  assert.match(markdownRenderer, /hasUnsupportedPythonImport\(source\)/);
  assert.doesNotMatch(markdownRenderer, /!\/\\bprint\\s\*\\\(\/\.test\(source\)/);
  assert.match(runnerComponent, />Python</);
  assert.match(runnerComponent, />Result</);
  assert.match(runnerComponent, />Run</);
  assert.match(runnerComponent, />Reset</);
  assert.match(runnerComponent, /Copied" : "Copy"/);
  assert.match(runnerComponent, />Clear</);
});

test("Python runner uses dark highlighted editor, floating actions, and working expand state", () => {
  assert.match(runnerComponent, /highlightPython\(draft\)/);
  assert.match(runnerComponent, /styles\.actionDock/);
  assert.match(runnerComponent, /styles\.expandButton/);
  assert.match(runnerComponent, /setExpanded\(\(value\) => !value\)/);
  assert.match(runnerComponent, /event\.key === "Escape"/);
  assert.match(runnerStyles, /background: #1e1e1e/);
  assert.match(runnerStyles, /\.actionDock[\s\S]*position: absolute/);
  assert.match(runnerStyles, /\.tokenKeyword[\s\S]*#c586c0/);
  assert.match(runnerStyles, /\.tokenString[\s\S]*#ce9178/);
  assert.match(runnerStyles, /\.tokenComment[\s\S]*#6a9955/);
});

test("browser runner is isolated, bounded, and denies browser/network escape paths", () => {
  assert.match(runnerComponent, /new Worker\("\/python-runner\.worker\.mjs", \{ type: "module" \}\)/);
  assert.match(runnerComponent, /EXECUTION_TIMEOUT_MS = 5_000/);
  assert.match(runnerComponent, /MAX_RUNS_PER_WORKER = 20/);
  assert.match(runnerComponent, /maxLength=\{MAX_CODE_LENGTH\}/);
  assert.match(runnerWorker, /pyodide\/v314\.0\.4\/full/);
  assert.match(runnerWorker, /setStdin\(\{ error: true \}\)/);
  assert.match(runnerWorker, /MAX_CODE_LENGTH = 8_000/);
  assert.match(runnerWorker, /MAX_OUTPUT_CHARS = 32_000/);
  assert.match(runnerWorker, /credentials: "omit"/);
  assert.match(runnerWorker, /lockDownWorkerCapabilities\(\)/);
  assert.match(runnerWorker, /"Worker", "SharedWorker"/);
  assert.match(runnerWorker, /_ast\.parse\(__source__/);
  assert.match(runnerWorker, /_ALLOWED_IMPORTS/);
  assert.match(runnerWorker, /_BLOCKED_NAMES = \{"js", "micropip", "pyodide", "pyodide_js"\}/);
  assert.match(runnerWorker, /Import .* is disabled in the learning runner/);
  assert.match(runnerWorker, /Dunder attribute access is disabled/);
  assert.match(runnerWorker, /_safe_builtins\["__import__"\] = _safe_import/);
});
