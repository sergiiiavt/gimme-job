import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("root layout exposes persistent old/new design modes", async () => {
  const [layout, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/new-design.css"),
  ]);

  assert.match(layout, /data-design="new"/);
  assert.match(layout, /gimmejob-design/);
  assert.match(layout, /data-design-option="old"/);
  assert.match(layout, /data-design-option="new"/);
  assert.match(layout, /localStorage\.getItem/);
  assert.match(layout, /localStorage\.setItem/);
  assert.match(layout, /aria-pressed/);
  assert.match(layout, /new-design\.css/);

  assert.match(css, /html\[data-design="new"\] body/);
  assert.match(css, /html\[data-design="new"\] \.kb-navigation/);
  assert.match(css, /html\[data-design="new"\] \.vacancy-table-head/);
  assert.match(css, /html\[data-design="new"\] \.iq-question h2/);
  assert.match(css, /prefers-reduced-motion/);
});
