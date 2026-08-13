import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "docs", "rewild", "expansion-1-sources");
const productionDirectory = path.join(root, "public", "rewild", "production");
const reviewDirectory = path.join(root, "docs", "rewild", "reviews", "expansion-1");

const sheets = [
  {
    id: "tree-response-states-v1",
    source: "tree-response-states-v1-alpha-master.png",
    columns: 5,
    rows: 2,
    pivot: { x: .5, y: .93 },
    frames: [
      "deciduous-healthy", "deciduous-stressed", "deciduous-corrupted", "deciduous-dead", "deciduous-recovering",
      "pine-healthy", "pine-stressed", "pine-corrupted", "pine-dead", "pine-recovering",
    ],
  },
  {
    id: "pond-response-states-v1",
    source: "pond-response-states-v1-alpha-master.png",
    columns: 4,
    rows: 2,
    pivot: { x: .5, y: .72 },
    frames: [
      "pond-wide-clean", "pond-wide-contaminated", "pond-wide-polluted", "pond-wide-recovering",
      "pond-compact-clean", "pond-compact-contaminated", "pond-compact-polluted", "pond-compact-recovering",
    ],
  },
];

await mkdir(productionDirectory, { recursive: true });
await mkdir(reviewDirectory, { recursive: true });

function boundaries(length, count) {
  return Array.from({ length: count + 1 }, (_, index) => Math.round(index * length / count));
}

function checkerSvg(width, height, size = 14) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="c" width="${size * 2}" height="${size * 2}" patternUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="#101719"/><rect width="${size}" height="${size}" fill="#202a2c"/><rect x="${size}" y="${size}" width="${size}" height="${size}" fill="#202a2c"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);
}

function labelSvg(width, text, subtitle = "") {
  const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const parts = text.split("-");
  const state = parts.pop();
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="46"><rect width="100%" height="100%" fill="#0b1113"/><text x="8" y="15" fill="#91a296" font-family="Arial" font-size="8" font-weight="700">${escape(parts.join(" ").toUpperCase())}</text><text x="8" y="29" fill="#e8efdf" font-family="Arial" font-size="11" font-weight="700">${escape(state)}</text><text x="8" y="41" fill="#708079" font-family="Arial" font-size="7">${escape(subtitle)}</text></svg>`);
}

function keepPrimaryComponent(data, info, bounds) {
  const { width, channels } = info;
  const visited = new Uint8Array(bounds.width * bounds.height);
  const components = [];
  const localIndex = (x, y) => (y - bounds.top) * bounds.width + (x - bounds.left);
  for (let y = bounds.top; y < bounds.top + bounds.height; y += 1) for (let x = bounds.left; x < bounds.left + bounds.width; x += 1) {
    const local = localIndex(x, y);
    if (visited[local] || data[(y * width + x) * channels + 3] <= 8) continue;
    const component = [];
    const queue = [[x, y]];
    visited[local] = 1;
    while (queue.length) {
      const [currentX, currentY] = queue.pop();
      component.push((currentY * width + currentX) * channels);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (!offsetX && !offsetY) continue;
        const nextX = currentX + offsetX;
        const nextY = currentY + offsetY;
        if (nextX < bounds.left || nextX >= bounds.left + bounds.width || nextY < bounds.top || nextY >= bounds.top + bounds.height) continue;
        const nextLocal = localIndex(nextX, nextY);
        if (visited[nextLocal] || data[(nextY * width + nextX) * channels + 3] <= 8) continue;
        visited[nextLocal] = 1;
        queue.push([nextX, nextY]);
      }
    }
    components.push(component);
  }
  components.sort((left, right) => right.length - left.length);
  const keep = new Set(components[0] ?? []);
  for (const component of components.slice(1)) for (const offset of component) {
    if (keep.has(offset)) continue;
    data[offset] = 0; data[offset + 1] = 0; data[offset + 2] = 0; data[offset + 3] = 0;
  }
}

const built = [];
for (const sheet of sheets) {
  const sourcePath = path.join(sourceDirectory, sheet.source);
  const sourceInfo = await sharp(sourcePath).metadata();
  const width = Math.round(sourceInfo.width * .5);
  const height = Math.round(sourceInfo.height * .5);
  const xs = boundaries(width, sheet.columns);
  const ys = boundaries(height, sheet.rows);
  const frames = sheet.frames.map((name, index) => {
    const column = index % sheet.columns;
    const row = Math.floor(index / sheet.columns);
    return { name, frame: { x: xs[column], y: ys[row], width: xs[column + 1] - xs[column], height: ys[row + 1] - ys[row] }, pivot: sheet.pivot };
  });
  const outputPath = path.join(productionDirectory, `${sheet.id}.png`);
  const resized = await sharp(sourcePath).resize(width, height, { kernel: sharp.kernel.nearest }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const frame of frames) keepPrimaryComponent(resized.data, resized.info, { left: frame.frame.x, top: frame.frame.y, width: frame.frame.width, height: frame.frame.height });
  await sharp(resized.data, { raw: resized.info }).png({ compressionLevel: 9, palette: false }).toFile(outputPath);
  const metadata = {
    schemaVersion: 1,
    image: `${sheet.id}.png`,
    sourceMaster: `docs/rewild/expansion-1-sources/${sheet.source}`,
    scaleFromMaster: .5,
    size: { width, height },
    grid: { columns: sheet.columns, rows: sheet.rows },
    frames,
  };
  await writeFile(path.join(productionDirectory, `${sheet.id}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
  built.push({ ...sheet, width, height, outputPath, frames });
}

