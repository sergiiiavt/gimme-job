import assert from "node:assert/strict";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "terrain", "source");
const forestWaterSourceDirectory = path.join(root, "assets", "rewild", "terrain", "forest-water-source");
const atlasPath = path.join(root, "public", "rewild", "overhead", "terrain-atlas-v3.png");

const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 8;
const FRAME_SIZE = 32;

// Must mirror REWILD_TERRAIN_TILE_IDS in app/rewild-pixel-atlas-v3.ts exactly (same order,
// same length) — atlas frame position is index-derived, so this array's order is load-bearing.
// New tiles are appended at the end; never reorder or insert, or every later frame shifts.
export const ALL_TERRAIN_TILE_IDS = [
  "grass-a", "grass-b", "grass-c", "forest-floor", "water-deep", "water-shallow", "soil",
  "industrial-a", "industrial-b", "corruption-1", "corruption-2", "corruption-3", "corruption-4",
  "road-dirt", "road-edge", "rubble",
  "grass-d",
];

// This build step owns the meadow and forest/water families' slots. Other families (soil,
// industrial, corruption, road) stay whatever the existing committed atlas already has for them
// (typically still-empty reserved slots) — each family adds its own source directory and extends
// this script's sibling list when its own batch lands, per the Visual Bible's "one family at a
// time" rule.
export const MEADOW_FAMILY_TILE_IDS = ["grass-a", "grass-b", "grass-c", "grass-d"];

// Prompted fresh from code-authoritative BiomeKind data and the approved references only —
// 04-terrain-transitions.webp (rejected, forbidden for transition/terrain-geometry generation)
// was not used. See docs/rewild/visual-bible/batches/04-forest-and-water.md.
export const FOREST_WATER_FAMILY_TILE_IDS = ["forest-floor", "water-deep", "water-shallow"];

const compareAlphabetically = (left, right) => left.localeCompare(right);

async function validateFamilyDirectory(directory, tileIds, label) {
  const expectedFiles = tileIds.map((id) => `${id}.png`).sort(compareAlphabetically);
  const entries = await readdir(directory, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), `${label} terrain source directory must contain files only`);
  const actualFiles = entries.map((entry) => entry.name).sort(compareAlphabetically);
  assert.deepEqual(actualFiles, expectedFiles, `${label} terrain source directory must contain exactly its family's approved PNGs`);
}

async function loadExistingAtlasComposite() {
  try {
    const buffer = await readFile(atlasPath);
    const metadata = await sharp(buffer).metadata();
    if (metadata.width !== ATLAS_COLUMNS * FRAME_SIZE || metadata.height !== ATLAS_ROWS * FRAME_SIZE) {
      console.warn(`Existing atlas has unexpected dimensions (${metadata.width}x${metadata.height}); rebuilding from a blank canvas.`);
      return null;
    }
    // Force a full pixel decode (not just header parsing) so a byte-level decode problem
    // surfaces here instead of silently propagating a broken base into the rebuilt atlas.
    const raw = await sharp(buffer).ensureAlpha().raw().toBuffer();
    return { input: raw, raw: { width: metadata.width, height: metadata.height, channels: 4 } };
  } catch (error) {
    console.warn(`Existing atlas at ${path.relative(root, atlasPath)} could not be decoded (${error.message}); rebuilding from a blank canvas.`);
    return null;
  }
}

async function familyComposites(directory, tileIds) {
  const composites = [];
  for (const id of tileIds) {
    const index = ALL_TERRAIN_TILE_IDS.indexOf(id);
    assert.ok(index >= 0, `${id}: not present in ALL_TERRAIN_TILE_IDS`);

    const buffer = await readFile(path.join(directory, `${id}.png`));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png", `${id}.png: source must decode as PNG`);
    assert.equal(metadata.width, FRAME_SIZE, `${id}.png: source must be exactly ${FRAME_SIZE}px wide`);
    assert.equal(metadata.height, FRAME_SIZE, `${id}.png: source must be exactly ${FRAME_SIZE}px tall`);

    const column = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    composites.push({ input: buffer, left: column * FRAME_SIZE, top: row * FRAME_SIZE });
  }
  return composites;
}

export async function buildRewildTerrainAtlas() {
  await validateFamilyDirectory(sourceDirectory, MEADOW_FAMILY_TILE_IDS, "meadow");
  await validateFamilyDirectory(forestWaterSourceDirectory, FOREST_WATER_FAMILY_TILE_IDS, "forest/water");
  await mkdir(path.dirname(atlasPath), { recursive: true });

  const composites = [];
  const existingBase = await loadExistingAtlasComposite();
  if (existingBase) composites.push({ ...existingBase, left: 0, top: 0 });

  composites.push(...await familyComposites(sourceDirectory, MEADOW_FAMILY_TILE_IDS));
  composites.push(...await familyComposites(forestWaterSourceDirectory, FOREST_WATER_FAMILY_TILE_IDS));

  await sharp({
    create: {
      width: ATLAS_COLUMNS * FRAME_SIZE,
      height: ATLAS_ROWS * FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(atlasPath);

  console.log(`Built Rewild terrain atlas: packed ${MEADOW_FAMILY_TILE_IDS.length} meadow tiles and ${FOREST_WATER_FAMILY_TILE_IDS.length} forest/water tiles into ${path.relative(root, atlasPath)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRewildTerrainAtlas();
}
