export const REWILD_STRUCTURE_V4_IDS = [
  "house",
  "house-damaged",
  "datacenter",
  "mainframe",
] as const;

export type RewildStructureV4Id = (typeof REWILD_STRUCTURE_V4_IDS)[number];

interface RewildStructureV4Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RewildStructureDrawOptions {
  scale?: number;
  alpha?: number;
  flipX?: boolean;
  rotation?: number;
}

const STRUCTURE_ATLAS_URL = "/rewild/v4/structures-atlas-v4.png";

export const REWILD_STRUCTURE_V4_FRAMES: Record<RewildStructureV4Id, RewildStructureV4Frame> = {
  "house": { x: 0, y: 0, width: 80, height: 80 },
  "house-damaged": { x: 80, y: 0, width: 80, height: 80 },
  "datacenter": { x: 160, y: 0, width: 80, height: 80 },
  "mainframe": { x: 240, y: 0, width: 128, height: 128 },
};

let structureImage: HTMLImageElement | null = null;
let structureReady: Promise<HTMLImageElement> | null = null;

function preload() {
  if (typeof Image === "undefined") return Promise.resolve<HTMLImageElement | null>(null);
  if (structureImage?.complete && structureImage.naturalWidth > 0) return Promise.resolve(structureImage);
  structureReady ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = structureImage ?? new Image();
    image.onload = () => { structureImage = image; resolve(image); };
    image.onerror = () => reject(new Error(`Failed to load Rewild v4 structures atlas: ${STRUCTURE_ATLAS_URL}`));
    if (!structureImage) {
      structureImage = image;
      image.src = STRUCTURE_ATLAS_URL;
    }
  });
  return structureReady;
}

export function preloadRewildStructureV4() {
  return preload().then(() => undefined);
}

export function drawRewildStructureV4Sprite(
  ctx: CanvasRenderingContext2D,
  id: RewildStructureV4Id,
  x: number,
  y: number,
  options: RewildStructureDrawOptions = {},
) {
  if (typeof Image !== "undefined" && !structureReady) void preload();
  if (!structureImage?.complete || structureImage.naturalWidth <= 0) return false;
  const frame = REWILD_STRUCTURE_V4_FRAMES[id];
  const scale = options.scale ?? 1;
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  if (options.rotation) ctx.rotate(options.rotation);
  if (options.flipX) ctx.scale(-1, 1);
  ctx.drawImage(
    structureImage,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -Math.round(width / 2),
    -Math.round(height / 2),
    width,
    height,
  );
  ctx.restore();
  return true;
}
