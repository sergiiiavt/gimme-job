import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ENTITY_ORDER } from "./build-rewild-v4-entities-atlas.mjs";
import { decodeAtlasWithTransparentCorners } from "./rewild-v4-atlas-validate-pixels.mjs";
import { assertFrameGeometry, parseRuntimeFrameTable } from "./rewild-v4-atlas-validate-frames.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlasPath = path.join(root, "public", "rewild", "v4", "entities-atlas-v4.png");
const metadataPath = path.join(root, "public", "rewild", "v4", "entities-atlas-v4.json");
const generatedSourceDirectory = path.join(root, "public", "rewild", "v4", "entities-source");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "entities-source");
const runtimeSource = await readFile(path.join(root, "app", "rewild-entity-atlas-v4.ts"), "utf8");
const facadeSource = await readFile(path.join(root, "app", "rewild-pixel-atlas.ts"), "utf8");
const compareAlphabetically = (left, right) => left.localeCompare(right);

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.equal(metadata.image, "entities-atlas-v4.png");
assert.equal(metadata.source, "assets/rewild/v4/entities-source");
assert.deepEqual(metadata.grid, { columns: 5, rows: 3, slotSize: 32 });
assert.equal(metadata.frames.length, 11);
assert.deepEqual(metadata.frames.map((frame) => frame.name), ENTITY_ORDER, "atlas frame order must match the exact approved manifest");
assert.equal(new Set(metadata.frames.map((frame) => frame.name)).size, ENTITY_ORDER.length, "v4 entity names must be unique");

const runtimeFrames = parseRuntimeFrameTable(runtimeSource, ENTITY_ORDER.length, "entity");

const expectedFiles = ENTITY_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
const sourceEntries = await readdir(sourceDirectory, { withFileTypes: true });
assert.ok(sourceEntries.every((entry) => entry.isFile()), "committed v4 entities source directory must contain files only");
assert.deepEqual(sourceEntries.map((entry) => entry.name).sort(compareAlphabetically), expectedFiles, "committed v4 entities source directory must contain exactly the approved 11 PNGs");

const sourceHashes = new Map();
const elderoakHashes = new Map();
for (const name of ENTITY_ORDER) {
  const fileName = `${name}.png`;
  assert.ok(runtimeFrames.has(name), `${name}: missing from runtime v4 entity frame table`);

  const sourceBuffer = await readFile(path.join(sourceDirectory, fileName));
  const sourceMeta = await sharp(sourceBuffer).metadata();
  assert.equal(sourceMeta.format, "png", `${fileName}: committed source must strictly decode as PNG`);
  assert.ok(sourceMeta.hasAlpha, `${fileName}: committed source must preserve alpha`);
  assert.equal(sourceMeta.width, 32, `${fileName}: committed source width must be exactly 32px`);
  assert.equal(sourceMeta.height, 32, `${fileName}: committed source height must be exactly 32px`);

  const generatedBuffer = await readFile(path.join(generatedSourceDirectory, fileName));
  assert.equal(Buffer.compare(sourceBuffer, generatedBuffer), 0, `${fileName}: generated source differs from committed PNG`);

  const hash = createHash("sha256").update(sourceBuffer).digest("hex");
  if (name === "plant-elderoak" || name === "plant-elderoak-mature") {
    elderoakHashes.set(name, hash);
  } else {
    assert.ok(!sourceHashes.has(hash), `${fileName}: exact duplicate of ${sourceHashes.get(hash)}`);
    sourceHashes.set(hash, fileName);
  }
}
assert.equal(
  elderoakHashes.get("plant-elderoak"),
  elderoakHashes.get("plant-elderoak-mature"),
  "plant-elderoak and plant-elderoak-mature intentionally share one authored oak identity at two renderer scales",
);

const forbiddenHallucinations = [
  "scout",
  "harvester",
  "planter",
  "ranger",
  "builder",
  "transport",
  "mainframe-link",
];
for (const forbidden of forbiddenHallucinations) {
  assert.ok(!ENTITY_ORDER.includes(forbidden), `${forbidden}: out-of-roster or off-spec entity entered the v4 entity manifest`);
}

const { atlasMeta, data, info } = await decodeAtlasWithTransparentCorners(atlasPath, "v4 entities atlas must preserve alpha");
assert.equal(atlasMeta.width, 160);
assert.equal(atlasMeta.height, 96);

for (const frame of metadata.frames) {
  assertFrameGeometry(frame, runtimeFrames, { data, info }, "unit");
  assert.deepEqual(frame.footprint, ["0,0"], `${frame.name}: current roster units remain single-hex footprints`);
}

assert.match(facadeSource, /rewild-entity-atlas-v4/u, "the v3/v2 compatibility facade must route the new roster through the v4 entity atlas");
assert.match(facadeSource, /REWILD_ENTITY_V4_IDS/u, "facade must gate v4 entity drawing by the exact approved id set");

console.log(`Rewild v4 entities atlas validated: ${ENTITY_ORDER.length} strict PNG sources, generated/runtime frames agree, transparent atlas, no duplicate or hallucinated entries.`);
