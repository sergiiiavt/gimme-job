import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function classify(cases) {
  const script = `
    import { isRunnablePythonSource } from "./app/interview-python-execution.ts";
    const cases = ${JSON.stringify(cases)};
    process.stdout.write(JSON.stringify(cases.map(({ source }) => isRunnablePythonSource("python", source))));
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("Python learning runner stays enabled only for self-contained browser-safe snippets", () => {
  const cases = [
    {
      name: "pure function",
      source: "def add(a, b):\n    return a + b\n\nprint(add(2, 3))",
      runnable: true,
    },
    {
      name: "safe stdlib import",
      source: "import json\npayload = json.loads('{\\\"ok\\\": true}')\nprint(payload['ok'])",
      runnable: true,
    },
    {
      name: "safe import aliases",
      source: "import json as js, math as m\nprint(js.loads('{\\\"n\\\": 4}')['n'] + int(m.sqrt(4)))",
      runnable: true,
    },
    {
      name: "safe from import alias",
      source: "from collections import Counter as C\ncounts = C(['qa', 'qa'])\nprint(counts['qa'])",
      runnable: true,
    },
    {
      name: "local class",
      source: "class Counter:\n    def __init__(self):\n        self.value = 0\n\n    def bump(self):\n        self.value += 1\n\ncounter = Counter()\ncounter.bump()\nprint(counter.value)",
      runnable: true,
    },
    {
      name: "class receiver and bound uppercase member",
      source: "class Mode:\n    ACTIVE = 1\n\nprint(Mode.ACTIVE)",
      runnable: true,
    },
    {
      name: "ordinary value parameter",
      source: "def normalize(text):\n    return text.strip().lower()\n\nprint(normalize('  QA  '))",
      runnable: true,
    },
    {
      name: "tuple assignment and for target",
      source: "left, right = (1, 2)\nfor value in [left, right]:\n    print(value)",
      runnable: true,
    },
    {
      name: "with as binding",
      source: "import contextlib\nwith contextlib.nullcontext(3) as value:\n    print(value)",
      runnable: true,
    },
    {
      name: "bound uppercase constant",
      source: "API_URL = 'local'\nprint(API_URL)",
      runnable: true,
    },
    {
      name: "desktop project fragment",
      source: "def find_window_for_file(desktop, file_name: str, timeout: float):\n    deadline = time.monotonic() + timeout\n    for candidate in desktop.windows(control_type='Window'):\n        if file_name.lower() in candidate.window_text().lower():\n            return desktop.window(handle=candidate.handle)",
      runnable: false,
    },
    {
      name: "injected UI framework object",
      source: "def find_editor(window):\n    root = window.wrapper_object()\n    return root.descendants(control_type='Document')",
      runnable: false,
    },
    {
      name: "conceptual HIL fragment",
      source: "power.set_voltage(3.3)\nboard.flash('candidate.hex')\nsensor_sim.set_temperature(25.0)\nassert board.wait_until_booted()",
      runnable: false,
    },
    {
      name: "external helper fragment",
      source: "def scenario():\n    return load_fixture()",
      runnable: false,
    },
    {
      name: "external constant fragment",
      source: "print(API_URL)",
      runnable: false,
    },
    {
      name: "third-party module",
      source: "import websockets\nprint(websockets)",
      runnable: false,
    },
    {
      name: "unsupported from import",
      source: "from requests import get\nprint(get)",
      runnable: false,
    },
  ];

  const actual = classify(cases);
  assert.deepEqual(actual, cases.map(({ runnable }) => runnable));
});
