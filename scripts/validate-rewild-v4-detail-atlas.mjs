import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { DETAIL_ORDER } from "./build-rewild-v4-detail-atlas.mjs";
import { decodeAtlasWithTransparentCorners } from "./rewild-v4-atlas-validate-pixels.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlasPath = path.join(root, "public", "rewild", "v4", "environment-details-atlas-v4.png");
const metadataPath = path.join(root, "public", "rewild", "v4", "environment-details-atlas-v4.json");
const generatedSourceDirectory = path.join(root, "public", "rewild", "v4", "source");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "source");
const runtimeSource = await readFile(path.join(root, "app", "rewild-detail-atlas-v4.ts"), "utf8");
const overlaySource = await readFile(path.join(root, "app", "rewild-authored-overlay.ts"), "utf8");
const compareAlphabetically = (left, right) => left.localeCompare(right);

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.equal(metadata.image, "environment-details-atlas-v4.png");
assert.equal(metadata.source, "assets/rewild/v4/source");
assert.deepEqual(metadata.grid, { columns: 6, rows: 4, slotSize: 128 });
assert.equal(metadata.frames.length, 24);
assert.deepEqual(metadata.frames.map((frame) => frame.name), DETAIL_ORDER, "atlas frame order must match the exact approved manifest");
assert.equal(new Set(metadata.frames.map((frame) => frame.name)).size, DETAIL_ORDER.length, "v4 detail names must be unique");

const runtimeFramePattern = /^\s*"([^"]+)": \{ x: (\d+), y: (\d+), width: (\d+), height: (\d+), pivotX: ([\d.]+), pivotY: ([\d.]+) \},$/gmu;
const runtimeFrames = new Map(
  [...runtimeSource.matchAll(runtimeFramePattern)].map((match) => [match[1], {
    frame: {
      x: Number.parseInt(match[2], 10),
      y: Number.parseInt(match[3], 10),
      width: Number.parseInt(match[4], 10),
      height: Number.parseInt(match[5], 10),
    },
    pivot: {
      x: Number.parseFloat(match[6]),
      y: Number.parseFloat(match[7]),
    },
  }]),
);
assert.equal(runtimeFrames.size, DETAIL_ORDER.length, "runtime v4 frame table must contain exactly the approved detail IDs");

const expectedFiles = DETAIL_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
const sourceEntries = await readdir(sourceDirectory, { withFileTypes: true });
assert.ok(sourceEntries.every((entry) => entry.isFile()), "committed v4 source directory must contain files only");
assert.deepEqual(sourceEntries.map((entry) => entry.name).sort(compareAlphabetically), expectedFiles, "committed v4 source directory must contain exactly the approved PNGs");

const sourceHashes = new Map();
for (const name of DETAIL_ORDER) {
  const fileName = `${name}.png`;
  assert.ok(runtimeFrames.has(name), `${name}: missing from runtime v4 frame table`);

  const sourceBuffer = await readFile(path.join(sourceDirectory, fileName));
  const sourceMeta = await sharp(sourceBuffer).metadata();
  assert.equal(sourceMeta.format, "png", `${fileName}: committed source must strictly decode as PNG`);
  assert.ok(sourceMeta.hasAlpha, `${fileName}: committed source must preserve alpha`);
  assert.ok(sourceMeta.width && sourceMeta.height, `${fileName}: committed source dimensions are missing`);
  assert.ok(sourceMeta.width <= 128 && sourceMeta.height <= 128, `${fileName}: committed source exceeds atlas slot`);

  const generatedBuffer = await readFile(path.join(generatedSourceDirectory, fileName));
  assert.equal(Buffer.compare(sourceBuffer, generatedBuffer), 0, `${fileName}: generated source differs from committed PNG`);

  const hash = createHash("sha256").update(sourceBuffer).digest("hex");
  assert.ok(!sourceHashes.has(hash), `${fileName}: exact duplicate of ${sourceHashes.get(hash)}`);
  sourceHashes.set(hash, fileName);
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

const { atlasMeta, data, info } = await decodeAtlasWithTransparentCorners(atlasPath, "v4 detail atlas must preserve alpha");
assert.equal(atlasMeta.width, 768);
assert.equal(atlasMeta.height, 512);

for (const frame of metadata.frames) {
  const { x, y, width, height } = frame.frame;
  assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, `${frame.name}: invalid frame rectangle`);
  assert.ok(x + width <= info.width && y + height <= info.height, `${frame.name}: frame exceeds atlas bounds`);
  assert.ok(frame.pivot.x >= 0 && frame.pivot.x <= 1 && frame.pivot.y >= 0 && frame.pivot.y <= 1, `${frame.name}: invalid pivot`);
  assert.deepEqual(frame.footprint, ["0,0"], `${frame.name}: Batch 01B/01C details must remain decorative one-cell assets`);
  assert.deepEqual(runtimeFrames.get(frame.name), { frame: frame.frame, pivot: frame.pivot }, `${frame.name}: runtime frame must exactly match generated atlas metadata`);

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
assert.match(overlaySource, /"detail-tree-pine-a"/u, "forest density must draw the real detail-tree-pine-a sprite, not the old v3 tree-pine fallback");
assert.match(overlaySource, /"detail-tree-broadleaf-a"/u, "forest density must draw the real detail-tree-broadleaf-a sprite, not the old v3 tree-broadleaf fallback");
assert.doesNotMatch(overlaySource, /drawRewildSprite\(ctx, sprite/u, "drawForestDensity must no longer call the old v3 drawRewildSprite path for trees");

console.log(`Rewild v4 detail atlas validated: ${DETAIL_ORDER.length} strict PNG sources, generated/runtime frames agree, transparent atlas, no duplicate or hallucinated entries.`);
