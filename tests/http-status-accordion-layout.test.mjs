import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("HTTP status code accordions show only the table without changing generic details layout", async () => {
  const [httpGuide, renderer, styles, layout] = await Promise.all([
    readFile(projectFile("content/api-integration/http-foundations.ts"), "utf8"),
    readFile(projectFile("app/qa-markdown.tsx"), "utf8"),
    readFile(projectFile("app/http-status-accordion.css"), "utf8"),
    readFile(projectFile("app/layout.tsx"), "utf8"),
  ]);

  assert.equal((httpGuide.match(/:::details [1-5]xx/g) ?? []).length, 10, "Both languages must define all five status-code accordions");
  assert.equal((httpGuide.match(/<!-- flush-table -->/g) ?? []).length, 10, "Every status-code accordion must opt into the flush-table presentation");

  assert.match(renderer, /const FLUSH_TABLE_MARKER = "<!-- flush-table -->"/);
  assert.match(renderer, /function detailsPresentation/);
  assert.match(renderer, /className: flushTable \? "qa-md-details qa-md-details-flush-table" : "qa-md-details"/);
  assert.match(renderer, /padding: flushTable \? 0 : "16px 18px 4px"/);
  assert.match(renderer, /<MarkdownDocument markdown=\{presentation\.markdown\} \/>/);

  assert.match(styles, /\.qa-md-details-flush-table \.qa-md-details-body/);
  assert.match(styles, /display: contents/);
  assert.match(styles, /margin: 0 !important/);
  assert.match(styles, /padding: 0 !important/);
  assert.match(styles, /border: 0 !important/);
  assert.match(styles, /border-radius: 0 !important/);
  assert.match(styles, /table-layout: fixed/);
  assert.match(styles, /min-width: 0 !important/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /white-space: normal/);
  assert.match(styles, /word-break: break-word/);
  assert.doesNotMatch(styles, /^\.qa-md-table-wrap\s*\{/m);
  assert.doesNotMatch(styles, /^\.qa-md-details-body\s*\{/m);
  assert.match(layout, /http-status-accordion\.css/);
});
