import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "rewild", "v4", "source-b64");
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

const BUNDLES = ["nature-a.json", "nature-b.json", "industrial.json"];

function pivotFor(name) {
  if (name === "detail-lily-pads-a" || name === "industrial-cable-segment-a") return { x: 0.5, y: 0.5 };
  return { x: 0.5, y: 0.92 };
}

function categoryFor(name) {
  return name.startsWith("industrial-") ? "industrial-detail" : "nature-detail";
}

async function readSources() {
  const sources = {};
  for (const bundle of BUNDLES) {
    const payload = JSON.parse(await readFile(path.join(sourceDirectory, bundle), "utf8"));
    for (const [fileName, encoded] of Object.entries(payload)) {
      assert.ok(!(fileName in sources), `${fileName}: duplicated across v4 source bundles`);
      sources[fileName] = encoded;
    }
  }

  const expected = new Set(DETAIL_ORDER.map((name) => `${name}.png`));
  assert.equal(Object.keys(sources).length, expected.size, "v4 source bundle count must match the exact detail manifest");
  for (const fileName of Object.keys(sources)) assert.ok(expected.has(fileName), `${fileName}: unexpected/hallucinated v4 detail source`);
  for (const fileName of expected) assert.ok(fileName in sources, `${fileName}: missing v4 detail source`);
  return sources;
}

export async function buildRewildV4DetailAtlas() {
  const sources = await readSources();
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(sourceOutputDirectory, { recursive: true });

  const composites = [];
  const frames = [];

  for (let index = 0; index < DETAIL_ORDER.length; index += 1) {
    const name = DETAIL_ORDER[index];
    const fileName = `${name}.png`;
    const buffer = Buffer.from(sources[fileName], "base64");
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

  const metadata = {
    schemaVersion: 1,
    image: path.basename(atlasPath),
    source: "assets/rewild/v4/source-b64",
    grid: { columns: COLUMNS, rows: ROWS, slotSize: SLOT_SIZE },
    frames,
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`Built Rewild v4 detail atlas: ${frames.length} exact frames, ${COLUMNS}x${ROWS} slots.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRewildV4DetailAtlas();
}
