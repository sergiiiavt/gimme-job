import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("Rewild benchmark renders the canonical ecosystem snapshot at 1200x675", async () => {
  const [page, entry] = await Promise.all([
    readFile(projectFile("visual/rewild-benchmark.html"), "utf8"),
    readFile(projectFile("app/rewild-benchmark-entry.ts"), "utf8"),
  ]);

  assert.match(page, /width="1200" height="675"/);
  assert.match(page, /image-rendering: pixelated/);
  assert.match(page, /\/app\/rewild-benchmark-entry\.ts/);
  assert.match(entry, /createReviewGameState\(0, "ecosystem"\)/);
  assert.match(entry, /createRenderSnapshot\(state\)/);
  assert.match(entry, /renderOverheadGame\(context, snapshot, \{ x: 0, y: 0, zoom: 1 \}\)/);
  assert.match(entry, /rewildBenchmark = "ready"/);
});

test("Rewild visual gate captures and normalizes an exact PNG before hashing", async () => {
  const [script, workflow, packageSource] = await Promise.all([
    readFile(projectFile("scripts/check-rewild-visual.mjs"), "utf8"),
    readFile(projectFile(".github/workflows/ci.yml"), "utf8"),
    readFile(projectFile("package.json"), "utf8"),
  ]);

  assert.match(script, /--headless=new/);
  assert.match(script, /--force-device-scale-factor=1/);
  assert.match(script, /--window-size=\$\{WIDTH\},\$\{HEIGHT\}/);
  assert.match(script, /sharp\(rawScreenshot\)/);
  assert.match(script, /\.png\(\{ compressionLevel: 9, adaptiveFiltering: false, palette: false \}\)/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /origin\/main\.\.\.HEAD/);
  assert.match(script, /rewild-benchmark-actual\.png/);
  assert.match(workflow, /Verify Rewild visual benchmark/);
  assert.match(workflow, /npm run check:rewild-visual/);
  assert.match(workflow, /rewild-visual-regression/);
  assert.equal(JSON.parse(packageSource).scripts["check:rewild-visual"], "node scripts/check-rewild-visual.mjs");
});
