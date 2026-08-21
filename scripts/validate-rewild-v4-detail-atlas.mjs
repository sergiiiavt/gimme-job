import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { DETAIL_ORDER } from "./build-rewild-v4-detail-atlas.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlasPath = path.join(root, "public", "rewild", "v4", "environment-details-atlas-v4.png");
const metadataPath = path.join(root, "public", "rewild", "v4", "environment-details-atlas-v4.json");
const generatedSourceDirectory = path.join(root, "public", "rewild", "v4", "source");
const bundleDirectory = path.join(root, "assets", "rewild", "v4", "source-b64");
const runtimeSource = await readFile(path.join(root, "app", "rewild-detail-atlas-v4.ts"), "utf8");
const overlaySource = await readFile(path.join(root, "app", "rewild-authored-overlay.ts"), "utf8");

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.equal(metadata.image, "environment-details-atlas-v4.png");
assert.deepEqual(metadata.grid, { columns: 6, rows: 4, slotSize: 128 });
assert.equal(metadata.frames.length, 22);
assert.deepEqual(metadata.frames.map((frame) => frame.name), DETAIL_ORDER, "atlas frame order must match the exact approved manifest");
assert.equal(new Set(metadata.frames.map((frame) => frame.name)).size, DETAIL_ORDER.length, "v4 detail names must be unique");

const sourceBundles = {};
for (const bundle of ["nature-a.json", "nature-b.json", "industrial.json"]) {
  Object.assign(sourceBundles, JSON.parse(await readFile(path.join(bundleDirectory, bundle), "utf8")));
}
assert.equal(Object.keys(sourceBundles).length, DETAIL_ORDER.length, "source bundles must contain exactly 22 approved assets");

const sourceHashes = new Map();
for (const name of DETAIL_ORDER) {
  const fileName = `${name}.png`;
  assert.ok(fileName in sourceBundles, `${fileName}: missing source payload`);
  assert.match(runtimeSource, new RegExp(`\\"${name}\\"`), `${name}: missing from runtime v4 atlas ID list`);

  const sourceBuffer = Buffer.from(sourceBundles[fileName], "base64");
  const generatedBuffer = await readFile(path.join(generatedSourceDirectory, fileName));
  assert.equal(Buffer.compare(sourceBuffer, generatedBuffer), 0, `${fileName}: generated source differs from approved payload`);

  const hash = createHash("sha256").update(sourceBuffer).digest("hex");
  assert.ok(!sourceHashes.has(hash), `${fileName}: exact duplicate of ${sourceHashes.get(hash)}`);
  sourceHashes.set(hash, fileName);
}

for (const fileName of Object.keys(sourceBundles)) {
  const name = fileName.replace(/\.png$/u, "");
  assert.ok(DETAIL_ORDER.includes(name), `${fileName}: hallucinated/unapproved source asset`);
}

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
  assert.ok(!DETAIL_ORDER.includes(forbidden), `${forbidden}: hallucinated gameplay entity entered detail manifest`);
}

const atlasMeta = await sharp(atlasPath).metadata();
assert.equal(atlasMeta.width, 768);
assert.equal(atlasMeta.height, 512);
assert.ok(atlasMeta.hasAlpha, "v4 detail atlas must preserve alpha");

const { data, info } = await sharp(atlasPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const cornerOffsets = [
  0,
  info.width - 1,
  (info.height - 1) * info.width,
  info.width * info.height - 1,
];
for (const pixel of cornerOffsets) assert.equal(data[pixel * info.channels + 3], 0, "atlas canvas corners must remain transparent");

for (const frame of metadata.frames) {
  const { x, y, width, height } = frame.frame;
  assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, `${frame.name}: invalid frame rectangle`);
  assert.ok(x + width <= info.width && y + height <= info.height, `${frame.name}: frame exceeds atlas bounds`);
  assert.ok(frame.pivot.x >= 0 && frame.pivot.x <= 1 && frame.pivot.y >= 0 && frame.pivot.y <= 1, `${frame.name}: invalid pivot`);
  assert.deepEqual(frame.footprint, ["0,0"], `${frame.name}: Batch 01B/01C details must remain decorative one-cell assets`);

  let visible = 0;
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (data[(py * info.width + px) * info.channels + 3] > 24) visible += 1;
    }
  }
  assert.ok(visible >= 24, `${frame.name}: atlas frame is effectively empty`);
}

assert.match(overlaySource, /drawRewildDetailV4/u, "authored overlay must use the v4 detail renderer");
assert.match(overlaySource, /CLUSTER_OFFSETS/u, "meadow details must remain clustered rather than uniform per-cell stamps");
assert.match(overlaySource, /shorelinePoint/u, "water details must remain boundary-aware");

console.log(`Rewild v4 detail atlas validated: ${DETAIL_ORDER.length} exact assets, transparent atlas, no duplicate or hallucinated entries.`);
