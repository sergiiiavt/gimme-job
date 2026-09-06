import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("official ISTQB source links keep readable button contrast inside learning articles", async () => {
  const companionCss = await read("app/istqb-ai-official-sample-companion.module.css");
  const learningCss = await read("app/qa-fundamentals-page.module.css");

  assert.match(learningCss, /\.article a\s*\{[^}]*color:\s*#286d4e/s);
  assert.match(companionCss, /\.companion \.sourceActions a,\s*\n\.actionBar button,/);
  assert.match(companionCss, /\.companion \.sourceActions a,[^{]*\{[^}]*background:\s*#2f6f4d;[^}]*color:\s*#fff;[^}]*text-decoration:\s*none;/s);
  assert.match(companionCss, /\.companion \.sourceActions a:hover,[^{]*\{[^}]*color:\s*#fff;[^}]*text-decoration:\s*none;/s);
});
