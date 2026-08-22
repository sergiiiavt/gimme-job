import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { packRewildV4Atlas } from "../scripts/rewild-v4-atlas-pack.mjs";
import { decodeAtlasWithTransparentCorners } from "../scripts/rewild-v4-atlas-validate-pixels.mjs";

async function withTempDir(run) {
  const dir = await mkdtemp(path.join(tmpdir(), "rewild-v4-atlas-pack-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("packRewildV4Atlas writes a transparent-canvas PNG plus matching JSON metadata", async () => {
  await withTempDir(async (dir) => {
    const atlasPath = path.join(dir, "atlas.png");
    const metadataPath = path.join(dir, "atlas.json");
    const redSquare = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } } }).png().toBuffer();
    const blueSquare = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 255 } } }).png().toBuffer();
    const frames = [
      { name: "red", frame: { x: 0, y: 0, width: 4, height: 4 }, pivot: { x: 0.5, y: 0.5 } },
      { name: "blue", frame: { x: 4, y: 0, width: 4, height: 4 }, pivot: { x: 0.5, y: 0.5 } },
    ];

    await packRewildV4Atlas({
      atlasPath,
      metadataPath,
      composites: [{ input: redSquare, left: 0, top: 0 }, { input: blueSquare, left: 4, top: 0 }],
      frames,
      columns: 2,
      rows: 1,
      slotSize: 4,
      source: "fixtures/example",
      label: "unit-test",
    });

    const atlasMeta = await sharp(atlasPath).metadata();
    assert.equal(atlasMeta.width, 8);
    assert.equal(atlasMeta.height, 4);
    assert.ok(atlasMeta.hasAlpha);

    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    assert.deepEqual(metadata, {
      schemaVersion: 1,
      image: "atlas.png",
      source: "fixtures/example",
      grid: { columns: 2, rows: 1, slotSize: 4 },
      frames,
    });
  });
});

test("decodeAtlasWithTransparentCorners accepts an atlas with transparent corners and rejects an atlas with an opaque corner", async () => {
  await withTempDir(async (dir) => {
    const transparentCornersPath = path.join(dir, "transparent-corners.png");
    await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 255 } } }).png().toBuffer(), left: 1, top: 1 }])
      .png()
      .toFile(transparentCornersPath);

    const { atlasMeta, data, info } = await decodeAtlasWithTransparentCorners(transparentCornersPath, "fixture must preserve alpha");
    assert.equal(atlasMeta.width, 4);
    assert.equal(atlasMeta.height, 4);
    assert.equal(info.width, 4);
    assert.equal(info.height, 4);
    assert.equal(data.length, info.width * info.height * info.channels);

    const opaqueCornerPath = path.join(dir, "opaque-corner.png");
    await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 255 } } }).png().toFile(opaqueCornerPath);

    await assert.rejects(() => decodeAtlasWithTransparentCorners(opaqueCornerPath, "fixture must preserve alpha"));
  });
});
