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
