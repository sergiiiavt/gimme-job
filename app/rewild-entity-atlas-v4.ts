export const REWILD_ENTITY_V4_IDS = [
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
  "enemy-popup",
] as const;

export type RewildEntityV4Id = (typeof REWILD_ENTITY_V4_IDS)[number];

interface RewildEntityV4Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RewildEntityDrawOptions {
  scale?: number;
  alpha?: number;
  flipX?: boolean;
  rotation?: number;
}

const ENTITY_ATLAS_URL = "/rewild/v4/entities-atlas-v4.png";

// Source sprites are authored at 32px native and are tightly cropped (subject fills the frame,
// no padding). The pre-existing v3 entity atlas assumed 64px native frames with padding around
// the subject, so naively doubling to "match" 64px made v4 sprites overflow their hex (e.g. a
// mature elderoak rendered ~63px wide inside a 42px hex). 1.3 keeps units comfortably inside
// their hex footprint while staying close to the old on-screen scale for every existing caller.
const NATIVE_TO_LEGACY_SCALE = 1.3;

export const REWILD_ENTITY_V4_FRAMES: Record<RewildEntityV4Id, RewildEntityV4Frame> = {
  "plant-sunbloom": { x: 0, y: 0, width: 32, height: 32 },
  "plant-thornbramble": { x: 32, y: 0, width: 32, height: 32 },
  "plant-sporecap": { x: 64, y: 0, width: 32, height: 32 },
  "plant-vinewhip": { x: 96, y: 0, width: 32, height: 32 },
  "plant-rootreclaimer": { x: 128, y: 0, width: 32, height: 32 },
  "plant-elderoak": { x: 0, y: 32, width: 32, height: 32 },
  "plant-elderoak-mature": { x: 32, y: 32, width: 32, height: 32 },
  "enemy-clickbait": { x: 64, y: 32, width: 32, height: 32 },
  "enemy-deepfake": { x: 96, y: 32, width: 32, height: 32 },
  "enemy-fragment": { x: 128, y: 32, width: 32, height: 32 },
  "enemy-popup": { x: 0, y: 64, width: 32, height: 32 },
};

let entityImage: HTMLImageElement | null = null;
let entityReady: Promise<HTMLImageElement> | null = null;

function preload() {
  if (typeof Image === "undefined") return Promise.resolve<HTMLImageElement | null>(null);
  if (entityImage?.complete && entityImage.naturalWidth > 0) return Promise.resolve(entityImage);
  entityReady ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = entityImage ?? new Image();
    image.onload = () => { entityImage = image; resolve(image); };
    image.onerror = () => reject(new Error(`Failed to load Rewild v4 entities atlas: ${ENTITY_ATLAS_URL}`));
    if (!entityImage) {
      entityImage = image;
      image.src = ENTITY_ATLAS_URL;
    }
  });
  return entityReady;
}

export function preloadRewildEntityV4() {
  return preload().then(() => undefined);
}

export function drawRewildEntityV4Sprite(
  ctx: CanvasRenderingContext2D,
  id: RewildEntityV4Id,
  x: number,
  y: number,
  options: RewildEntityDrawOptions = {},
) {
  if (typeof Image !== "undefined" && !entityReady) void preload();
  if (!entityImage?.complete || entityImage.naturalWidth <= 0) return false;
  const frame = REWILD_ENTITY_V4_FRAMES[id];
  const scale = (options.scale ?? 1) * NATIVE_TO_LEGACY_SCALE;
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  if (options.rotation) ctx.rotate(options.rotation);
  if (options.flipX) ctx.scale(-1, 1);
  ctx.drawImage(
    entityImage,
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
