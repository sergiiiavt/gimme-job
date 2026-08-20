import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

async function source(path) {
  return readFile(projectFile(path), "utf8");
}

test("Rewild Visual Bible stays aligned with the actual runtime roster", async () => {
  const [world, manifest] = await Promise.all([
    source("app/rewild-world.ts"),
    source("docs/rewild/visual-bible/SPRITE_MANIFEST.md"),
  ]);

  assert.match(
    world,
    /export type PlantKind = "sunbloom" \| "thornbramble" \| "sporecap" \| "vinewhip" \| "rootreclaimer" \| "elderoak";/,
  );
  assert.match(
    world,
    /export type EnemyKind = "clickbait" \| "deepfake" \| "popup" \| "fragment";/,
  );

  for (const id of ["sunbloom", "thornbramble", "sporecap", "vinewhip", "rootreclaimer", "elderoak"]) {
    assert.match(manifest, new RegExp(`\\| \\`${id}\\` \\|`), `manifest must include plant ${id}`);
  }
  for (const id of ["clickbait", "deepfake", "popup", "fragment"]) {
    assert.match(manifest, new RegExp(`\\| \\`${id}\\` \\|`), `manifest must include enemy ${id}`);
  }

  for (const hallucinated of [
    "Scout",
    "Harvester",
    "Planter",
    "Ranger",
    "Builder",
    "Transport",
    "Mainframe Link",
    "Scrappers",
    "Synth Hive",
    "Machinists",
    "Collector Fleet",
  ]) {
    assert.doesNotMatch(manifest, new RegExp(`\\b${hallucinated.replace(" ", "\\s+")}\\b`, "i"), `manifest must not invent ${hallucinated}`);
  }
});

test("Rewild Visual Bible uses the implemented regular flat-top hex geometry", async () => {
  const [grid, world, geometry, preflight] = await Promise.all([
    source("app/rewild-hex-grid.ts"),
    source("app/rewild-world.ts"),
    source("docs/rewild/visual-bible/HEX_GEOMETRY_CONTRACT.md"),
    source("docs/rewild/visual-bible/PREFLIGHT.md"),
  ]);

  assert.match(world, /export const HEX_SIZE = 21;/);
  assert.match(grid, /hexWidth\(layout: HexLayout\) \{ return layout\.size \* 2; \}/);
  assert.match(grid, /hexHeight\(layout: HexLayout\) \{ return Math\.sqrt\(3\) \* layout\.size; \}/);
  assert.match(grid, /hexXStep\(layout: HexLayout\) \{ return layout\.size \* 1\.5; \}/);
  assert.match(grid, /Array\.from\(\{ length: 6 \}, \(_, index\) => \{/);
  assert.match(grid, /const angle = Math\.PI \/ 3 \* index;/);

  assert.match(geometry, /regular \*\*flat-top\*\* hexagons/);
  assert.match(geometry, /width = 42 logical px/);
  assert.match(geometry, /height ≈ 36\.373 logical px/);
  assert.match(geometry, /width\/height ≈ 1\.1547005/);
  assert.match(geometry, /six 120° interior angles/);
  assert.match(preflight, /regular flat-top, six equal sides, 120° interior angles, width\/height ≈ 1\.1547005/);
});
