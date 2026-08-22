import assert from "node:assert/strict";
import sharp from "sharp";

export async function decodeAtlasWithTransparentCorners(atlasPath, alphaMessage) {
  const atlasMeta = await sharp(atlasPath).metadata();
  assert.ok(atlasMeta.hasAlpha, alphaMessage);

  const { data, info } = await sharp(atlasPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cornerOffsets = [
    0,
    info.width - 1,
    (info.height - 1) * info.width,
    info.width * info.height - 1,
  ];
  for (const pixel of cornerOffsets) assert.equal(data[pixel * info.channels + 3], 0, "atlas canvas corners must remain transparent");

  return { atlasMeta, data, info };
}
