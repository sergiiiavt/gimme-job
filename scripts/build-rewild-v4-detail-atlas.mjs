import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { packRewildV4Atlas } from "./rewild-v4-atlas-pack.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "source");
const outputDirectory = path.join(root, "public", "rewild", "v4");
const sourceOutputDirectory = path.join(outputDirectory, "source");
const atlasPath = path.join(outputDirectory, "environment-details-atlas-v4.png");
const metadataPath = path.join(outputDirectory, "environment-details-atlas-v4.json");

const SLOT_SIZE = 128;
const COLUMNS = 6;
const ROWS = 4;

export const DETAIL_ORDER = [
  "detail-grass-tuft-a",
  "detail-grass-tuft-b",
  "detail-grass-tuft-c",
  "detail-wild-weeds",
  "detail-flower-yellow",
  "detail-flower-purple",
  "detail-mushrooms",
  "detail-pebbles",
  "detail-rock-small-a",
  "detail-rock-small-b",
  "detail-rock-medium-a",
  "detail-log-a",
  "detail-stump-a",
  "detail-shrub-low-a",
  "detail-reeds-a",
  "detail-lily-pads-a",
  "industrial-cable-segment-a",
  "industrial-junction-box-a",
  "industrial-relay-box-a",
  "industrial-pipe-outlet-a",
  "industrial-vent-small-a",
  "industrial-debris-small-a",
];

function pivotFor(name) {
  if (name === "detail-lily-pads-a" || name === "industrial-cable-segment-a") return { x: 0.5, y: 0.5 };
  return { x: 0.5, y: 0.92 };
}

function categoryFor(name) {
  return name.startsWith("industrial-") ? "industrial-detail" : "nature-detail";
}

const compareAlphabetically = (left, right) => left.localeCompare(right);

async function validateSourceDirectory() {
  const expectedFiles = DETAIL_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), "v4 source directory must contain files only");
  const actualFiles = entries.map((entry) => entry.name).sort(compareAlphabetically);
  assert.deepEqual(actualFiles, expectedFiles, "v4 source directory must contain exactly the approved 22 PNG assets");
}

export async function buildRewildV4DetailAtlas() {
  await validateSourceDirectory();
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(sourceOutputDirectory, { recursive: true });

  const composites = [];
  const frames = [];

  for (let index = 0; index < DETAIL_ORDER.length; index += 1) {
    const name = DETAIL_ORDER[index];
    const fileName = `${name}.png`;
    const buffer = await readFile(path.join(sourceDirectory, fileName));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png", `${fileName}: source must decode as PNG`);
    assert.ok(metadata.hasAlpha, `${fileName}: source must retain transparency`);
    assert.ok(metadata.width && metadata.height, `${fileName}: source dimensions are missing`);
    assert.ok(metadata.width <= SLOT_SIZE && metadata.height <= SLOT_SIZE, `${fileName}: source exceeds ${SLOT_SIZE}px atlas slot`);

    await writeFile(path.join(sourceOutputDirectory, fileName), buffer);

    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const left = column * SLOT_SIZE + Math.floor((SLOT_SIZE - metadata.width) / 2);
    const top = row * SLOT_SIZE + Math.floor((SLOT_SIZE - metadata.height) / 2);
    composites.push({ input: buffer, left, top });

    frames.push({
      name,
      frame: { x: left, y: top, width: metadata.width, height: metadata.height },
      pivot: pivotFor(name),
      footprint: ["0,0"],
      category: categoryFor(name),
      state: "default",
    });
  }

  await packRewildV4Atlas({
    atlasPath,
    metadataPath,
    composites,
    frames,
    columns: COLUMNS,
    rows: ROWS,
    slotSize: SLOT_SIZE,
    source: "assets/rewild/v4/source",
    label: "detail",
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRewildV4DetailAtlas();
}
