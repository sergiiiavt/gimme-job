import assert from "node:assert/strict";
import test from "node:test";
import { hasPythonPracticalCode, splitPythonPracticalExample } from "../app/interview-practical-formatting.ts";

test("splits explanatory prose from a multiline Python snippet", () => {
  assert.deepEqual(
    splitPythonPracticalExample("Use this wrapper: `def trace(fn):\n    return fn` to keep the example executable."),
    [
      { type: "prose", text: "Use this wrapper:" },
      { type: "code", text: "def trace(fn):\n    return fn" },
      { type: "prose", text: "to keep the example executable." },
    ],
  );
});

test("promotes expressions and commands to code blocks", () => {
  assert.equal(hasPythonPracticalCode("Compare with `a == b` before checking identity."), true);
  assert.equal(hasPythonPracticalCode("Run `pytest -q tests` for the focused suite."), true);
  assert.equal(hasPythonPracticalCode("Call `item.upper()` on any compatible object."), true);
});

test("keeps short conceptual identifiers in prose instead of making noisy blocks", () => {
  assert.deepEqual(
    splitPythonPracticalExample("Use `list` for a growable collection and `tuple` for a fixed record."),
    [{ type: "prose", text: "Use `list` for a growable collection and `tuple` for a fixed record." }],
  );
  assert.equal(hasPythonPracticalCode("The sentinel is `None`."), false);
});
