import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const traceCssUrl = new URL("../app/ai-assistant/execution-trace.module.css", import.meta.url);

test("execution trace gives the debugger more width while keeping equal panel heights", async () => {
  const css = await readFile(traceCssUrl, "utf8");

  assert.match(css, /grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(430px, \.95fr\)/);
  assert.match(css, /--assistant-panel-height:\s*clamp\(620px, calc\(100vh - 190px\), 760px\)/);
  assert.match(css, /\.workspace > \* \{[\s\S]*?height:\s*100%/);
  assert.match(css, /\.panel \{[\s\S]*?height:\s*100%/);
});

test("execution trace is readable and shows newest activity first", async () => {
  const css = await readFile(traceCssUrl, "utf8");

  assert.match(css, /\.timeline \{[\s\S]*?flex-direction:\s*column-reverse/);
  assert.match(css, /\.timeline summary strong \{[\s\S]*?font-size:\s*14px/);
  assert.match(css, /\.stepBody p,[\s\S]*?\.stepBody pre \{[\s\S]*?font-size:\s*13px/);
  assert.match(css, /\.metadata dd \{[\s\S]*?font-size:\s*12px/);
  assert.match(css, /\.timeline > li:last-child details \{/);
});
