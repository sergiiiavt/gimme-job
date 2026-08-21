import assert from "node:assert/strict";
import test from "node:test";
import { highlightInterviewCode } from "../app/interview-code-highlighting.ts";

function colorOf(source: string, language: string, text: string) {
  return highlightInterviewCode(source, language).find((token) => token.text === text)?.color;
}

test("highlights Python comments, strings, decorators, numbers, keywords, builtins, and names", () => {
  const source = "@trace\ndef run(value=42):\n    # note\n    print(\"ok\", value)";

  assert.equal(colorOf(source, "python", "@trace"), "#dcdcaa");
  assert.equal(colorOf(source, "python", "def"), "#569cd6");
  assert.equal(colorOf(source, "python", "42"), "#b5cea8");
  assert.equal(colorOf(source, "python", "# note"), "#6a9955");
  assert.equal(colorOf(source, "python", "print"), "#4ec9b0");
  assert.equal(colorOf(source, "python", "\"ok\""), "#ce9178");
  assert.equal(colorOf(source, "python", "run"), "#d4d4d4");
});

test("supports the py alias and triple-quoted Python strings", () => {
  const tokens = highlightInterviewCode("'''hello'''", "py");
  assert.deepEqual(tokens, [{ text: "'''hello'''", color: "#ce9178" }]);
});

test("keeps SQL keyword, comment, string, and identifier coloring", () => {
  const source = "SELECT name FROM users WHERE status = 'active'; -- only active";

  assert.equal(colorOf(source, "sql", "SELECT"), "#569cd6");
  assert.equal(colorOf(source, "sql", "name"), "#d4d4d4");
  assert.equal(colorOf(source, "sql", "'active'"), "#ce9178");
  assert.equal(colorOf(source, "sql", "-- only active"), "#6a9955");
});

test("returns untouched text for unsupported languages", () => {
  assert.deepEqual(highlightInterviewCode("plain text", "text"), [{ text: "plain text" }]);
});
