import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  ALL_TERRAIN_TILE_IDS,
  CORRUPTION_FAMILY_TILE_IDS,
  FOREST_WATER_FAMILY_TILE_IDS,
  MEADOW_FAMILY_TILE_IDS,
  buildRewildTerrainAtlas,
} from "./build-rewild-terrain-atlas.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const atlasPath = path.join(root, "public", "rewild", "overhead", "terrain-atlas-v3.png");
const sourceDirectory = path.join(root, "assets", "rewild", "terrain", "source");
const forestWaterSourceDirectory = path.join(root, "assets", "rewild", "terrain", "forest-water-source");
const corruptionSourceDirectory = path.join(root, "assets", "rewild", "terrain", "corruption-source");
const runtimeSource = await readFile(path.join(root, "app", "rewild-pixel-atlas-v3.ts"), "utf8");
const rendererSource = await readFile(path.join(root, "app", "rewild-production-renderer.ts"), "utf8");
const overlaySource = await readFile(path.join(root, "app", "rewild-authored-overlay.ts"), "utf8");

const FRAME_SIZE = 32;
const ATLAS_COLUMNS = 8;
const compareAlphabetically = (left, right) => left.localeCompare(right);

// The 16 tile IDs that existed before this batch, in their original order. Any change to
// this prefix would shift every existing frame's computed atlas position.
const PRE_EXISTING_TILE_IDS = [
  "grass-a", "grass-b", "grass-c", "forest-floor", "water-deep", "water-shallow", "soil",
  "industrial-a", "industrial-b", "corruption-1", "corruption-2", "corruption-3", "corruption-4",
  "road-dirt", "road-edge", "rubble",
];

// 1. Runtime REWILD_TERRAIN_TILE_IDS: pre-existing prefix untouched, new tiles appended after it.
const runtimeArrayMatch = runtimeSource.match(/export const REWILD_TERRAIN_TILE_IDS = \[([\s\S]*?)\] as const;/u);
assert.ok(runtimeArrayMatch, "REWILD_TERRAIN_TILE_IDS not found in app/rewild-pixel-atlas-v3.ts");
const runtimeTileIds = [...runtimeArrayMatch[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);

assert.deepEqual(
  runtimeTileIds.slice(0, PRE_EXISTING_TILE_IDS.length),
  PRE_EXISTING_TILE_IDS,
  "the 16 pre-existing terrain tile IDs must stay in their original order — reordering shifts every existing atlas frame",
);
assert.deepEqual(
  runtimeTileIds.slice(PRE_EXISTING_TILE_IDS.length),
  ["grass-d"],
  "new meadow tiles must be appended immediately after the pre-existing 16, in this exact order",
);
assert.deepEqual(runtimeTileIds, ALL_TERRAIN_TILE_IDS, "build script's ALL_TERRAIN_TILE_IDS must match the runtime array exactly");
assert.equal(new Set(runtimeTileIds).size, runtimeTileIds.length, "terrain tile IDs must be unique");

// 2. Committed source PNGs: exactly each family's tiles, each a valid 32x32 PNG.
const { readdir } = await import("node:fs/promises");

async function validateCommittedFamily(directory, tileIds, label) {
  const expectedFiles = tileIds.map((id) => `${id}.png`).sort(compareAlphabetically);
  const entries = await readdir(directory, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), `committed ${label} terrain source directory must contain files only`);
  assert.deepEqual(entries.map((entry) => entry.name).sort(compareAlphabetically), expectedFiles, `committed ${label} terrain source directory must contain exactly its family's approved PNGs`);

  const raw = new Map();
  for (const id of tileIds) {
    const fileName = `${id}.png`;
    const buffer = await readFile(path.join(directory, fileName));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png", `${fileName}: committed source must strictly decode as PNG`);
    assert.equal(metadata.width, FRAME_SIZE, `${fileName}: committed source must be exactly ${FRAME_SIZE}px wide`);
    assert.equal(metadata.height, FRAME_SIZE, `${fileName}: committed source must be exactly ${FRAME_SIZE}px tall`);
    raw.set(id, await sharp(buffer).ensureAlpha().raw().toBuffer());
  }
  return raw;
}

