import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Database Playground auto-runs Use example through the normal run control", async () => {
  const [autoRun, page] = await Promise.all([
    source("app/playgrounds/databases/database-example-auto-run.tsx"),
    source("app/playgrounds/databases/page.tsx"),
  ]);

  assert.match(autoRun, /USE_EXAMPLE_LABEL = "Use example"/);
  assert.match(autoRun, /button\.click\(\)/);
  assert.match(autoRun, /Run SQL/);
  assert.match(autoRun, /Run query/);
  assert.match(autoRun, /runButton\.disabled/);
  assert.match(page, /DatabaseExampleAutoRun/);
});

test("Database Playground editor no longer reserves an empty action row", async () => {
  const [compactStyles, workbenchStyles, page] = await Promise.all([
    source("app/playgrounds/databases/database-compact-editor.css"),
    source("app/playgrounds/databases/database-workbench.css"),
    source("app/playgrounds/databases/page.tsx"),
  ]);

  assert.match(workbenchStyles, /padding:\s*54px 28px 14px 16px/);
  assert.match(compactStyles, /padding:\s*14px 28px 14px 16px !important/);
  assert.match(compactStyles, /width:\s*max-content/);
  assert.match(compactStyles, /right:\s*24px/);
  assert.match(page, /database-compact-editor\.css/);
});
