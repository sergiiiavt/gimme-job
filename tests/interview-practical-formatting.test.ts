import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("renders the published retry decorator on separate, indented lines in both languages", async () => {
  const catalog = new URL("../content/python-interview/iterators-generators-decorators-qa.json", import.meta.url);
  const { questions } = JSON.parse(await readFile(catalog, "utf8"));
  const question = questions.find(({ id }: { id: string }) => id === "py-iter-decorator-factories-with-arguments");
  assert.ok(question);

  const snippet = (example: string) => splitPythonPracticalExample(example).find((segment) => segment.type === "code")?.text;
  const english = snippet(question.example);
  assert.ok(english?.includes("\n    def decorator(func):\n        def wrapper(*args, **kwargs):\n"));
  assert.equal(snippet(question.exampleUk), english);
});

test("preserves Python newline escape sequences inside string literals", () => {
  const snippet = String.raw`"\n".join(lines)`;
  assert.deepEqual(splitPythonPracticalExample(`Use \`${snippet}\` to join the lines.`), [
    { type: "prose", text: "Use" },
    { type: "code", text: snippet },
    { type: "prose", text: "to join the lines." },
  ]);
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
