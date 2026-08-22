import { createRewildV4AtlasRuntime, type RewildV4DrawOptions } from "./rewild-v4-atlas-runtime";

export const REWILD_STRUCTURE_V4_IDS = [
  "house",
  "house-damaged",
  "datacenter",
  "mainframe",
] as const;

export type RewildStructureV4Id = (typeof REWILD_STRUCTURE_V4_IDS)[number];

export type RewildStructureDrawOptions = RewildV4DrawOptions;

const STRUCTURE_ATLAS_URL = "/rewild/v4/structures-atlas-v4.png";

export const REWILD_STRUCTURE_V4_FRAMES: Record<RewildStructureV4Id, { x: number; y: number; width: number; height: number }> = {
  "house": { x: 0, y: 0, width: 80, height: 80 },
  "house-damaged": { x: 80, y: 0, width: 80, height: 80 },
  "datacenter": { x: 160, y: 0, width: 80, height: 80 },
  "mainframe": { x: 240, y: 0, width: 128, height: 128 },
};

const runtime = createRewildV4AtlasRuntime(STRUCTURE_ATLAS_URL, REWILD_STRUCTURE_V4_FRAMES, "structures");

export function preloadRewildStructureV4() {
  return runtime.preloadAtlas();
}

export function drawRewildStructureV4Sprite(
  ctx: CanvasRenderingContext2D,
  id: RewildStructureV4Id,
  x: number,
  y: number,
  options: RewildStructureDrawOptions = {},
) {
  return runtime.drawSprite(ctx, id, x, y, options);
}
