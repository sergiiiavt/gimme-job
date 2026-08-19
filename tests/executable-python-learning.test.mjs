import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const markdownRenderer = readFileSync(new URL("../app/qa-markdown.tsx", import.meta.url), "utf8");
const runnerComponent = readFileSync(new URL("../app/executable-python-block.tsx", import.meta.url), "utf8");
const runnerWorker = readFileSync(new URL("../public/python-runner.worker.mjs", import.meta.url), "utf8");

test("Python learning blocks use the two-panel executable runner", () => {
  assert.match(markdownRenderer, /ExecutablePythonBlock/);
  assert.match(markdownRenderer, /language !== "python"/);
  assert.match(markdownRenderer, /unsupportedRunnablePythonPatterns/);
  assert.match(markdownRenderer, /\bprint\\s\*\\\(/);
  assert.match(runnerComponent, />Python</);
  assert.match(runnerComponent, />Result</);
  assert.match(runnerComponent, />Run</);
  assert.match(runnerComponent, />Reset</);
  assert.match(runnerComponent, />Clear</);
});

test("browser runner stays isolated and bounded", () => {
  assert.match(runnerComponent, /new Worker\("\/python-runner\.worker\.mjs", \{ type: "module" \}\)/);
  assert.match(runnerComponent, /EXECUTION_TIMEOUT_MS = 5_000/);
  assert.match(runnerWorker, /pyodide\/v314\.0\.4\/full/);
  assert.match(runnerWorker, /setStdin\(\{ error: true \}\)/);
  assert.match(runnerWorker, /globals\.set\("__name__", "__main__"\)/);
  assert.match(runnerWorker, /globals\.destroy\(\)/);
});
