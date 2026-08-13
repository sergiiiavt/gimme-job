import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionDirectory = path.join(root, "public", "rewild", "production");
const reviewDirectory = path.join(root, "docs", "rewild", "reviews", "gate-b");
const sourceDirectory = path.join(root, "docs", "rewild", "gate-b-sources");

const sheets = [
  {
    id: "datacenter-modules-v1",
    source: "datacenter-modules-v1-alpha-master.png",
    columns: 4,
    rows: 4,
    pivot: { x: 0.5, y: 0.9 },
    frames: [
      "server-hall-body", "server-hall-roof", "wall-straight", "wall-corner",
      "cooling-fan-bank", "transformer-power", "loading-bay", "access-door",
      "fence-straight", "fence-corner", "security-gate", "concrete-barriers",
      "cable-entry-cabinet", "polluted-drain-outlet", "utility-crates", "damaged-wall-rubble",
    ],
  },
  {
    id: "facility-ground-states-v1",
    source: "facility-ground-states-v1-alpha-master.png",
    columns: 4,
    rows: 3,
    pivot: { x: 0.5, y: 0.5 },
    frames: [
      "survey-stakes", "excavation", "compacted-substrate", "concrete-footings",
      "concrete-apron", "active-cable-trench", "healthy-stressed-transition", "stressed-exposed-transition",
      "exposed-cracked-transition", "cracked-sludge-transition", "damaged-slab-sludge", "early-reclamation",
    ],
  },
  {
    id: "world-connections-v1",
    source: "world-connections-v1-alpha-master.png",
    columns: 6,
    rows: 4,
    pivot: { x: 0.5, y: 0.5 },
    frames: [
      "cable-straight", "cable-diagonal", "cable-bend", "cable-reverse-bend", "cable-split", "cable-junction",
      "cable-ground-entry", "cable-broken", "drain-clean", "drain-polluting", "road-cable-crossing", "road-utility-trench",
      "road-crack", "road-crack-branched", "asphalt-broken-edge", "rubble-seam", "concrete-damaged-seam", "rebar-seam",
      "roots-straight", "roots-bend", "roots-reclaiming", "roots-severed", "shoreline-inlet", "shoreline-polluted-outlet",
    ],
  },
];

await mkdir(productionDirectory, { recursive: true });
await mkdir(reviewDirectory, { recursive: true });

function boundaries(length, count) {
  return Array.from({ length: count + 1 }, (_, index) => Math.round((index * length) / count));
}

function checkerSvg(width, height, size = 16) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><pattern id="checker" width="${size * 2}" height="${size * 2}" patternUnits="userSpaceOnUse">
      <rect width="${size * 2}" height="${size * 2}" fill="#111719"/>
      <rect width="${size}" height="${size}" fill="#20292b"/>
      <rect x="${size}" y="${size}" width="${size}" height="${size}" fill="#20292b"/>
    </pattern></defs><rect width="100%" height="100%" fill="url(#checker)"/></svg>`);
}

function titleSvg(width, title) {
  const safeTitle = title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="38">
    <rect width="100%" height="100%" fill="#0b1113"/>
    <text x="14" y="25" fill="#e6eddf" font-family="Arial, sans-serif" font-size="18" font-weight="700">${safeTitle}</text>
  </svg>`);
}

const builtSheets = new Map();

