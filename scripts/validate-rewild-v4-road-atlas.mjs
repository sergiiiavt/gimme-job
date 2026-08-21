import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ROAD_ORDER } from "./build-rewild-v4-road-atlas.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "road-source");
const atlasPath = path.join(root, "public", "rewild", "v4", "roads-fences-atlas-v4.png");
const metadataPath = path.join(root, "public", "rewild", "v4", "roads-fences-atlas-v4.json");
const runtimeSource = await readFile(path.join(root, "app", "rewild-road-atlas-v4.ts"), "utf8");
const compareAlphabetically = (left, right) => left.localeCompare(right);

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.equal(metadata.image, "roads-fences-atlas-v4.png");
assert.equal(metadata.source, "assets/rewild/v4/road-source");
assert.deepEqual(metadata.geometry, { orientation: "flat-top", directions: 6, rotationStepDegrees: 60 });
assert.deepEqual(metadata.grid, { columns: 4, rows: 4, slotSize: 64 });
assert.equal(metadata.frames.length, ROAD_ORDER.length);
assert.deepEqual(metadata.frames.map((frame) => frame.name), ROAD_ORDER);
assert.equal(new Set(metadata.frames.map((frame) => frame.name)).size, ROAD_ORDER.length);

const expectedFiles = ROAD_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
const entries = await readdir(sourceDirectory, { withFileTypes: true });
assert.ok(entries.every((entry) => entry.isFile()), "road source directory must contain files only");
assert.deepEqual(entries.map((entry) => entry.name).sort(compareAlphabetically), expectedFiles, "road source directory must contain exactly the approved 14 PNGs");

const hashes = new Map();
for (const fileName of expectedFiles) {
  const buffer = await readFile(path.join(sourceDirectory, fileName));
  const image = await sharp(buffer).metadata();
  assert.equal(image.format, "png", `${fileName}: must strictly decode as PNG`);
  assert.ok(image.hasAlpha, `${fileName}: must preserve transparency`);
  assert.equal(image.width, 64, `${fileName}: width must stay 64px`);
  assert.equal(image.height, 64, `${fileName}: height must stay 64px`);
  const hash = createHash("sha256").update(buffer).digest("hex");
  assert.ok(!hashes.has(hash), `${fileName}: exact duplicate of ${hashes.get(hash)}`);
  hashes.set(hash, fileName);
}

const atlasMeta = await sharp(atlasPath).metadata();
assert.equal(atlasMeta.width, 256);
assert.equal(atlasMeta.height, 256);
assert.ok(atlasMeta.hasAlpha, "road atlas must preserve alpha");
const { data, info } = await sharp(atlasPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (const offset of [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1]) {
  assert.equal(data[offset * info.channels + 3], 0, "atlas outer corners must remain transparent");
}

for (const [index, frame] of metadata.frames.entries()) {
  assert.deepEqual(frame.frame, {
    x: (index % 4) * 64,
    y: Math.floor(index / 4) * 64,
    width: 64,
    height: 64,
  }, `${frame.name}: frame must stay on the fixed 64px grid`);
  assert.deepEqual(frame.pivot, { x: 0.5, y: 0.5 });
  assert.deepEqual(frame.footprint, ["0,0"]);
  assert.ok(Array.isArray(frame.connectors) && frame.connectors.length >= 2 && frame.connectors.length <= 4, `${frame.name}: invalid connector count`);
  assert.equal(new Set(frame.connectors).size, frame.connectors.length, `${frame.name}: duplicate connector direction`);
  assert.ok(frame.connectors.every((direction) => Number.isInteger(direction) && direction >= 0 && direction < 6), `${frame.name}: connector direction outside flat-top six-neighbor grid`);

  let visible = 0;
  for (let y = frame.frame.y; y < frame.frame.y + 64; y += 1) {
    for (let x = frame.frame.x; x < frame.frame.x + 64; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 24) visible += 1;
    }
  }
  assert.ok(visible >= 40, `${frame.name}: frame is effectively empty`);
}

for (const id of ROAD_ORDER) assert.match(runtimeSource, new RegExp(`"${id}"`, "u"), `${id}: missing from runtime atlas roster`);
assert.match(runtimeSource, /rotateConnectorMask/u, "runtime must rotate connector masks in six discrete directions");
assert.match(runtimeSource, /selectRoadV4/u, "runtime must select roads from connector masks");
assert.match(runtimeSource, /selectFenceV4/u, "runtime must select fence/gate variants from connector masks");
assert.match(runtimeSource, /-steps \* Math\.PI \/ 3/u, "runtime sprite rotation must be exact 60-degree steps");

const forbidden = ["scout", "harvester", "planter", "ranger", "builder", "transport", "mainframe-link", "scrapper", "synth-hive"];
for (const id of forbidden) assert.ok(!ROAD_ORDER.includes(id), `${id}: hallucinated gameplay entity entered the road atlas`);

console.log(`Rewild v4 road atlas validated: ${ROAD_ORDER.length} strict PNG sources, regular flat-top six-direction connector metadata, no duplicates or hallucinated entities.`);
