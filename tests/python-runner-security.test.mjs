import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Python learning runner permits normal safe OOP dunder calls", async () => {
  const worker = await read("public/python-runner.worker.mjs");
  const allowedMatch = worker.match(/_ALLOWED_DUNDER_ATTRIBUTES = \{([\s\S]*?)\n\}/);

  assert.ok(allowedMatch, "runner must define an explicit dunder allowlist");
  const allowed = allowedMatch[1];

  for (const name of ["__init__", "__enter__", "__exit__", "__iter__", "__next__", "__len__", "__repr__", "__str__"]) {
    assert.match(allowed, new RegExp(`"${name}"`), `${name} should be usable by learning examples`);
  }

  assert.match(
    worker,
    /node\.attr\.startswith\("__"\) and node\.attr not in _ALLOWED_DUNDER_ATTRIBUTES/,
    "dunder attributes must remain default-deny outside the safe allowlist",
  );
  assert.doesNotMatch(
    worker,
    /if node\.attr\.startswith\("__"\):\s*\n\s*raise RuntimeError\("Dunder attribute access is disabled/,
    "the old blanket dunder ban must not return",
  );
});

test("Python learning runner keeps dangerous introspection and browser access blocked", async () => {
  const worker = await read("public/python-runner.worker.mjs");
  const allowedMatch = worker.match(/_ALLOWED_DUNDER_ATTRIBUTES = \{([\s\S]*?)\n\}/);
  assert.ok(allowedMatch);

  for (const name of ["__class__", "__base__", "__bases__", "__mro__", "__subclasses__", "__globals__", "__dict__", "__getattribute__"]) {
    assert.doesNotMatch(allowedMatch[1], new RegExp(`"${name}"`), `${name} must stay blocked by the default-deny dunder policy`);
  }

  assert.match(worker, /Network access is disabled in the learning runner/);
  assert.match(worker, /"fetch", "WebSocket", "WebTransport", "EventSource", "XMLHttpRequest", "Worker", "SharedWorker"/);
  assert.match(worker, /_BLOCKED_NAMES = \{"js", "micropip", "pyodide", "pyodide_js"\}/);
});
