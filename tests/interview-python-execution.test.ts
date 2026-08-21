import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPythonInterviewExecution,
  isRunnablePythonInterviewExample,
} from "../app/interview-python-execution.ts";

test("marks self-contained Python and allowed standard-library examples runnable", () => {
  assert.equal(classifyPythonInterviewExecution("python", "print([n * n for n in range(4)])"), "python");
  assert.equal(classifyPythonInterviewExecution("python", "from collections import Counter\nprint(Counter('aba'))"), "python");
  assert.equal(isRunnablePythonInterviewExample("python", "import asyncio\nprint(asyncio.run)"), true);
});

test("keeps examples outside the browser sandbox static", () => {
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
