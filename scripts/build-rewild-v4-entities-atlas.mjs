import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { packRewildV4Atlas } from "./rewild-v4-atlas-pack.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "entities-source");
const outputDirectory = path.join(root, "public", "rewild", "v4");
const sourceOutputDirectory = path.join(outputDirectory, "entities-source");
const atlasPath = path.join(outputDirectory, "entities-atlas-v4.png");
const metadataPath = path.join(outputDirectory, "entities-atlas-v4.json");

const SLOT_SIZE = 32;
const COLUMNS = 5;
const ROWS = 2;

export const ENTITY_ORDER = [
  "plant-sunbloom",
  "plant-thornbramble",
  "plant-sporecap",
  "plant-vinewhip",
  "plant-rootreclaimer",
  "plant-elderoak",
  "plant-elderoak-mature",
  "enemy-clickbait",
  "enemy-deepfake",
  "enemy-fragment",
];

function categoryFor(name) {
  return name.startsWith("enemy-") ? "enemy-unit" : "plant-unit";
}

const compareAlphabetically = (left, right) => left.localeCompare(right);

async function validateSourceDirectory() {
  const expectedFiles = ENTITY_ORDER.map((name) => `${name}.png`).sort(compareAlphabetically);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), "v4 entities source directory must contain files only");
  const actualFiles = entries.map((entry) => entry.name).sort(compareAlphabetically);
  assert.deepEqual(actualFiles, expectedFiles, "v4 entities source directory must contain exactly the approved 10 PNG assets");
}

export async function buildRewildV4EntitiesAtlas() {
  await validateSourceDirectory();
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(sourceOutputDirectory, { recursive: true });

  const composites = [];
  const frames = [];

  for (let index = 0; index < ENTITY_ORDER.length; index += 1) {
    const name = ENTITY_ORDER[index];
    const fileName = `${name}.png`;
    const buffer = await readFile(path.join(sourceDirectory, fileName));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "png", `${fileName}: source must decode as PNG`);
    assert.ok(metadata.hasAlpha, `${fileName}: source must retain transparency`);
    assert.equal(metadata.width, SLOT_SIZE, `${fileName}: source width must be exactly ${SLOT_SIZE}px`);
    assert.equal(metadata.height, SLOT_SIZE, `${fileName}: source height must be exactly ${SLOT_SIZE}px`);

    await writeFile(path.join(sourceOutputDirectory, fileName), buffer);

    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const left = column * SLOT_SIZE;
    const top = row * SLOT_SIZE;
    composites.push({ input: buffer, left, top });

    frames.push({
      name,
      frame: { x: left, y: top, width: metadata.width, height: metadata.height },
      pivot: { x: 0.5, y: 0.5 },
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
    source: "assets/rewild/v4/entities-source",
    label: "entities",
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRewildV4EntitiesAtlas();
}
