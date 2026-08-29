import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("HTTP status code accordions use flush tables without changing generic details layout", async () => {
  const [catalog, renderer] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("app/qa-markdown.tsx"), "utf8"),
  ]);

  assert.match(catalog, /:::details \$\{group\.summary\}/);
  assert.match(catalog, /<!-- flush-table -->/);

  assert.match(renderer, /contentLine\.trim\(\) === "<!-- flush-table -->"/);
  assert.match(renderer, /padding: flushTable \? 0 : "16px 18px 4px"/);
  assert.match(renderer, /flushTables=\{flushTable\}/);
  assert.match(renderer, /style=\{flushTables \? \{ border: 0, borderRadius: 0, margin: 0 \} : undefined\}/);

  // Generic :::details blocks keep their original padded presentation unless explicitly marked.
  assert.match(renderer, /className=\{flushTable \? "qa-md-details qa-md-details-flush-table" : "qa-md-details"\}/);
});
