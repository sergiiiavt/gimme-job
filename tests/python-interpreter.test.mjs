import assert from "node:assert/strict";
import test from "node:test";
import { findPython, isPython3, pythonCandidates, runPython } from "./helpers/python-interpreter.mjs";

const names = (candidates) => candidates.map(({ command, args }) => [command, ...args].join(" "));

test("PYTHON overrides every other interpreter", () => {
  assert.deepEqual(names(pythonCandidates({ PYTHON: " C:\\Python314\\python.exe " }, "win32")), ["C:\\Python314\\python.exe"]);
});

test("Windows tries the py launcher before python3 and python", () => {
  assert.deepEqual(names(pythonCandidates({}, "win32")), ["py -3", "python3", "python"]);
  assert.deepEqual(names(pythonCandidates({}, "linux")), ["python3", "python"]);
});

test("an interpreter counts only when it runs Python 3 code", () => {
  const run = (result) => () => ({ error: undefined, status: 0, stdout: "", ...result });
  assert.equal(isPython3({ command: "python3", args: [] }, run({ stdout: "3\n" })), true);
  assert.equal(isPython3({ command: "python3", args: [] }, run({ stdout: "2\n" })), false);
  // The Microsoft Store placeholder exits with 9009 and prints an install hint.
  assert.equal(isPython3({ command: "python3", args: [] }, run({ status: 9009, stdout: "Python was not found" })), false);
  assert.equal(isPython3({ command: "missing", args: [] }, run({ status: null, error: new Error("ENOENT") })), false);
});

test("a Store placeholder is skipped in favour of the next interpreter", () => {
  const python = findPython({ env: {}, platform: "win32", probe: ({ command }) => command === "python" });
  assert.deepEqual({ command: python.command, args: python.args, skip: python.skip }, { command: "python", args: [], skip: false });
});

test("without Python, local runs skip with a reason and CI runs still fail", () => {
  const local = findPython({ env: {}, platform: "win32", probe: () => false });
  assert.equal(local.command, null);
  assert.match(local.skip, /no working Python 3 found \(tried py -3, python3, python\); set PYTHON/);

  const ci = findPython({ env: { CI: "true" }, platform: "linux", probe: () => false });
  assert.equal(ci.skip, false);
  assert.throws(() => runPython(ci, ["-c", "pass"]), /no working Python 3 found \(tried python3, python\)/);
});
