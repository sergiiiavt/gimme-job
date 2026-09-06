import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all static pre/code examples receive the shared dark presentation", async () => {
  const [layout, styles] = await Promise.all([
    read("app/layout.tsx"),
    read("app/site-code-blocks.css"),
  ]);

  assert.match(layout, /import "\.\/site-code-blocks\.css"/);
  assert.match(styles, /pre:has\(> code\)/);
  assert.match(styles, /background: #1e1e1e !important/);
  assert.match(styles, /color: #d4d4d4 !important/);
  assert.match(styles, /white-space: pre !important/);
});

test("markdown fences preserve their language metadata when they are static", async () => {
  const [renderer, staticBlock] = await Promise.all([
    read("app/qa-markdown.tsx"),
    read("app/static-code-block.ts"),
  ]);

  assert.match(renderer, /const language = fence\[2\] \|\| "text"/);
  assert.match(renderer, /<StaticCodeBlock[^>]+language=\{language\}[^>]+source=\{source\}/);
  assert.match(staticBlock, /className: `language-\$\{metadata\.normalized\}`/);
  for (const language of ["Python", "SQL", "JavaScript", "TypeScript", "C#", "Bash", "PowerShell", "YAML", "JSON", "XML", "Robot Framework"]) {
    assert.ok(staticBlock.includes(`"${language}"`), `Missing static-code label for ${language}`);
  }
});

test("static code renderer produces language metadata and corresponding code classes", async () => {
  const staticCodeModule = await import("../app/static-code-block.ts");

  assert.deepEqual(staticCodeModule.staticCodeLanguage(" PYTHON "), { label: "Python", normalized: "python" });
  assert.deepEqual(staticCodeModule.staticCodeLanguage(""), { label: "Text", normalized: "text" });
  assert.deepEqual(staticCodeModule.staticCodeLanguage("kotlin"), { label: "KOTLIN", normalized: "kotlin" });

  const rendered = staticCodeModule.default({ language: "sql", source: "SELECT 1" });
  assert.equal(rendered.type, "div");
  assert.equal(rendered.props.className, "qa-md-static-code");
  assert.equal(rendered.props["data-language"], "sql");
  assert.equal(rendered.props.children[0].props.children, "SQL");
  assert.equal(rendered.props.children[1].props.children.props.className, "language-sql");
  assert.equal(rendered.props.children[1].props.children.props.children, "SELECT 1");
});

test("a successful Python Run never ends with the old empty-result dead end", async () => {
  const runner = await read("app/executable-python-block.tsx");

  assert.doesNotMatch(runner, /No output\. Add print/);
  assert.match(runner, /silentPythonRunSummary/);
  assert.match(runner, /Executed successfully\./);
  assert.match(runner, /Defined function/);
  assert.match(runner, /docstring/);
  assert.match(runner, /formatResult=\{\(message\) => formatPythonResult\(message, code\)\}/);
});

test("known non-markdown code renderers are covered by the same global pre/code rule", async () => {
  const paths = [
    "app/public-site.tsx",
    "app/quick-reference-page.tsx",
    "app/interview-question-deep-link.tsx",
    "app/uk/interview/ukrainian-interview-page.tsx",
    "app/ai-assistant/assistant-markdown.tsx",
  ];
  const sources = await Promise.all(paths.map(read));

  for (const [index, source] of sources.entries()) {
    assert.match(source, /<pre[\s\S]*?<code/, `${paths[index]} no longer exposes a pre/code code-example surface; update this audit if that renderer changes`);
  }
});
