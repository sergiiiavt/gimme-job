import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "structures-source");
const outputDirectory = path.join(root, "public", "rewild", "v4");
const sourceOutputDirectory = path.join(outputDirectory, "structures-source");
const atlasPath = path.join(outputDirectory, "structures-atlas-v4.png");
const metadataPath = path.join(outputDirectory, "structures-atlas-v4.json");

export const STRUCTURE_ORDER = ["house", "house-damaged", "datacenter", "mainframe"];

// House is the code-authoritative HOUSE_FOOTPRINT (app/rewild-world.ts) relative to HOUSE_CENTER.
// Datacenter/mainframe are hexDisk(anchor, radius) per createFacilityFootprint in the same file
// (radius 1 for a regular datacenter, radius 2 for the boss mainframe) — described parametrically
// rather than as an enumerated cell list so this stays correct if hexDisk's shape ever changes.
const STRUCTURE_FOOTPRINTS = {
  house: { cells: ["0,0", "-1,0", "0,1"] },
  "house-damaged": { cells: ["0,0", "-1,0", "0,1"] },
  datacenter: { radius: 1 },
  mainframe: { radius: 2 },
};

const compareAlphabetically = (left, right) => left.localeCompare(right);

async function validateSourceDirectory() {
  const expectedFiles = STRUCTURE_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), "v4 structures source directory must contain files only");
  const actualFiles = entries.map((entry) => entry.name).sort(compareAlphabetically);
  assert.deepEqual(actualFiles, expectedFiles, "v4 structures source directory must contain exactly the approved 4 PNG assets");
}

// Structures span very different footprint sizes (house: 3 hexes, mainframe: 19 hexes), so unlike
// the uniform-grid unit/detail atlases, frames are packed as a simple horizontal strip at native
// size rather than into fixed slots via the shared packRewildV4Atlas helper.
export async function buildRewildV4StructuresAtlas() {
  await validateSourceDirectory();
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(sourceOutputDirectory, { recursive: true });

  const composites = [];
  const frames = [];
  let cursorX = 0;
  let atlasHeight = 0;

  for (const name of STRUCTURE_ORDER) {
    const fileName = `${name}.png`;
    const buffer = await readFile(path.join(sourceDirectory, fileName));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png", `${fileName}: source must decode as PNG`);
    assert.ok(metadata.hasAlpha, `${fileName}: source must retain transparency`);

    await writeFile(path.join(sourceOutputDirectory, fileName), buffer);

    const left = cursorX;
    composites.push({ input: buffer, left, top: 0 });
    cursorX += metadata.width;
    atlasHeight = Math.max(atlasHeight, metadata.height);

    frames.push({
      name,
      frame: { x: left, y: 0, width: metadata.width, height: metadata.height },
      pivot: { x: 0.5, y: 0.5 },
      footprint: STRUCTURE_FOOTPRINTS[name],
      category: name.startsWith("house") ? "structure" : "facility",
      state: "default",
    });
  }

  const atlasWidth = cursorX;

  await sharp({
    create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(atlasPath);

  const metadata = {
    schemaVersion: 1,
    image: path.basename(atlasPath),
    source: "assets/rewild/v4/structures-source",
    packing: "horizontal-strip",
    frames,
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`Built Rewild v4 structures atlas: ${frames.length} exact frames, ${atlasWidth}x${atlasHeight}px horizontal strip.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRewildV4StructuresAtlas();
}
