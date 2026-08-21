import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "road-source");
const outputDirectory = path.join(root, "public", "rewild", "v4");
const atlasPath = path.join(outputDirectory, "roads-fences-atlas-v4.png");
const metadataPath = path.join(outputDirectory, "roads-fences-atlas-v4.json");

const SLOT_SIZE = 64;
const COLUMNS = 4;
const ROWS = 4;

export const ROAD_ORDER = [
  "road-dirt-straight",
  "road-dirt-curve-left",
  "road-dirt-curve-right",
  "road-dirt-t-junction",
  "road-dirt-crossroads",
  "road-dirt-narrow-trail",
  "road-dirt-worn-edge-a",
  "road-dirt-worn-edge-b",
  "fence-wood-straight-a",
  "fence-wood-straight-b",
  "fence-wood-corner",
  "fence-wood-gate",
  "fence-wood-broken",
  "barrier-stone-low",
];

const CONNECTORS = {
  "road-dirt-straight": [0, 3],
  "road-dirt-curve-left": [0, 1],
  "road-dirt-curve-right": [0, 5],
  "road-dirt-t-junction": [0, 3, 5],
  "road-dirt-crossroads": [0, 1, 3, 4],
  "road-dirt-narrow-trail": [0, 3],
  "road-dirt-worn-edge-a": [0, 3],
  "road-dirt-worn-edge-b": [0, 3],
  "fence-wood-straight-a": [0, 3],
  "fence-wood-straight-b": [0, 3],
  "fence-wood-corner": [0, 1],
  "fence-wood-gate": [0, 3],
  "fence-wood-broken": [0, 3],
  "barrier-stone-low": [0, 3],
};

const compareAlphabetically = (left, right) => left.localeCompare(right);

async function validateSourceDirectory() {
  const expectedFiles = ROAD_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), "v4 road source directory must contain files only");
  assert.deepEqual(entries.map((entry) => entry.name).sort(compareAlphabetically), expectedFiles, "v4 road source directory must contain exactly the approved 14 PNG assets");
}

export async function buildRewildV4RoadAtlas() {
  await validateSourceDirectory();
  await mkdir(outputDirectory, { recursive: true });
  const composites = [];
  const frames = [];

  for (let index = 0; index < ROAD_ORDER.length; index += 1) {
    const name = ROAD_ORDER[index];
    const fileName = `${name}.png`;
    const buffer = await readFile(path.join(sourceDirectory, fileName));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png", `${fileName}: source must decode as PNG`);
    assert.ok(metadata.hasAlpha, `${fileName}: source must preserve alpha`);
    assert.equal(metadata.width, SLOT_SIZE, `${fileName}: source width must remain ${SLOT_SIZE}px`);
    assert.equal(metadata.height, SLOT_SIZE, `${fileName}: source height must remain ${SLOT_SIZE}px`);

    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const left = column * SLOT_SIZE;
    const top = row * SLOT_SIZE;
    composites.push({ input: buffer, left, top });
    frames.push({
      name,
      frame: { x: left, y: top, width: SLOT_SIZE, height: SLOT_SIZE },
      pivot: { x: 0.5, y: 0.5 },
      footprint: ["0,0"],
      category: name.startsWith("road-") ? "road" : name.startsWith("fence-") ? "fence" : "barrier",
      connectors: CONNECTORS[name],
      state: name.includes("broken") ? "broken" : name.includes("worn") ? "worn" : "default",
    });
  }

  await sharp({
    create: {
      width: COLUMNS * SLOT_SIZE,
      height: ROWS * SLOT_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(atlasPath);

  await writeFile(metadataPath, `${JSON.stringify({
    schemaVersion: 1,
    image: path.basename(atlasPath),
    source: "assets/rewild/v4/road-source",
    geometry: { orientation: "flat-top", directions: 6, rotationStepDegrees: 60 },
    grid: { columns: COLUMNS, rows: ROWS, slotSize: SLOT_SIZE },
    frames,
  }, null, 2)}\n`, "utf8");

  console.log(`Built Rewild v4 road atlas: ${frames.length} exact frames, ${COLUMNS}x${ROWS} slots.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRewildV4RoadAtlas();
}
