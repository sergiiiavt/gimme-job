import { createRewildV4AtlasRuntime, type RewildV4DrawOptions } from "./rewild-v4-atlas-runtime";

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

export type RewildEntityDrawOptions = RewildV4DrawOptions;

const ENTITY_ATLAS_URL = "/rewild/v4/entities-atlas-v4.png";

// Source sprites are authored at 32px native and are tightly cropped (subject fills the frame,
// no padding). The pre-existing v3 entity atlas assumed 64px native frames with padding around
// the subject, so naively doubling to "match" 64px made v4 sprites overflow their hex (e.g. a
// mature elderoak rendered ~63px wide inside a 42px hex). 1.3 keeps units comfortably inside
// their hex footprint while staying close to the old on-screen scale for every existing caller.
const NATIVE_TO_LEGACY_SCALE = 1.3;

export const REWILD_ENTITY_V4_FRAMES: Record<RewildEntityV4Id, { x: number; y: number; width: number; height: number }> = {
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

const runtime = createRewildV4AtlasRuntime(ENTITY_ATLAS_URL, REWILD_ENTITY_V4_FRAMES, "entities");

export function preloadRewildEntityV4() {
  return runtime.preloadAtlas();
}

export function drawRewildEntityV4Sprite(
  ctx: CanvasRenderingContext2D,
  id: RewildEntityV4Id,
  x: number,
  y: number,
  options: RewildEntityDrawOptions = {},
) {
  return runtime.drawSprite(ctx, id, x, y, options, NATIVE_TO_LEGACY_SCALE);
}
