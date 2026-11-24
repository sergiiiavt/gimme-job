import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("learning TOC keeps long heading names fully visible", async () => {
  const styles = await read("app/learning-document-ui.module.css");

  assert.match(styles, /section\[aria-label="On this page"\][^\n]*a/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /text-overflow:\s*clip\s*!important/);
  assert.match(styles, /white-space:\s*normal\s*!important/);
});

test("long learning TOCs scroll internally without clamping link text", async () => {
  const styles = await read("app/general-ui-fixes.css");

  assert.match(styles, /max-height:\s*calc\(100dvh - 36px\)/);
  assert.match(styles, /overflow-y:\s*auto/);
  assert.match(styles, /overscroll-behavior-y:\s*contain/);
  assert.match(styles, /scrollbar-width:\s*none/);
  assert.match(styles, /::-webkit-scrollbar/);
  assert.doesNotMatch(styles, /line-clamp|display:\s*-webkit-box/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) 228px/);
});
