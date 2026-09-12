import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Database Playground auto-runs Use example through the normal run control", async () => {
  const [enhancer, page] = await Promise.all([
    source("app/playgrounds/databases/database-code-enhancer.tsx"),
    source("app/playgrounds/databases/page.tsx"),
  ]);

  assert.match(enhancer, /textContent\?\.trim\(\) === "Use example"/);
  assert.match(enhancer, /function activeRunButton/);
  assert.match(enhancer, /Run SQL/);
  assert.match(enhancer, /Run query/);
  assert.match(enhancer, /runButton\.disabled/);
  assert.match(enhancer, /runButton\.click\(\)/);
  assert.match(enhancer, /EXAMPLE_AUTO_RUN_DELAY_MS/);
  assert.match(page, /DatabaseCodeEnhancer/);
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
