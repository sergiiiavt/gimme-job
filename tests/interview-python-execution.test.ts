import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPythonInterviewExecution,
  isRunnablePythonInterviewExample,
  isRunnablePythonSource,
} from "../app/interview-python-execution.ts";

test("marks self-contained Python and allowed standard-library examples runnable", () => {
  assert.equal(isRunnablePythonSource("python", "print([n * n for n in range(4)])"), true);
  assert.equal(isRunnablePythonSource("PYTHON", "from collections import Counter\nprint(Counter('aba'))"), true);
  assert.equal(isRunnablePythonSource("python", "import asyncio as aio, json\nprint(aio.run, json.dumps({}))"), true);
  assert.equal(classifyPythonInterviewExecution("python", "print([n * n for n in range(4)])"), "python");
  assert.equal(isRunnablePythonInterviewExample("python", "import asyncio\nprint(asyncio.run)"), true);
});

test("keeps unsupported language, source shape and imports outside the browser sandbox", () => {
  assert.equal(isRunnablePythonSource("sql", "SELECT 1"), false);
  assert.equal(isRunnablePythonSource("python", "   "), false);
  assert.equal(isRunnablePythonSource("python", "#".repeat(8_001)), false);
  assert.equal(isRunnablePythonSource("python", "from pathlib import Path\nprint(Path('.'))"), false);
  assert.equal(isRunnablePythonSource("python", "import os\nprint(os.getcwd())"), false);
  assert.equal(isRunnablePythonSource("python", ">>> print('repl')"), false);
  assert.equal(isRunnablePythonSource("python", "name = input('Name: ')"), false);
  assert.equal(isRunnablePythonSource("python", "pytest -q tests"), false);
});

test("keeps integration and system examples static", () => {
  assert.equal(classifyPythonInterviewExecution("python", "import pytest\n@pytest.fixture\ndef device():\n    yield object()"), "static");
  assert.equal(classifyPythonInterviewExecution("python", "import requests\nrequests.get('https://example.com')"), "static");
  assert.equal(classifyPythonInterviewExecution("python", "from pathlib import Path\nprint(Path('.'))"), "static");
  assert.equal(classifyPythonInterviewExecution("sql", "SELECT 1"), "static");
});

test("explicit static classification wins while executable requests still obey sandbox safety", () => {
  assert.equal(classifyPythonInterviewExecution("python", "print('safe')", "static"), "static");
  assert.equal(classifyPythonInterviewExecution("python", "print('safe')", "python"), "python");
  assert.equal(classifyPythonInterviewExecution("python", "import subprocess", "python"), "static");
});
