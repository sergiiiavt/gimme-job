import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("HTTP status code accordions use flush tables without changing generic details layout", async () => {
  const [catalog, renderer, styles, layout] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readFile(projectFile("app/qa-markdown.tsx"), "utf8"),
    readFile(projectFile("app/http-status-accordion.css"), "utf8"),
    readFile(projectFile("app/layout.tsx"), "utf8"),
  ]);

  assert.match(catalog, /:::details \$\{group\.summary\}/);
  assert.match(catalog, /<!-- flush-table -->/);

  assert.match(renderer, /const FLUSH_TABLE_MARKER = "<!-- flush-table -->"/);
  assert.match(renderer, /function detailsPresentation/);
  assert.match(renderer, /className: flushTable \? "qa-md-details qa-md-details-flush-table" : "qa-md-details"/);
  assert.match(renderer, /padding: flushTable \? 0 : "16px 18px 4px"/);
  assert.match(renderer, /<MarkdownDocument markdown=\{presentation\.markdown\} \/>/);

  assert.match(styles, /\.qa-md-details-flush-table \.qa-md-table-wrap/);
  assert.match(styles, /\.qa-md-details-flush-table \.qa-md-table-wrap table/);
  assert.doesNotMatch(styles, /^\.qa-md-table-wrap\s*\{/m);
  assert.match(layout, /http-status-accordion\.css/);
});
