import assert from "node:assert/strict";
import test from "node:test";
import { highlightInterviewCode } from "../app/interview-code-highlighting.ts";
import { isRunnablePythonSource } from "../app/interview-python-execution.ts";

const locustRuntimeFragment = `def _configured_user_count(environment: object) -> int:
    runner = getattr(environment, "runner", None)
    parsed_options = getattr(environment, "parsed_options", None)
    values = (
        getattr(runner, "target_user_count", 0) or 0,
        getattr(parsed_options, "num_users", 0) or 0,
    )
    return max(int(value or 0) for value in values)`;

test("Locust runtime-dependent fragments are static instead of offering a broken Run button", () => {
  assert.equal(isRunnablePythonSource("python", locustRuntimeFragment), false);
});

test("every Python call blocked by the learning worker is classified static", () => {
  for (const call of ["__import__", "breakpoint", "compile", "delattr", "eval", "exec", "getattr", "input", "open", "setattr", "vars"]) {
    assert.equal(isRunnablePythonSource("python", `${call}(value)`), false, `${call} must not be offered as runnable`);
  }
});

test("self-contained Python remains runnable", () => {
  assert.equal(isRunnablePythonSource("python", "values = [1, 2, 3]\nprint(sum(values))"), true);
});

test("static Python retains formatting and visible syntax colors", () => {
  const tokens = highlightInterviewCode(locustRuntimeFragment, "python");
  assert.equal(tokens.map((token) => token.text).join(""), locustRuntimeFragment);
  assert.ok(tokens.some((token) => token.text === "def" && token.color === "#569cd6"));
  assert.ok(tokens.some((token) => token.text === "getattr" && token.color === "#4ec9b0"));
  assert.ok(tokens.some((token) => token.text.includes("\n    ")));
  assert.ok(tokens.some((token) => token.color === "#ce9178"));
});

test("static non-Python code receives generic syntax coloring instead of plain monochrome text", () => {
  const tokens = highlightInterviewCode('const answer = 42; // demo\nconsole.log("ok")', "typescript");
  const colors = new Set(tokens.map((token) => token.color).filter(Boolean));
  assert.ok(colors.has("#569cd6"));
  assert.ok(colors.has("#b5cea8"));
  assert.ok(colors.has("#6a9955"));
  assert.ok(colors.has("#ce9178"));
});