async function contactSheet(sheet) {
  const scale = sheet.id.startsWith("tree") ? .72 : .88;
  const frameWidth = Math.round(sheet.frames[0].frame.width * scale);
  const frameHeight = Math.round(sheet.frames[0].frame.height * scale);
  const gap = 12;
  const panelWidth = sheet.columns * (frameWidth + gap) + gap;
  const panelHeight = sheet.rows * (frameHeight + 58) + gap;
  const layers = [{ input: checkerSvg(panelWidth, panelHeight), left: 0, top: 0 }];
  for (let index = 0; index < sheet.frames.length; index += 1) {
    const frame = sheet.frames[index];
    const column = index % sheet.columns;
    const row = Math.floor(index / sheet.columns);
    const left = gap + column * (frameWidth + gap);
    const top = gap + row * (frameHeight + 58);
    const sprite = await sharp(sheet.outputPath).extract({ left: frame.frame.x, top: frame.frame.y, width: frame.frame.width, height: frame.frame.height }).resize(frameWidth, frameHeight, { kernel: sharp.kernel.nearest }).png().toBuffer();
    layers.push({ input: sprite, left, top });
    layers.push({ input: labelSvg(frameWidth, frame.name, `${frame.frame.width} × ${frame.frame.height} runtime cell`), left, top: top + frameHeight });
  }
  const output = path.join(reviewDirectory, `${sheet.id}-contact-sheet.png`);
  await sharp({ create: { width: panelWidth, height: panelHeight, channels: 4, background: "#0b1113" } }).composite(layers).png({ compressionLevel: 9 }).toFile(output);
  return output;
}

const contacts = [];
for (const sheet of built) contacts.push(await contactSheet(sheet));
const contactInfo = await Promise.all(contacts.map(async (file) => ({ file, ...(await sharp(file).metadata()) })));
const combinedWidth = Math.max(...contactInfo.map((info) => info.width));
const combinedHeight = contactInfo.reduce((sum, info) => sum + info.height, 0) + 20 * (contactInfo.length + 1);
let top = 20;
const combinedLayers = [];
for (const info of contactInfo) {
  combinedLayers.push({ input: info.file, left: Math.round((combinedWidth - info.width) / 2), top });
  top += info.height + 20;
}
await sharp({ create: { width: combinedWidth, height: combinedHeight, channels: 4, background: "#070c0e" } }).composite(combinedLayers).png({ compressionLevel: 9 }).toFile(path.join(reviewDirectory, "all-environment-states.png"));

console.log(`Built ${built.length} environment-response atlases and ${contacts.length + 1} review contact sheets.`);