const sourceRaw = await validateCommittedFamily(sourceDirectory, MEADOW_FAMILY_TILE_IDS, "meadow");
const forestWaterRaw = await validateCommittedFamily(forestWaterSourceDirectory, FOREST_WATER_FAMILY_TILE_IDS, "forest/water");
for (const [id, buffer] of forestWaterRaw) sourceRaw.set(id, buffer);
const corruptionRaw = await validateCommittedFamily(corruptionSourceDirectory, CORRUPTION_FAMILY_TILE_IDS, "corruption");
for (const [id, buffer] of corruptionRaw) sourceRaw.set(id, buffer);

// 3. Rebuilding from committed source must reproduce the committed atlas exactly (no drift).
const committedAtlas = await readFile(atlasPath);
await buildRewildTerrainAtlas();
const rebuiltAtlas = await readFile(atlasPath);
assert.equal(Buffer.compare(committedAtlas, rebuiltAtlas), 0, "committed terrain-atlas-v3.png does not match a fresh build from committed source — rebuild and commit the output");

// 4. Atlas sanity: decodes, correct size, has alpha.
const atlasMeta = await sharp(atlasPath).metadata();
assert.equal(atlasMeta.width, 256);
assert.equal(atlasMeta.height, 256);
assert.ok(atlasMeta.hasAlpha, "terrain atlas must be RGBA");

