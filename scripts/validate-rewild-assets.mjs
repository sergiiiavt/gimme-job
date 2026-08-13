import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "rewild", "visual-assets.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const sourceDirectory = path.join(root, config.sourceDirectory);

function pngInfo(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", "file is not a PNG");
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", "PNG has no IHDR header");
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  return { width, height, bitDepth, colorType, hasAlpha: colorType === 4 || colorType === 6 };
}

const failures = [];
const rows = [];
const runtimeSet = new Set(config.runtimeAssets);
const familyAssets = new Set(Object.values(config.assetFamilies).flat());

for (const asset of config.runtimeAssets) {
  try {
    assert.equal(path.extname(asset).toLowerCase(), config.constraints.extension, `${asset}: wrong extension`);
    const absolutePath = path.join(sourceDirectory, asset);
    const file = await readFile(absolutePath);
    const info = pngInfo(file);
    assert.ok(info.width > 0 && info.height > 0, `${asset}: invalid dimensions`);
    assert.ok(info.width <= config.constraints.maximumSourceEdge && info.height <= config.constraints.maximumSourceEdge, `${asset}: source edge exceeds ${config.constraints.maximumSourceEdge}px`);
    if (config.constraints.runtimeRequiresAlpha) assert.ok(info.hasAlpha, `${asset}: runtime object must contain an alpha channel`);
    if (asset.startsWith("decal-")) {
      assert.equal(info.width, config.constraints.microDecalSize.width, `${asset}: decal width must be ${config.constraints.microDecalSize.width}`);
      assert.equal(info.height, config.constraints.microDecalSize.height, `${asset}: decal height must be ${config.constraints.microDecalSize.height}`);
    }
    rows.push({ asset, ...info, bytes: file.byteLength });
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

for (const asset of familyAssets) if (!runtimeSet.has(asset)) failures.push(`${asset}: listed in an asset family but not runtimeAssets`);
for (const asset of runtimeSet) if (!familyAssets.has(asset)) failures.push(`${asset}: missing from assetFamilies`);
for (const forbidden of config.constraints.forbiddenRuntimeAssets) if (runtimeSet.has(forbidden)) failures.push(`${forbidden}: forbidden legacy asset is marked for runtime`);

for (const reference of config.references) {
  try {
    const referenceStat = await stat(path.join(root, reference));
    assert.ok(referenceStat.size > 1000, `${reference}: reference image is unexpectedly small`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

const duplicateAssets = config.runtimeAssets.filter((asset, index) => config.runtimeAssets.indexOf(asset) !== index);
for (const duplicate of new Set(duplicateAssets)) failures.push(`${duplicate}: duplicated runtime asset`);

if (failures.length) {
  console.error("Rewild visual asset validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  console.log(`Rewild visual assets validated: ${rows.length} runtime PNGs, ${config.references.length} references, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB.`);
  for (const family of Object.keys(config.assetFamilies)) console.log(`- ${family}: ${config.assetFamilies[family].length}`);
}
