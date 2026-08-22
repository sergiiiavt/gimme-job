export const REWILD_DETAIL_V4_IDS = [
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
  "detail-tree-pine-a",
  "detail-tree-broadleaf-a",
] as const;

export type RewildDetailV4Id = (typeof REWILD_DETAIL_V4_IDS)[number];

interface RewildDetailV4Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
}

export interface RewildDetailDrawOptions {
  scale?: number;
  alpha?: number;
  flipX?: boolean;
  rotation?: number;
}

const DETAIL_ATLAS_URL = "/rewild/v4/environment-details-atlas-v4.png";

export const REWILD_DETAIL_V4_FRAMES: Record<RewildDetailV4Id, RewildDetailV4Frame> = {
  "detail-grass-tuft-a": { x: 32, y: 38, width: 64, height: 51, pivotX: 0.5, pivotY: 0.92 },
  "detail-grass-tuft-b": { x: 161, y: 43, width: 62, height: 42, pivotX: 0.5, pivotY: 0.92 },
  "detail-grass-tuft-c": { x: 289, y: 41, width: 62, height: 46, pivotX: 0.5, pivotY: 0.92 },
  "detail-wild-weeds": { x: 408, y: 30, width: 79, height: 67, pivotX: 0.5, pivotY: 0.92 },
  "detail-flower-yellow": { x: 545, y: 38, width: 61, height: 51, pivotX: 0.5, pivotY: 0.92 },
  "detail-flower-purple": { x: 671, y: 37, width: 66, height: 54, pivotX: 0.5, pivotY: 0.92 },
  "detail-mushrooms": { x: 33, y: 168, width: 62, height: 47, pivotX: 0.5, pivotY: 0.92 },
  "detail-pebbles": { x: 164, y: 174, width: 55, height: 36, pivotX: 0.5, pivotY: 0.92 },
  "detail-rock-small-a": { x: 289, y: 170, width: 61, height: 43, pivotX: 0.5, pivotY: 0.92 },
  "detail-rock-small-b": { x: 417, y: 168, width: 62, height: 47, pivotX: 0.5, pivotY: 0.92 },
  "detail-rock-medium-a": { x: 537, y: 162, width: 77, height: 59, pivotX: 0.5, pivotY: 0.92 },
  "detail-log-a": { x: 655, y: 164, width: 98, height: 56, pivotX: 0.5, pivotY: 0.92 },
  "detail-stump-a": { x: 27, y: 300, width: 74, height: 40, pivotX: 0.5, pivotY: 0.92 },
  "detail-shrub-low-a": { x: 157, y: 295, width: 70, height: 49, pivotX: 0.5, pivotY: 0.92 },
  "detail-reeds-a": { x: 289, y: 291, width: 62, height: 58, pivotX: 0.5, pivotY: 0.92 },
  "detail-lily-pads-a": { x: 428, y: 298, width: 39, height: 43, pivotX: 0.5, pivotY: 0.5 },
  "industrial-cable-segment-a": { x: 519, y: 288, width: 113, height: 63, pivotX: 0.5, pivotY: 0.5 },
  "industrial-junction-box-a": { x: 655, y: 289, width: 97, height: 61, pivotX: 0.5, pivotY: 0.92 },
  "industrial-relay-box-a": { x: 3, y: 413, width: 121, height: 70, pivotX: 0.5, pivotY: 0.92 },
  "industrial-pipe-outlet-a": { x: 142, y: 413, width: 100, height: 69, pivotX: 0.5, pivotY: 0.92 },
  "industrial-vent-small-a": { x: 282, y: 420, width: 76, height: 55, pivotX: 0.5, pivotY: 0.92 },
  "industrial-debris-small-a": { x: 393, y: 416, width: 110, height: 63, pivotX: 0.5, pivotY: 0.92 },
  "detail-tree-pine-a": { x: 544, y: 408, width: 64, height: 80, pivotX: 0.5, pivotY: 0.92 },
  "detail-tree-broadleaf-a": { x: 672, y: 408, width: 64, height: 80, pivotX: 0.5, pivotY: 0.92 },
};

let detailImage: HTMLImageElement | null = null;
let detailReady: Promise<HTMLImageElement> | null = null;

function preload() {
  if (typeof Image === "undefined") return Promise.resolve<HTMLImageElement | null>(null);
  if (detailImage?.complete && detailImage.naturalWidth > 0) return Promise.resolve(detailImage);
  detailReady ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = detailImage ?? new Image();
    image.onload = () => { detailImage = image; resolve(image); };
    image.onerror = () => reject(new Error(`Failed to load Rewild v4 detail atlas: ${DETAIL_ATLAS_URL}`));
    if (!detailImage) {
      detailImage = image;
      image.src = DETAIL_ATLAS_URL;
    }
  });
  return detailReady;
}

export function preloadRewildDetailV4() {
  return preload().then(() => undefined);
}

export function drawRewildDetailV4(
  ctx: CanvasRenderingContext2D,
  id: RewildDetailV4Id,
  x: number,
  y: number,
  options: RewildDetailDrawOptions = {},
) {
  if (typeof Image !== "undefined" && !detailReady) void preload();
  if (!detailImage?.complete || detailImage.naturalWidth <= 0) return false;
  const frame = REWILD_DETAIL_V4_FRAMES[id];
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
    detailImage,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -Math.round(width * frame.pivotX),
    -Math.round(height * frame.pivotY),
    width,
    height,
  );
  ctx.restore();
  return true;
}
