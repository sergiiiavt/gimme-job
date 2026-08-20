import type { EnemyKind, PlantKind } from "./rewild-hex-world";

export const REWILD_PIXEL_ATLAS_FRAME_SIZE = 64;
export const REWILD_PIXEL_ATLAS_COLUMNS = 8;

export const REWILD_PIXEL_SPRITE_IDS = [
  "tree-broadleaf",
  "tree-pine",
  "rock",
  "shrub",
  "log",
  "fence",
  "sign",
  "flower-cluster",
  "water-lilies",
  "grass-tuft",
  "house",
  "house-damaged",
  "datacenter",
  "mainframe",
  "plant-sunbloom",
  "plant-thornbramble",
  "plant-sporecap",
  "plant-vinewhip",
  "plant-rootreclaimer",
  "plant-elderoak",
  "plant-elderoak-mature",
  "enemy-clickbait",
  "enemy-deepfake",
  "enemy-popup",
  "enemy-fragment",
  "corruption-node",
  "industrial-fan",
  "industrial-power",
  "industrial-relay",
  "industrial-rubble",
  "reed-clump",
  "corruption-spike",
] as const;

export type RewildPixelSpriteId = (typeof REWILD_PIXEL_SPRITE_IDS)[number];

export const REWILD_TERRAIN_TILE_IDS = [
  "grass-a",
  "grass-b",
  "grass-c",
  "forest-floor",
  "water-deep",
  "water-shallow",
  "soil",
  "industrial-a",
  "industrial-b",
  "corruption-1",
  "corruption-2",
  "corruption-3",
  "corruption-4",
  "road-dirt",
  "road-edge",
  "rubble",
] as const;

export type RewildTerrainTileId = (typeof REWILD_TERRAIN_TILE_IDS)[number];

export interface RewildPixelFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RewildSpriteDrawOptions {
  scale?: number;
  alpha?: number;
  rotation?: number;
  flipX?: boolean;
}

const ENTITY_ATLAS_URL = "/rewild/overhead/entities-atlas-v3.png";
const TERRAIN_ATLAS_URL = "/rewild/overhead/terrain-atlas-v3.png";
const TERRAIN_FRAME_SIZE = 32;
const TERRAIN_COLUMNS = 8;

export const REWILD_PIXEL_ATLAS_FRAMES = Object.fromEntries(
  REWILD_PIXEL_SPRITE_IDS.map((id, index) => [id, {
    x: (index % REWILD_PIXEL_ATLAS_COLUMNS) * REWILD_PIXEL_ATLAS_FRAME_SIZE,
    y: Math.floor(index / REWILD_PIXEL_ATLAS_COLUMNS) * REWILD_PIXEL_ATLAS_FRAME_SIZE,
    width: REWILD_PIXEL_ATLAS_FRAME_SIZE,
    height: REWILD_PIXEL_ATLAS_FRAME_SIZE,
  }]),
) as Record<RewildPixelSpriteId, RewildPixelFrame>;

export const REWILD_TERRAIN_FRAMES = Object.fromEntries(
  REWILD_TERRAIN_TILE_IDS.map((id, index) => [id, {
    x: (index % TERRAIN_COLUMNS) * TERRAIN_FRAME_SIZE,
    y: Math.floor(index / TERRAIN_COLUMNS) * TERRAIN_FRAME_SIZE,
    width: TERRAIN_FRAME_SIZE,
    height: TERRAIN_FRAME_SIZE,
  }]),
) as Record<RewildTerrainTileId, RewildPixelFrame>;

let entityImage: HTMLImageElement | null = null;
let terrainImage: HTMLImageElement | null = null;
let entityReady: Promise<HTMLImageElement> | null = null;
let terrainReady: Promise<HTMLImageElement> | null = null;
const terrainPatterns = new WeakMap<CanvasRenderingContext2D, Map<RewildTerrainTileId, CanvasPattern>>();

function loadImage(
  url: string,
  current: () => HTMLImageElement | null,
  save: (image: HTMLImageElement) => void,
) {
  const cached = current();
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = cached ?? new Image();
    image.onload = () => {
      save(image);
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Failed to load Rewild authored-art atlas: ${url}`));
    if (!cached) {
      save(image);
      image.src = url;
    }
  });
}

export function preloadRewildArt() {
  if (typeof Image === "undefined") return Promise.resolve();
  entityReady ??= loadImage(ENTITY_ATLAS_URL, () => entityImage, (image) => { entityImage = image; });
  terrainReady ??= loadImage(TERRAIN_ATLAS_URL, () => terrainImage, (image) => { terrainImage = image; });
  return Promise.all([entityReady, terrainReady]).then(() => undefined);
}

function ensurePreload() {
  if (typeof Image !== "undefined" && (!entityReady || !terrainReady)) void preloadRewildArt();
}

ensurePreload();

export function drawRewildSprite(
  ctx: CanvasRenderingContext2D,
  id: RewildPixelSpriteId,
  x: number,
  y: number,
  options: RewildSpriteDrawOptions = {},
) {
  ensurePreload();
  if (!entityImage?.complete || entityImage.naturalWidth <= 0) return false;
  const frame = REWILD_PIXEL_ATLAS_FRAMES[id];
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

function terrainPattern(ctx: CanvasRenderingContext2D, id: RewildTerrainTileId) {
  ensurePreload();
  if (!terrainImage?.complete || terrainImage.naturalWidth <= 0) return null;

  let patterns = terrainPatterns.get(ctx);
  if (!patterns) {
    patterns = new Map();
    terrainPatterns.set(ctx, patterns);
  }
  const cached = patterns.get(id);
  if (cached) return cached;

  const frame = REWILD_TERRAIN_FRAMES[id];
  const tile = document.createElement("canvas");
  tile.width = frame.width;
  tile.height = frame.height;
  const tileContext = tile.getContext("2d");
  if (!tileContext) return null;
  tileContext.imageSmoothingEnabled = false;
  tileContext.drawImage(
    terrainImage,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    frame.width,
    frame.height,
  );
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) patterns.set(id, pattern);
  return pattern;
}

export function fillRewildTerrainPattern(
  ctx: CanvasRenderingContext2D,
  id: RewildTerrainTileId,
  path: Path2D,
  fallback: string,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = terrainPattern(ctx, id) ?? fallback;
  ctx.fill(path);
  ctx.restore();
}

export function drawRewildTerrainStamp(
  ctx: CanvasRenderingContext2D,
  id: RewildTerrainTileId,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
) {
  ensurePreload();
  if (!terrainImage?.complete || terrainImage.naturalWidth <= 0) return false;
  const frame = REWILD_TERRAIN_FRAMES[id];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    terrainImage,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    Math.round(x - width / 2),
    Math.round(y - height / 2),
    Math.round(width),
    Math.round(height),
  );
  ctx.restore();
  return true;
}

export function spriteForPlant(kind: PlantKind, mature = false): RewildPixelSpriteId {
  if (kind === "elderoak") return mature ? "plant-elderoak-mature" : "plant-elderoak";
  return `plant-${kind}` as RewildPixelSpriteId;
}

export function spriteForEnemy(kind: EnemyKind): RewildPixelSpriteId {
  return `enemy-${kind}` as RewildPixelSpriteId;
}
