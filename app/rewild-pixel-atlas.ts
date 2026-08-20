export * from "./rewild-pixel-atlas-v3";

import {
  REWILD_PIXEL_SPRITE_IDS as REWILD_V2_SPRITE_IDS,
  drawRewildSprite as drawRewildV2Sprite,
  type RewildPixelSpriteId as RewildV2SpriteId,
} from "./rewild-pixel-atlas-v2";
import {
  drawRewildSprite as drawRewildV3Sprite,
  type RewildPixelSpriteId,
  type RewildSpriteDrawOptions,
} from "./rewild-pixel-atlas-v3";

const V2_SPRITES = new Set<string>(REWILD_V2_SPRITE_IDS);
const V3_VISIBILITY = new Map<RewildPixelSpriteId, boolean>();

const V3_FALLBACKS: Partial<Record<RewildPixelSpriteId, RewildV2SpriteId>> = {
  "industrial-fan": "datacenter",
  "industrial-power": "datacenter",
  "industrial-relay": "corruption-node",
  "industrial-rubble": "rock",
  "reed-clump": "grass-tuft",
  "corruption-spike": "corruption-node",
};

function v3FrameHasVisiblePixels(id: RewildPixelSpriteId) {
  const cached = V3_VISIBILITY.get(id);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return false;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.imageSmoothingEnabled = false;

  const loaded = drawRewildV3Sprite(context, id, 32, 32, { scale: 1 });
  if (!loaded) return false;

  const pixels = context.getImageData(0, 0, 64, 64).data;
  let visiblePixels = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 24) visiblePixels += 1;
  }
  const visible = visiblePixels >= 24;
  V3_VISIBILITY.set(id, visible);
  return visible;
}

export function drawRewildSprite(
  ctx: CanvasRenderingContext2D,
  id: RewildPixelSpriteId,
  x: number,
  y: number,
  options: RewildSpriteDrawOptions = {},
) {
  if (v3FrameHasVisiblePixels(id)) return drawRewildV3Sprite(ctx, id, x, y, options);

  const fallback = V2_SPRITES.has(id) ? id as RewildV2SpriteId : V3_FALLBACKS[id];
  if (!fallback) return false;
  drawRewildV2Sprite(ctx, fallback, x, y, options);
  return true;
}
