import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "rewild", "visual-assets.json");
const overheadConfigPath = path.join(root, "config", "rewild", "overhead-atlas-contract.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const overheadConfig = JSON.parse(await readFile(overheadConfigPath, "utf8"));
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

function visiblePixelsInFrame(data, info, left, top, width, height) {
  let visiblePixels = 0;
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha > 24) visiblePixels += 1;
    }
  }
  return visiblePixels;
}

const failures = [];
const warnings = [];
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

for (const sourceImage of config.productionSourceImages ?? []) {
  try {
    const source = await readFile(path.join(root, sourceImage));
    const info = pngInfo(source);
    assert.ok(info.width > 0 && info.height > 0, `${sourceImage}: invalid source dimensions`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

for (const atlas of config.productionAtlases ?? []) {
  try {
    assert.ok(runtimeSet.has(atlas.image), `${atlas.image}: production atlas is not a runtime asset`);
    const imagePath = path.join(sourceDirectory, atlas.image);
    const metadataPath = path.join(sourceDirectory, atlas.metadata);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    assert.equal(metadata.image, path.basename(atlas.image), `${atlas.metadata}: image name mismatch`);
    assert.equal(metadata.grid.columns, atlas.columns, `${atlas.metadata}: column count mismatch`);
    assert.equal(metadata.grid.rows, atlas.rows, `${atlas.metadata}: row count mismatch`);
    assert.equal(metadata.frames.length, atlas.expectedFrames, `${atlas.metadata}: frame count mismatch`);
    assert.equal(new Set(metadata.frames.map((frame) => frame.name)).size, atlas.expectedFrames, `${atlas.metadata}: frame names must be unique`);

    const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const corners = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1];
    for (const pixel of corners) assert.equal(data[pixel * info.channels + 3], 0, `${atlas.image}: canvas corners must be transparent`);
    let visiblePixels = 0;
    let magentaPixels = 0;
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const [red, green, blue, alpha] = data.subarray(offset, offset + 4);
      if (alpha > 8) {
        visiblePixels += 1;
        if (red > 220 && green < 90 && blue > 220) magentaPixels += 1;
      }
    }
    const coverage = visiblePixels / (info.width * info.height);
    assert.ok(coverage > 0.03 && coverage < 0.8, `${atlas.image}: implausible visible-pixel coverage`);
    assert.equal(magentaPixels, 0, `${atlas.image}: chroma-key pixels remain visible`);

    for (const frame of metadata.frames) {
      assert.ok(frame.frame.x >= 0 && frame.frame.y >= 0, `${atlas.metadata}: ${frame.name} starts outside the atlas`);
      assert.ok(frame.frame.x + frame.frame.width <= info.width, `${atlas.metadata}: ${frame.name} exceeds atlas width`);
      assert.ok(frame.frame.y + frame.frame.height <= info.height, `${atlas.metadata}: ${frame.name} exceeds atlas height`);
      assert.ok(frame.pivot.x >= 0 && frame.pivot.x <= 1 && frame.pivot.y >= 0 && frame.pivot.y <= 1, `${atlas.metadata}: ${frame.name} pivot is invalid`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

for (const atlas of overheadConfig.atlases ?? []) {
  try {
    const imagePath = path.join(root, atlas.image);
    const source = await readFile(imagePath);
    const header = pngInfo(source);
    const expectedWidth = atlas.columns * atlas.frameSize;
    const expectedHeight = atlas.rows * atlas.frameSize;
    assert.equal(header.width, expectedWidth, `${atlas.image}: width must be ${expectedWidth}px for ${atlas.columns} × ${atlas.frameSize}px frames`);
    assert.equal(header.height, expectedHeight, `${atlas.image}: height must be ${expectedHeight}px for ${atlas.rows} × ${atlas.frameSize}px frames`);
    assert.equal(atlas.frames.length, atlas.columns * atlas.rows, `${atlas.id}: frame contract must fill the complete atlas grid`);
    assert.equal(new Set(atlas.frames.map((frame) => frame.name)).size, atlas.frames.length, `${atlas.id}: frame names must be unique`);

    const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let index = 0; index < atlas.frames.length; index += 1) {
      const frame = atlas.frames[index];
      const left = (index % atlas.columns) * atlas.frameSize;
      const top = Math.floor(index / atlas.columns) * atlas.frameSize;
      const visiblePixels = visiblePixelsInFrame(data, info, left, top, atlas.frameSize, atlas.frameSize);
      if (visiblePixels >= overheadConfig.frameVisibilityThreshold) continue;

      if (atlas.emptyFramePolicy === "allow-declared-runtime-fallback" && frame.fallback) {
        warnings.push(`${atlas.id}:${frame.name}: only ${visiblePixels} visible pixels; runtime fallback ${frame.fallback} is currently required`);
        continue;
      }
      failures.push(`${atlas.id}:${frame.name}: only ${visiblePixels} visible pixels; authored runtime frame is effectively empty`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

for (const artifact of config.reviewArtifacts ?? []) {
  try {
    const artifactStat = await stat(path.join(root, artifact));
    assert.ok(artifactStat.size > 1000, `${artifact}: review artifact is unexpectedly small`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

const duplicateAssets = config.runtimeAssets.filter((asset, index) => config.runtimeAssets.indexOf(asset) !== index);
for (const duplicate of new Set(duplicateAssets)) failures.push(`${duplicate}: duplicated runtime asset`);

if (warnings.length) {
  console.warn("Rewild overhead atlas compatibility warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
  console.error("Rewild visual asset validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  console.log(`Rewild visual assets validated: ${rows.length} runtime PNGs, ${config.references.length} references, ${config.productionAtlases?.length ?? 0} production atlases, ${overheadConfig.atlases?.length ?? 0} active overhead atlases, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB.`);
  for (const family of Object.keys(config.assetFamilies)) console.log(`- ${family}: ${config.assetFamilies[family].length}`);
}
