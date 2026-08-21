import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

async function source(path) {
  return readFile(projectFile(path), "utf8");
}

async function json(path) {
  return JSON.parse(await source(path));
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
    assert.ok(manifest.includes(`| \`${id}\` |`), `manifest must include plant ${id}`);
  }
  for (const id of ["clickbait", "deepfake", "popup", "fragment"]) {
    assert.ok(manifest.includes(`| \`${id}\` |`), `manifest must include enemy ${id}`);
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
    const pattern = hallucinated.replaceAll(" ", "\\s+");
    assert.doesNotMatch(manifest, new RegExp(`\\b${pattern}\\b`, "i"), `manifest must not invent ${hallucinated}`);
  }
});

test("Rewild Visual Bible uses the implemented regular flat-top hex geometry", async () => {
  const [grid, world, geometry, preflight, machineContract, artBible, targetContract] = await Promise.all([
    source("app/rewild-hex-grid.ts"),
    source("app/rewild-world.ts"),
    source("docs/rewild/visual-bible/HEX_GEOMETRY_CONTRACT.md"),
    source("docs/rewild/visual-bible/PREFLIGHT.md"),
    json("config/rewild/visual-assets.json"),
    source("docs/rewild/ART_BIBLE.md"),
    source("docs/rewild/VISUAL_TARGET_CONTRACT.md"),
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

  assert.equal(machineContract.hexLayout.orientation, "flat-top");
  assert.equal(machineContract.hexLayout.sizeLogicalPixels, 21);
  assert.equal(machineContract.hexLayout.neighborDirections, 6);
  assert.equal(machineContract.visualContract.roadProductionStatus, "redesign-required");
  assert.doesNotMatch(artBible, /Hex orientation:\s*pointy top/iu);
  assert.doesNotMatch(targetContract, /Hex field:\s*pointy-top/iu);
});

test("audited Visual Bible reference status quarantines broken generated sheets", async () => {
  const [status, readme, preflight, batch] = await Promise.all([
    json("docs/rewild/visual-bible/REFERENCE_STATUS.json"),
    source("docs/rewild/visual-bible/README.md"),
    source("docs/rewild/visual-bible/PREFLIGHT.md"),
    source("docs/rewild/visual-bible/batches/01-terrain-details.md"),
  ]);

  assert.equal(status.references.length, 7, "all seven retained references must have an explicit audit status");
  const byFile = new Map(status.references.map((entry) => [entry.file, entry]));

  for (const file of ["02-style-scale-footprint.webp", "04-terrain-transitions.webp"]) {
    const entry = byFile.get(file);
    assert.ok(entry, `${file}: missing audit entry`);
    assert.equal(entry.status, "rejected", `${file}: must remain quarantined`);
    assert.equal(entry.promptAllowed, false, `${file}: rejected image must not enter generation prompts`);
    assert.equal(entry.productionExtractionAllowed, false, `${file}: rejected image must not be a production source`);
  }

  assert.equal(byFile.get("03-mainframe-interactions.webp")?.status, "approved");
  assert.equal(byFile.get("07-gameplay-target.webp")?.status, "composition-only");
  assert.equal(byFile.get("01-environment-detail.webp")?.status, "approved-with-exceptions");

  assert.match(readme, /road family is \*\*not currently visually approved for production\*\*/u);
  assert.match(preflight, /02-style-scale-footprint\.webp.*04-terrain-transitions\.webp/u);
  assert.match(batch, /REVIEW APPROVAL RETRACTED \/ REDESIGN REQUIRED/u);
  assert.doesNotMatch(batch, /Road \/ fence \/ boundary family — REVIEW APPROVED/u);
});

test("concept-sheet state labels cannot become runtime state by implication", async () => {
  const [world, manifest, rules] = await Promise.all([
    source("app/rewild-world.ts"),
    source("docs/rewild/visual-bible/SPRITE_MANIFEST.md"),
    source("docs/rewild/visual-bible/PRODUCTION_RULES.md"),
  ]);

  assert.match(world, /export type EnvironmentVisualState = "healthy" \| "stressed" \| "corrupted" \| "dead" \| "recovering";/);
  assert.match(world, /export type WorldEffectKind = "construction" \| "impact" \| "shutdown" \| "collapse" \| "reclaim" \| "dilution";/);
  assert.match(manifest, /current runtime uses `house` and `house-damaged`, selected from HP/u);
  assert.match(rules, /Generated labels are non-authoritative/u);
  assert.match(rules, /Do not create new gameplay states such as `critical`, `destroyed`, `failing`, `overloaded`, or `heavily-damaged`/u);
});
