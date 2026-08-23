import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { GROUND_ORDER } from "./build-rewild-v4-ground-atlas.mjs";
import { decodeAtlasWithTransparentCorners } from "./rewild-v4-atlas-validate-pixels.mjs";
import { assertFrameGeometry, parseRuntimeFrameTable } from "./rewild-v4-atlas-validate-frames.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlasPath = path.join(root, "public", "rewild", "v4", "ground-atlas-v4.png");
const metadataPath = path.join(root, "public", "rewild", "v4", "ground-atlas-v4.json");
const generatedSourceDirectory = path.join(root, "public", "rewild", "v4", "ground-source");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "ground-source");
const runtimeSource = await readFile(path.join(root, "app", "rewild-ground-atlas-v4.ts"), "utf8");
const rendererSource = await readFile(path.join(root, "app", "rewild-production-renderer.ts"), "utf8");
const compareAlphabetically = (left, right) => left.localeCompare(right);

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.equal(metadata.image, "ground-atlas-v4.png");
assert.equal(metadata.source, "assets/rewild/v4/ground-source");
assert.equal(metadata.frames.length, 4);
assert.deepEqual(metadata.frames.map((frame) => frame.name), GROUND_ORDER, "atlas frame order must match the exact approved manifest");
assert.equal(new Set(metadata.frames.map((frame) => frame.name)).size, GROUND_ORDER.length, "v4 ground tile names must be unique");

const runtimeFrames = parseRuntimeFrameTable(runtimeSource, GROUND_ORDER.length, "ground");

const expectedFiles = GROUND_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
const sourceEntries = await readdir(sourceDirectory, { withFileTypes: true });
assert.ok(sourceEntries.every((entry) => entry.isFile()), "committed v4 ground source directory must contain files only");
assert.deepEqual(sourceEntries.map((entry) => entry.name).sort(compareAlphabetically), expectedFiles, "committed v4 ground source directory must contain exactly the approved 4 PNGs");

const sourceHashes = new Map();
for (const name of GROUND_ORDER) {
  const fileName = `${name}.png`;
  assert.ok(runtimeFrames.has(name), `${name}: missing from runtime v4 ground frame table`);

  const sourceBuffer = await readFile(path.join(sourceDirectory, fileName));
  const sourceMeta = await sharp(sourceBuffer).metadata();
  assert.equal(sourceMeta.format, "png", `${fileName}: committed source must strictly decode as PNG`);
  assert.ok(sourceMeta.hasAlpha, `${fileName}: committed source must preserve alpha`);
  assert.equal(sourceMeta.width, 64, `${fileName}: committed source width must be exactly 64px`);
  assert.equal(sourceMeta.height, 56, `${fileName}: committed source height must be exactly 56px`);

  const generatedBuffer = await readFile(path.join(generatedSourceDirectory, fileName));
  assert.equal(Buffer.compare(sourceBuffer, generatedBuffer), 0, `${fileName}: generated source differs from committed PNG`);

  const hash = createHash("sha256").update(sourceBuffer).digest("hex");
  assert.ok(!sourceHashes.has(hash), `${fileName}: exact duplicate of ${sourceHashes.get(hash)}`);
  sourceHashes.set(hash, fileName);
}

const { data, info } = await decodeAtlasWithTransparentCorners(atlasPath, "v4 ground atlas must preserve alpha");

for (const frame of metadata.frames) {
  assertFrameGeometry(frame, runtimeFrames, { data, info }, "ground tile");
  assert.deepEqual(frame.footprint, ["0,0"], `${frame.name}: ground tiles are drawn one per hex cell`);
}

// Geometry check (Art Bible rule: generated hex art is never geometry authority — the runtime's
// regular flat-top hex from app/rewild-hex-grid.ts is). Every committed source PNG's alpha
// silhouette must be the exact flat-top hexagon at this native size, not whatever shape the
// generator happened to draw.
function hexPolygonPoints(width, height) {
  const size = width / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index;
    return [centerX + Math.cos(angle) * size, centerY + Math.sin(angle) * size];
  });
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

for (const name of GROUND_ORDER) {
  const fileName = `${name}.png`;
  const { data: pixels, info: pixelInfo } = await sharp(path.join(sourceDirectory, fileName))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const polygon = hexPolygonPoints(pixelInfo.width, pixelInfo.height);
  let mismatched = 0;
  for (let y = 0; y < pixelInfo.height; y += 1) {
    for (let x = 0; x < pixelInfo.width; x += 1) {
      const alpha = pixels[(y * pixelInfo.width + x) * 4 + 3];
      const visible = alpha > 24;
      // Sample the pixel center, and treat alpha strictly at the polygon's own edge as a wash to
      // tolerate the couple of pixels of antialiasing every real hexagon-masked PNG has.
      const insideCore = pointInPolygon(x + .5, y + .5, polygon);
      if (visible && !insideCore) mismatched += 1;
    }
  }
  const totalPixels = pixelInfo.width * pixelInfo.height;
  assert.ok(mismatched / totalPixels < .02, `${fileName}: ${mismatched} visible pixels fall outside the exact flat-top hex silhouette — geometry must come from code, not the generator`);
}

for (const id of GROUND_ORDER) {
  assert.ok(rendererSource.includes(`"${id}"`) || rendererSource.includes(`'${id}'`), `${id}: not referenced in app/rewild-production-renderer.ts ground fill`);
}
assert.match(rendererSource, /drawRewildGroundV4Sprite\(ctx, variant, center\.x, center\.y/u, "meadow ground must be drawn as a real hex-tile sprite via drawRewildGroundV4Sprite inside drawGround");
assert.match(rendererSource, /from "\.\/rewild-ground-atlas-v4"/u, "drawGround must import the v4 ground sprite runtime directly");

console.log(`Rewild v4 ground atlas validated: ${GROUND_ORDER.length} strict hex-shaped PNG sources, generated/runtime frames agree, transparent atlas, no duplicate entries.`);