const { data: atlasData, info: atlasInfo } = await sharp(atlasPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (const id of [...MEADOW_FAMILY_TILE_IDS, ...FOREST_WATER_FAMILY_TILE_IDS, ...CORRUPTION_FAMILY_TILE_IDS]) {
  const index = ALL_TERRAIN_TILE_IDS.indexOf(id);
  const left = (index % ATLAS_COLUMNS) * FRAME_SIZE;
  const top = Math.floor(index / ATLAS_COLUMNS) * FRAME_SIZE;

  // 5. Atlas frame must pixel-match the committed source exactly.
  const expected = sourceRaw.get(id);
  const actual = Buffer.alloc(FRAME_SIZE * FRAME_SIZE * 4);
  for (let row = 0; row < FRAME_SIZE; row += 1) {
    const atlasRowStart = ((top + row) * atlasInfo.width + left) * 4;
    atlasData.copy(actual, row * FRAME_SIZE * 4, atlasRowStart, atlasRowStart + FRAME_SIZE * 4);
  }
  assert.equal(Buffer.compare(expected, actual), 0, `${id}: atlas frame does not match committed source pixel-for-pixel`);

  // 6. Frame must not be a degenerate flat fill (real texture, not an accidental blank/solid tile).
  const colors = new Set();
  for (let p = 0; p < actual.length; p += 4) colors.add(`${actual[p]},${actual[p + 1]},${actual[p + 2]}`);
  assert.ok(colors.size >= 8, `${id}: atlas frame has almost no color variation (${colors.size} distinct colors) — looks blank or a flat fill, not authored texture`);
}

// 7. Renderer wiring: forest/water/corruption tiles must be referenced and fill the hex ground
// itself (fillRewildTerrainPattern) as part of drawGround, before any entity draws — not a
// post-hoc overlay stamp that needs per-frame exclusion logic to avoid painting over units.
// Forest and water previously fell back to a flat procedural color; every forest cell already
// gets a real tree from drawForestDensity (one per hex, no sparse/clearing gate) and every water
// cell gets its own real ground texture here, so the two layer together instead of the
// tree/shoreline decor sitting on bare flat color.
// (Meadow/grass moved off this tiled-pattern path entirely — see validate-rewild-v4-ground-atlas.mjs;
// the v3 meadow source PNGs validated above stay committed as inert legacy assets, matching the
// precedent for other now-unused v3 tiles like water-lilies.)
for (const id of [...FOREST_WATER_FAMILY_TILE_IDS, ...CORRUPTION_FAMILY_TILE_IDS]) {
  assert.ok(rendererSource.includes(`"${id}"`), `${id}: not referenced in app/rewild-production-renderer.ts ground fill`);
}
assert.match(rendererSource, /fillRewildTerrainPattern\(ctx, "forest-floor", hexPath\(cell\.hex/u, "forest ground must be filled with real tile art via fillRewildTerrainPattern inside drawGround");
assert.match(rendererSource, /fillRewildTerrainPattern\(ctx, exterior === 0 \? "water-deep" : "water-shallow", hexPath\(cell\.hex/u, "water ground must be filled with real tile art via fillRewildTerrainPattern inside drawGround, deep vs shallow chosen by exterior neighbor count");
assert.match(rendererSource, /function drawGround\(/u, "drawGround must remain the home of the terrain tile fill");
{
  const groundStart = rendererSource.indexOf("function drawGround(");
  const groundEnd = rendererSource.indexOf("\nfunction ", groundStart + 1);
  const groundBody = rendererSource.slice(groundStart, groundEnd === -1 ? undefined : groundEnd);
  assert.match(groundBody, /fillRewildTerrainPattern/u, "the terrain tile fill must live inside drawGround itself, not merely be referenced elsewhere in the file");
}

// 8. Water overlay wiring: rewild-authored-overlay.ts still adds reeds and lily pads per water
// cell (matching the corruption/industrial decal convention), but must not also stamp
// water-deep/water-shallow itself — drawGround already fills the whole hex with that art, and a
// second small centered textureCell stamp on top would just double-render the same texture.
assert.doesNotMatch(overlaySource, /textureCell\(ctx, cell, "water-(deep|shallow)"/u, "water-deep/water-shallow must not also be drawn as a textureCell overlay stamp now that drawGround fills the whole hex with this art");
assert.match(overlaySource, /detail-lily-pads-a/u, "water overlay must still add lily pad decor");
assert.match(overlaySource, /detail-reeds-a/u, "water overlay must still add reed decor");

// 9. Corruption wiring: drawCorruptionGround fills every corrupted, non-foundation hex with real
// per-level tile art (a stressed/polluted-to-wasted/electrically-stressed material progression,
// per SPRITE_MANIFEST.md — never purple crystal/fantasy corruption) via fillRewildTerrainPattern,
// replacing the old flat CORRUPTION_PALETTE-only fill. The overlay's old low-alpha
// textureCell(corruption-N) stamp is now redundant with that real fill and must be gone, not
// double-drawing the same art on top of itself.
assert.match(rendererSource, /function drawCorruptionGround\(/u, "drawCorruptionGround must remain the home of the corruption tile fill");
{
  const corruptionStart = rendererSource.indexOf("function drawCorruptionGround(");
  const corruptionEnd = rendererSource.indexOf("\nfunction ", corruptionStart + 1);
  const corruptionBody = rendererSource.slice(corruptionStart, corruptionEnd === -1 ? undefined : corruptionEnd);
  assert.match(corruptionBody, /fillRewildTerrainPattern\(ctx, CORRUPTION_TILES\[cell\.corruption\], hexPath\(cell\.hex/u, "corruption ground must be filled with real tile art via fillRewildTerrainPattern, chosen per corruption level");
}
for (const id of CORRUPTION_FAMILY_TILE_IDS) {
  assert.ok(rendererSource.includes(`"${id}"`), `${id}: not referenced in the CORRUPTION_TILES level lookup`);
}
assert.doesNotMatch(overlaySource, /function drawCorruptionDetail/u, "drawCorruptionDetail's textureCell(corruption-N) stamp is redundant now that drawCorruptionGround fills the whole hex with this art");
assert.doesNotMatch(overlaySource, /textureCell\(ctx, cell, `corruption-/u, "corruption-N must not also be drawn as a textureCell overlay stamp now that drawCorruptionGround fills the whole hex with this art");

console.log(`Rewild terrain atlas validated: ${MEADOW_FAMILY_TILE_IDS.length} meadow tiles, ${FOREST_WATER_FAMILY_TILE_IDS.length} forest/water tiles, and ${CORRUPTION_FAMILY_TILE_IDS.length} corruption tiles, pre-existing 16 IDs untouched, atlas matches committed source, overlay wiring intact.`);
