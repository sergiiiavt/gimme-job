import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function packRewildV4Atlas({ atlasPath, metadataPath, composites, frames, columns, rows, slotSize, source, label }) {
  await sharp({
    create: {
      width: columns * slotSize,
      height: rows * slotSize,
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
    source,
    grid: { columns, rows, slotSize },
    frames,
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`Built Rewild v4 ${label} atlas: ${frames.length} exact frames, ${columns}x${rows} slots.`);
}