for (const sheet of sheets) {
  const sourcePath = path.join(sourceDirectory, sheet.source);
  const sourceInfo = await sharp(sourcePath).metadata();
  const width = Math.round(sourceInfo.width * 0.5);
  const height = Math.round(sourceInfo.height * 0.5);
  const outputPath = path.join(productionDirectory, `${sheet.id}.png`);
  await sharp(sourcePath)
    .resize(width, height, { kernel: sharp.kernel.nearest })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath);

  const xBoundaries = boundaries(width, sheet.columns);
  const yBoundaries = boundaries(height, sheet.rows);
  const frames = sheet.frames.map((name, index) => {
    const column = index % sheet.columns;
    const row = Math.floor(index / sheet.columns);
    return {
      name,
      frame: {
        x: xBoundaries[column],
        y: yBoundaries[row],
        width: xBoundaries[column + 1] - xBoundaries[column],
        height: yBoundaries[row + 1] - yBoundaries[row],
      },
      pivot: sheet.pivot,
    };
  });
  const metadata = {
    schemaVersion: 1,
    image: `${sheet.id}.png`,
    sourceMaster: `docs/rewild/gate-b-sources/${sheet.source}`,
    scaleFromMaster: 0.5,
    size: { width, height },
    grid: { columns: sheet.columns, rows: sheet.rows },
    frames,
  };
  await writeFile(path.join(productionDirectory, `${sheet.id}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
  builtSheets.set(sheet.id, { ...sheet, width, height, outputPath, frames });
}

async function makePanel(sheet, width, height) {
  const atlas = await sharp(sheet.outputPath).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: "#0b1113" } })
    .composite([
      { input: titleSvg(width, sheet.id), left: 0, top: 0 },
      { input: checkerSvg(sheet.width + 24, sheet.height + 24), left: 12, top: 48 },
      { input: atlas, left: 24, top: 60 },
    ])
    .png()
    .toBuffer();
}

async function makeMasterPanel(sheet, width, height) {
  const sourcePath = path.join(sourceDirectory, sheet.source);
  const sourceInfo = await sharp(sourcePath).metadata();
  const source = await sharp(sourcePath).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: "#0b1113" } })
    .composite([
      { input: titleSvg(width, `${sheet.id} — alpha master`), left: 0, top: 0 },
      { input: checkerSvg(sourceInfo.width + 24, sourceInfo.height + 24), left: 12, top: 48 },
      { input: source, left: 24, top: 60 },
    ])
    .png()
    .toBuffer();
}

const modules = builtSheets.get("datacenter-modules-v1");
const ground = builtSheets.get("facility-ground-states-v1");
const connections = builtSheets.get("world-connections-v1");

const modulePanel = await makePanel(modules, modules.width + 48, modules.height + 84);
const groundPanel = await makePanel(ground, ground.width + 48, ground.height + 84);
const connectionPanel = await makePanel(connections, connections.width + 48, connections.height + 84);
const moduleMasterPanel = await makeMasterPanel(modules, 1302, 1338);
const groundMasterPanel = await makeMasterPanel(ground, 1584, 1108);
const connectionMasterPanel = await makeMasterPanel(connections, 1720, 1025);

await sharp({ create: { width: 4686, height: 1378, channels: 4, background: "#070c0e" } })
  .composite([
    { input: moduleMasterPanel, left: 20, top: 20 },
    { input: groundMasterPanel, left: 1342, top: 20 },
    { input: connectionMasterPanel, left: 2946, top: 20 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(reviewDirectory, "native-contact-sheet.png"));

await sharp({ create: { width: 1580, height: 1230, channels: 4, background: "#070c0e" } })
  .composite([
    { input: modulePanel, left: 20, top: 20 },
    { input: groundPanel, left: 715, top: 20 },
    { input: connectionPanel, left: 680, top: 650 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(reviewDirectory, "gameplay-contact-sheet.png"));

async function frameBuffer(sheet, index, scale = 1) {
  const frame = sheet.frames[index].frame;
  let pipeline = sharp(sheet.outputPath).extract({ left: frame.x, top: frame.y, width: frame.width, height: frame.height });
  if (scale !== 1) pipeline = pipeline.resize(Math.round(frame.width * scale), Math.round(frame.height * scale), { kernel: sharp.kernel.nearest });
  return pipeline.png().toBuffer();
}

const meadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
  <defs><pattern id="grass" width="32" height="32" patternUnits="userSpaceOnUse">
    <rect width="32" height="32" fill="#628d3b"/><path d="M5 25h2v-4h2v4M23 11h2V8h2v3" stroke="#355f32" stroke-width="1" fill="none"/>
    <rect x="14" y="17" width="2" height="2" fill="#85a94b"/><rect x="29" y="27" width="1" height="1" fill="#294c2b"/>
  </pattern></defs><rect width="1200" height="675" fill="url(#grass)"/>
  <path d="M0 525 C240 470 410 545 610 500 S970 445 1200 510 L1200 675 L0 675Z" fill="#a27a45" opacity=".88"/>
  <path d="M0 555 C250 500 430 575 620 530 S965 475 1200 540" fill="none" stroke="#755136" stroke-width="10" opacity=".65"/>
</svg>`);

const assemblyParts = [
  { input: await frameBuffer(ground, 6), left: 280, top: 215 },
  { input: await frameBuffer(ground, 7), left: 410, top: 220 },
  { input: await frameBuffer(ground, 8), left: 540, top: 220 },
  { input: await frameBuffer(ground, 9), left: 670, top: 225 },
  { input: await frameBuffer(ground, 10), left: 820, top: 330 },
  { input: await frameBuffer(ground, 4), left: 680, top: 115 },
  { input: await frameBuffer(ground, 3), left: 840, top: 110 },
  { input: await frameBuffer(modules, 2), left: 670, top: 120 },
  { input: await frameBuffer(modules, 3), left: 808, top: 110 },
  { input: await frameBuffer(modules, 0), left: 740, top: 165 },
  { input: await frameBuffer(modules, 4), left: 865, top: 180 },
  { input: await frameBuffer(modules, 5), left: 930, top: 245 },
  { input: await frameBuffer(modules, 6), left: 650, top: 260 },
  { input: await frameBuffer(modules, 7), left: 790, top: 270 },
  { input: await frameBuffer(connections, 4), left: 885, top: 350 },
  { input: await frameBuffer(connections, 1), left: 970, top: 420 },
  { input: await frameBuffer(connections, 9), left: 810, top: 435 },
  { input: await frameBuffer(connections, 23), left: 855, top: 485 },
  { input: await frameBuffer(connections, 20), left: 470, top: 430 },
  { input: await frameBuffer(connections, 18), left: 340, top: 430 },
  { input: await frameBuffer(modules, 14), left: 585, top: 360 },
  { input: await frameBuffer(modules, 15), left: 990, top: 280 },
];

await sharp(meadow)
  .composite(assemblyParts)
  .png({ compressionLevel: 9 })
  .toFile(path.join(reviewDirectory, "assembly-proof.png"));

console.log(`Built ${sheets.length} Gate B atlases, metadata files, and review images.`);
