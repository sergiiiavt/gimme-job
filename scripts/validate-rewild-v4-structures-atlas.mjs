import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { STRUCTURE_ORDER } from "./build-rewild-v4-structures-atlas.mjs";
import { decodeAtlasWithTransparentCorners } from "./rewild-v4-atlas-validate-pixels.mjs";
import { assertFrameGeometry, parseRuntimeFrameTable } from "./rewild-v4-atlas-validate-frames.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlasPath = path.join(root, "public", "rewild", "v4", "structures-atlas-v4.png");
const metadataPath = path.join(root, "public", "rewild", "v4", "structures-atlas-v4.json");
const generatedSourceDirectory = path.join(root, "public", "rewild", "v4", "structures-source");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "structures-source");
const runtimeSource = await readFile(path.join(root, "app", "rewild-structure-atlas-v4.ts"), "utf8");
const facadeSource = await readFile(path.join(root, "app", "rewild-pixel-atlas.ts"), "utf8");
const compareAlphabetically = (left, right) => left.localeCompare(right);

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.equal(metadata.image, "structures-atlas-v4.png");
assert.equal(metadata.source, "assets/rewild/v4/structures-source");
assert.equal(metadata.frames.length, 4);
assert.deepEqual(metadata.frames.map((frame) => frame.name), STRUCTURE_ORDER, "atlas frame order must match the exact approved manifest");
assert.equal(new Set(metadata.frames.map((frame) => frame.name)).size, STRUCTURE_ORDER.length, "v4 structure names must be unique");

const runtimeFrames = parseRuntimeFrameTable(runtimeSource, STRUCTURE_ORDER.length, "structure");

const expectedFiles = STRUCTURE_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
const sourceEntries = await readdir(sourceDirectory, { withFileTypes: true });
assert.ok(sourceEntries.every((entry) => entry.isFile()), "committed v4 structures source directory must contain files only");
assert.deepEqual(sourceEntries.map((entry) => entry.name).sort(compareAlphabetically), expectedFiles, "committed v4 structures source directory must contain exactly the approved 4 PNGs");

const sourceHashes = new Map();
for (const name of STRUCTURE_ORDER) {
  const fileName = `${name}.png`;
  assert.ok(runtimeFrames.has(name), `${name}: missing from runtime v4 structure frame table`);

  const sourceBuffer = await readFile(path.join(sourceDirectory, fileName));
  const sourceMeta = await sharp(sourceBuffer).metadata();
  assert.equal(sourceMeta.format, "png", `${fileName}: committed source must strictly decode as PNG`);
  assert.ok(sourceMeta.hasAlpha, `${fileName}: committed source must preserve alpha`);

  const generatedBuffer = await readFile(path.join(generatedSourceDirectory, fileName));
  assert.equal(Buffer.compare(sourceBuffer, generatedBuffer), 0, `${fileName}: generated source differs from committed PNG`);

  const hash = createHash("sha256").update(sourceBuffer).digest("hex");
  assert.ok(!sourceHashes.has(hash), `${fileName}: exact duplicate of ${sourceHashes.get(hash)}`);
  sourceHashes.set(hash, fileName);
}

const footprintByName = new Map(metadata.frames.map((frame) => [frame.name, frame.footprint]));
assert.equal(footprintByName.get("house").cells.length, 3, "house footprint must match the code-authoritative HOUSE_FOOTPRINT (3 hexes)");
assert.equal(footprintByName.get("house-damaged").cells.length, 3, "house-damaged footprint must match house's own footprint (3 hexes)");
assert.equal(footprintByName.get("datacenter").radius, 1, "datacenter footprint must match createFacilityFootprint(anchor, false) = hexDisk(anchor, 1)");
assert.equal(footprintByName.get("mainframe").radius, 2, "mainframe footprint must match createFacilityFootprint(anchor, true) = hexDisk(anchor, 2)");

const { data, info } = await decodeAtlasWithTransparentCorners(atlasPath, "v4 structures atlas must preserve alpha");

for (const frame of metadata.frames) {
  assertFrameGeometry(frame, runtimeFrames, { data, info }, "structure");
}

assert.match(facadeSource, /rewild-structure-atlas-v4/u, "the v3/v2 compatibility facade must route the structure roster through the v4 structure atlas");
assert.match(facadeSource, /REWILD_STRUCTURE_V4_IDS/u, "facade must gate v4 structure drawing by the exact approved id set");

console.log(`Rewild v4 structures atlas validated: ${STRUCTURE_ORDER.length} strict PNG sources, generated/runtime frames agree, transparent atlas, no duplicate entries.`);
