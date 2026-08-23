import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "ground-source");
const outputDirectory = path.join(root, "public", "rewild", "v4");
const sourceOutputDirectory = path.join(outputDirectory, "ground-source");
const atlasPath = path.join(outputDirectory, "ground-atlas-v4.png");
const metadataPath = path.join(outputDirectory, "ground-atlas-v4.json");

// Single variant: the user supplied one exact tile image (rotated 90° from its original
// pointy-top orientation to the game's flat-top orientation — a lossless pixel transform for a
// regular hexagon) and asked for that exact art, not a generated approximation. More variants can
// be appended here later without any other wiring change.
export const GROUND_ORDER = ["grass-a"];

// Native size: width = 2 * 32 (exact), height = round(sqrt(3) * 32), matching the runtime's
// flat-top hex aspect ratio (app/rewild-hex-grid.ts) at a 32px hex "size" so DRAW_SCALE =
// HEX_SIZE / 32 maps it onto the real hex footprint with no distortion.
const TILE_WIDTH = 64;
const TILE_HEIGHT = 56;

const compareAlphabetically = (left, right) => left.localeCompare(right);

async function validateSourceDirectory() {
  const expectedFiles = GROUND_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), "v4 ground source directory must contain files only");
  const actualFiles = entries.map((entry) => entry.name).sort(compareAlphabetically);
  assert.deepEqual(actualFiles, expectedFiles, `v4 ground source directory must contain exactly the approved ${GROUND_ORDER.length} PNG asset(s)`);
}

// Packed as a horizontal strip (matching structures) rather than the shared square-slot packer:
// these tiles are natively non-square (64x56, the real flat-top hex aspect ratio), which the
// square-slot helper doesn't support.
export async function buildRewildV4GroundAtlas() {
  await validateSourceDirectory();
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(sourceOutputDirectory, { recursive: true });

  const composites = [];
  const frames = [];
  let cursorX = 0;

  for (const name of GROUND_ORDER) {
    const fileName = `${name}.png`;
    const buffer = await readFile(path.join(sourceDirectory, fileName));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png", `${fileName}: source must decode as PNG`);
    assert.ok(metadata.hasAlpha, `${fileName}: source must retain transparency`);
    assert.equal(metadata.width, TILE_WIDTH, `${fileName}: source width must be exactly ${TILE_WIDTH}px`);
    assert.equal(metadata.height, TILE_HEIGHT, `${fileName}: source height must be exactly ${TILE_HEIGHT}px`);

    await writeFile(path.join(sourceOutputDirectory, fileName), buffer);

    const left = cursorX;
    composites.push({ input: buffer, left, top: 0 });
    cursorX += TILE_WIDTH;

    frames.push({
      name,
      frame: { x: left, y: 0, width: TILE_WIDTH, height: TILE_HEIGHT },
      pivot: { x: 0.5, y: 0.5 },
      footprint: ["0,0"],
      category: "ground-tile",
      state: "default",
    });
  }

  const atlasWidth = cursorX;

  await sharp({
    create: { width: atlasWidth, height: TILE_HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(atlasPath);

  const metadata = {
    schemaVersion: 1,
    image: path.basename(atlasPath),
    source: "assets/rewild/v4/ground-source",
    packing: "horizontal-strip",
    frames,
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`Built Rewild v4 ground atlas: ${frames.length} exact frames, ${atlasWidth}x${TILE_HEIGHT}px horizontal strip.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRewildV4GroundAtlas();
}
