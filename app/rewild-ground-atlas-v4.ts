import { createRewildV4AtlasRuntime, type RewildV4DrawOptions } from "./rewild-v4-atlas-runtime";

export const REWILD_GROUND_V4_IDS = ["grass-a"] as const;

export type RewildGroundV4Id = (typeof REWILD_GROUND_V4_IDS)[number];

export type RewildGroundDrawOptions = RewildV4DrawOptions;

const GROUND_ATLAS_URL = "/rewild/v4/ground-atlas-v4.png";

// Native tiles are 64x56 — the flat-top hex aspect ratio at a 32px "size" (see
// build-rewild-v4-ground-atlas.mjs). HEX_SIZE in the live grid is 21, so this maps a tile onto
// exactly one hex footprint with no distortion.
const NATIVE_TO_HEX_SCALE = 21 / 32;

export const REWILD_GROUND_V4_FRAMES: Record<RewildGroundV4Id, { x: number; y: number; width: number; height: number }> = {
  "grass-a": { x: 0, y: 0, width: 64, height: 56 },
};

const runtime = createRewildV4AtlasRuntime(GROUND_ATLAS_URL, REWILD_GROUND_V4_FRAMES, "ground");

export function preloadRewildGroundV4() {
  return runtime.preloadAtlas();
}

export function drawRewildGroundV4Sprite(
  ctx: CanvasRenderingContext2D,
  id: RewildGroundV4Id,
  x: number,
  y: number,
  options: RewildGroundDrawOptions = {},
) {
  return runtime.drawSprite(ctx, id, x, y, options, NATIVE_TO_HEX_SCALE);
}
