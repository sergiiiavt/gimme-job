import type { EnemyKind, PlantKind } from "./rewild-hex-world";

export const REWILD_PIXEL_ATLAS_FRAME_SIZE = 48;
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
] as const;

export type RewildPixelSpriteId = (typeof REWILD_PIXEL_SPRITE_IDS)[number];

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

const FRAME = REWILD_PIXEL_ATLAS_FRAME_SIZE;
const HALF = FRAME / 2;

export const REWILD_PIXEL_ATLAS_FRAMES = Object.fromEntries(
  REWILD_PIXEL_SPRITE_IDS.map((id, index) => [id, {
    x: (index % REWILD_PIXEL_ATLAS_COLUMNS) * FRAME,
    y: Math.floor(index / REWILD_PIXEL_ATLAS_COLUMNS) * FRAME,
    width: FRAME,
    height: FRAME,
  }]),
) as Record<RewildPixelSpriteId, RewildPixelFrame>;

export const REWILD_PIXEL_ATLAS_ROWS = Math.ceil(REWILD_PIXEL_SPRITE_IDS.length / REWILD_PIXEL_ATLAS_COLUMNS);
export const REWILD_PIXEL_ATLAS_WIDTH = REWILD_PIXEL_ATLAS_COLUMNS * FRAME;
export const REWILD_PIXEL_ATLAS_HEIGHT = REWILD_PIXEL_ATLAS_ROWS * FRAME;

const COLORS = {
  transparent: "rgba(0,0,0,0)",
  outline: "#18201d",
  darkest: "#1e2924",
  leaf0: "#244c2c",
  leaf1: "#356d33",
  leaf2: "#4f8738",
  leaf3: "#78a84a",
  bark0: "#4d3829",
  bark1: "#725033",
  bark2: "#9a7244",
  stone0: "#4b5550",
  stone1: "#707a6e",
  stone2: "#9b9d82",
  yellow0: "#8e6327",
  yellow1: "#d89d32",
  yellow2: "#f2cf4b",
  purple0: "#3d2b59",
  purple1: "#65408b",
  purple2: "#9259bd",
  purple3: "#be7be0",
  blue0: "#27334c",
  blue1: "#384f80",
  blue2: "#6371b0",
  cyan: "#61b9c8",
  metal0: "#22292c",
  metal1: "#374045",
  metal2: "#596369",
  metal3: "#858b87",
  red0: "#6b3235",
  red1: "#a84145",
  red2: "#df6659",
  pink: "#d54eaa",
  water0: "#1f5269",
  water1: "#37788b",
  cream: "#d7cfaa",
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const r = Math.max(1, Math.round(radius));
  ctx.fillStyle = color;
  for (let row = -r; row <= r; row += 2) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - row * row)));
    ctx.fillRect(Math.round(x - half), Math.round(y + row), half * 2 + 1, 2);
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  ctx.fillStyle = color;
  const size = Math.max(1, Math.round(width));
  for (let step = 0; step <= length; step += 1.5) {
    const t = length ? step / length : 0;
    ctx.fillRect(Math.round(x1 + dx * t - size / 2), Math.round(y1 + dy * t - size / 2), size, size);
  }
}

function leafCluster(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, dark = COLORS.leaf0) {
  disc(ctx, x - radius * .45, y + radius * .15, radius * .68, dark);
  disc(ctx, x + radius * .42, y + radius * .12, radius * .65, COLORS.leaf2);
  disc(ctx, x, y - radius * .42, radius * .64, COLORS.leaf1);
  disc(ctx, x + radius * .12, y - radius * .26, radius * .35, COLORS.leaf3);
}

function paintBroadleaf(ctx: CanvasRenderingContext2D) {
  line(ctx, 24, 24, 24, 37, 5, COLORS.bark0);
  line(ctx, 24, 27, 17, 33, 3, COLORS.bark1);
  line(ctx, 24, 27, 31, 32, 3, COLORS.bark1);
  leafCluster(ctx, 23, 20, 14);
  disc(ctx, 14, 22, 5, COLORS.leaf1);
  disc(ctx, 32, 21, 5, COLORS.leaf2);
}

function paintPine(ctx: CanvasRenderingContext2D) {
  px(ctx, 22, 24, 4, 14, COLORS.bark0);
  for (const [y, width, color] of [[8, 12, COLORS.leaf1], [13, 18, COLORS.leaf0], [19, 23, COLORS.leaf2], [25, 28, COLORS.leaf0]] as const) {
    for (let row = 0; row < 7; row += 2) {
      const half = Math.max(2, Math.round(width / 2 - row * .7));
      px(ctx, 24 - half, y + row, half * 2, 2, color);
    }
  }
  px(ctx, 23, 6, 2, 3, COLORS.leaf3);
}

function paintRock(ctx: CanvasRenderingContext2D) {
  px(ctx, 11, 23, 27, 12, COLORS.stone0);
  px(ctx, 15, 17, 19, 14, COLORS.stone1);
  px(ctx, 18, 15, 11, 5, COLORS.stone2);
  px(ctx, 11, 31, 8, 4, COLORS.darkest);
  px(ctx, 31, 28, 7, 5, COLORS.darkest);
}

function paintShrub(ctx: CanvasRenderingContext2D) {
  disc(ctx, 17, 26, 8, COLORS.leaf0);
  disc(ctx, 26, 23, 10, COLORS.leaf1);
  disc(ctx, 34, 27, 7, COLORS.leaf2);
  disc(ctx, 24, 18, 6, COLORS.leaf3);
  px(ctx, 18, 31, 14, 3, COLORS.bark0);
}

function paintLog(ctx: CanvasRenderingContext2D) {
  line(ctx, 10, 31, 38, 17, 8, COLORS.bark0);
  line(ctx, 11, 29, 37, 16, 4, COLORS.bark2);
  disc(ctx, 10, 31, 5, COLORS.bark1);
  disc(ctx, 10, 31, 2, COLORS.darkest);
  px(ctx, 29, 18, 3, 8, COLORS.leaf1);
}

function paintFence(ctx: CanvasRenderingContext2D) {
  line(ctx, 8, 27, 40, 27, 4, COLORS.bark1);
  line(ctx, 8, 34, 40, 34, 3, COLORS.bark2);
  px(ctx, 12, 18, 5, 22, COLORS.bark0);
  px(ctx, 32, 18, 5, 22, COLORS.bark0);
  px(ctx, 13, 19, 3, 18, COLORS.bark2);
  px(ctx, 33, 19, 3, 18, COLORS.bark2);
}

function paintSign(ctx: CanvasRenderingContext2D) {
  px(ctx, 22, 24, 4, 16, COLORS.bark0);
  px(ctx, 10, 11, 29, 15, COLORS.bark1);
  px(ctx, 12, 13, 25, 11, COLORS.bark2);
  px(ctx, 16, 16, 17, 2, COLORS.cream);
  px(ctx, 20, 20, 10, 2, COLORS.cream);
}

function paintFlowerCluster(ctx: CanvasRenderingContext2D) {
  for (const [x, y, color] of [[15, 27, COLORS.yellow2], [22, 18, COLORS.cream], [31, 25, COLORS.yellow1], [27, 33, COLORS.cream], [36, 18, COLORS.yellow2]] as const) {
    px(ctx, x, y, 3, 3, color);
    px(ctx, x + 1, y + 3, 1, 6, COLORS.leaf1);
  }
  px(ctx, 10, 35, 27, 3, COLORS.leaf0);
}

function paintWaterLilies(ctx: CanvasRenderingContext2D) {
  disc(ctx, 17, 25, 8, COLORS.leaf1);
  px(ctx, 17, 22, 7, 3, COLORS.water0);
  disc(ctx, 31, 20, 6, COLORS.leaf2);
  px(ctx, 31, 18, 5, 3, COLORS.water0);
  px(ctx, 32, 18, 2, 2, COLORS.yellow2);
  px(ctx, 16, 24, 2, 2, COLORS.cream);
}

function paintGrassTuft(ctx: CanvasRenderingContext2D) {
  for (const [x, y, dx] of [[15, 35, -5], [21, 36, 0], [26, 36, 4], [31, 35, 7]] as const) {
    line(ctx, x, y, x + dx, 20, 2, COLORS.leaf2);
  }
  px(ctx, 11, 36, 25, 2, COLORS.leaf0);
}

function paintHouse(ctx: CanvasRenderingContext2D, damaged = false) {
  const roof = damaged ? COLORS.red0 : "#98523a";
  const roofLight = damaged ? COLORS.red1 : "#c06b46";
  px(ctx, 8, 12, 32, 24, COLORS.bark0);
  px(ctx, 11, 15, 26, 18, "#c6b281");
  px(ctx, 7, 10, 34, 8, roof);
  px(ctx, 11, 7, 26, 8, roofLight);
  for (let col = 0; col < 6; col += 1) px(ctx, 12 + col * 4, 9 + (col % 2), 3, 2, roof);
  px(ctx, 14, 21, 7, 7, COLORS.blue0);
  px(ctx, 28, 21, 7, 13, COLORS.bark1);
  px(ctx, 30, 23, 3, 9, COLORS.bark0);
  px(ctx, 16, 23, 3, 3, COLORS.cyan);
  if (damaged) {
    line(ctx, 10, 13, 18, 20, 2, COLORS.darkest);
    line(ctx, 31, 10, 26, 18, 2, COLORS.darkest);
    px(ctx, 36, 28, 4, 4, COLORS.darkest);
  }
}

function paintDatacenter(ctx: CanvasRenderingContext2D, boss = false) {
  px(ctx, 7, 11, 34, 28, COLORS.metal0);
  px(ctx, 10, 14, 21, 22, COLORS.metal1);
  for (let rack = 0; rack < 3; rack += 1) {
    px(ctx, 12 + rack * 6, 16, 4, 17, COLORS.metal2);
    for (let light = 0; light < 4; light += 1) px(ctx, 13 + rack * 6, 18 + light * 4, 2, 2, light % 2 ? COLORS.yellow1 : COLORS.yellow2);
  }
  px(ctx, 33, 14, 6, 22, COLORS.metal1);
  disc(ctx, 36, 20, 4, COLORS.darkest);
  disc(ctx, 36, 30, 4, COLORS.darkest);
  px(ctx, 9, 37, 30, 3, COLORS.yellow1);
  if (boss) {
    px(ctx, 10, 6, 28, 7, COLORS.metal0);
    px(ctx, 13, 8, 22, 3, COLORS.metal3);
    px(ctx, 22, 7, 4, 4, COLORS.red2);
  }
}

function paintSunbloom(ctx: CanvasRenderingContext2D) {
  for (let petal = 0; petal < 8; petal += 1) {
    const angle = petal * Math.PI / 4;
    disc(ctx, 24 + Math.cos(angle) * 11, 24 + Math.sin(angle) * 11, 5, petal % 2 ? COLORS.yellow1 : COLORS.yellow2);
  }
  disc(ctx, 24, 24, 7, COLORS.bark0);
  disc(ctx, 24, 24, 3, COLORS.yellow0);
  px(ctx, 23, 31, 3, 10, COLORS.leaf1);
  px(ctx, 17, 35, 7, 3, COLORS.leaf2);
}

function paintThorn(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 25, 12, COLORS.leaf0);
  for (let arm = 0; arm < 8; arm += 1) {
    const angle = arm * Math.PI / 4 + .15;
    line(ctx, 24, 25, 24 + Math.cos(angle) * 17, 25 + Math.sin(angle) * 15, 3, arm % 2 ? COLORS.leaf1 : COLORS.leaf2);
    disc(ctx, 24 + Math.cos(angle) * 17, 25 + Math.sin(angle) * 15, 2, COLORS.red2);
  }
  disc(ctx, 24, 25, 5, COLORS.leaf3);
}

function paintSpore(ctx: CanvasRenderingContext2D) {
  px(ctx, 14, 25, 5, 13, COLORS.cream);
  px(ctx, 25, 22, 5, 16, COLORS.cream);
  px(ctx, 33, 28, 4, 10, COLORS.cream);
  disc(ctx, 16, 23, 9, COLORS.purple1);
  disc(ctx, 27, 19, 11, COLORS.purple2);
  disc(ctx, 35, 26, 8, COLORS.purple0);
  for (const [x, y] of [[12, 20], [19, 19], [24, 15], [31, 18], [34, 23]] as const) disc(ctx, x, y, 2, COLORS.cyan);
}

function paintVine(ctx: CanvasRenderingContext2D) {
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = arm * Math.PI / 3 + .2;
    line(ctx, 24, 25, 24 + Math.cos(angle) * 18, 25 + Math.sin(angle) * 16, 4, arm % 2 ? COLORS.leaf1 : COLORS.leaf2);
    disc(ctx, 24 + Math.cos(angle) * 16, 25 + Math.sin(angle) * 14, 3, COLORS.leaf3);
  }
  disc(ctx, 24, 25, 7, COLORS.leaf0);
  line(ctx, 20, 28, 29, 19, 2, COLORS.yellow1);
}

function paintRoot(ctx: CanvasRenderingContext2D) {
  for (let root = 0; root < 8; root += 1) {
    const angle = root * Math.PI / 4 + .15;
    line(ctx, 24, 27, 24 + Math.cos(angle) * 19, 27 + Math.sin(angle) * 15, 3, root % 2 ? COLORS.bark0 : COLORS.bark1);
  }
  disc(ctx, 24, 25, 8, COLORS.leaf1);
  disc(ctx, 18, 19, 6, COLORS.leaf2);
  disc(ctx, 29, 18, 5, COLORS.leaf3);
}

function paintOak(ctx: CanvasRenderingContext2D, mature = false) {
  const radius = mature ? 15 : 11;
  px(ctx, 21, 23, 6, 16, COLORS.bark0);
  line(ctx, 24, 27, 14, 19, 3, COLORS.bark1);
  line(ctx, 24, 27, 34, 19, 3, COLORS.bark1);
  leafCluster(ctx, 24, mature ? 18 : 20, radius, COLORS.leaf0);
  if (mature) {
    disc(ctx, 11, 21, 7, COLORS.leaf1);
    disc(ctx, 37, 22, 7, COLORS.leaf2);
    px(ctx, 14, 37, 20, 3, COLORS.bark0);
  }
}

function paintClickbait(ctx: CanvasRenderingContext2D) {
  for (const [x, y, color] of [[16, 18, COLORS.yellow2], [30, 17, COLORS.yellow1], [23, 31, COLORS.leaf3], [36, 29, COLORS.yellow2]] as const) {
    disc(ctx, x, y, 6, color);
    px(ctx, x - 2, y - 1, 4, 2, COLORS.darkest);
  }
}

function paintDeepfake(ctx: CanvasRenderingContext2D) {
  disc(ctx, 19, 26, 12, COLORS.blue1);
  disc(ctx, 30, 25, 11, COLORS.purple1);
  disc(ctx, 24, 17, 9, COLORS.blue2);
  disc(ctx, 33, 31, 6, COLORS.purple2);
  px(ctx, 17, 23, 5, 3, COLORS.cyan);
  px(ctx, 28, 22, 5, 3, COLORS.purple3);
  px(ctx, 23, 14, 4, 3, COLORS.cyan);
}

function paintPopup(ctx: CanvasRenderingContext2D) {
  px(ctx, 11, 10, 28, 28, COLORS.darkest);
  px(ctx, 13, 12, 24, 24, COLORS.metal1);
  px(ctx, 13, 12, 24, 5, COLORS.pink);
  px(ctx, 17, 20, 16, 4, COLORS.purple2);
  px(ctx, 17, 27, 11, 5, COLORS.purple1);
  px(ctx, 31, 13, 4, 3, COLORS.cream);
  px(ctx, 32, 14, 2, 1, COLORS.red2);
}

function paintFragment(ctx: CanvasRenderingContext2D) {
  px(ctx, 15, 17, 12, 13, COLORS.purple1);
  px(ctx, 24, 24, 11, 10, COLORS.purple2);
  px(ctx, 18, 19, 5, 4, COLORS.cyan);
  px(ctx, 29, 27, 3, 3, COLORS.pink);
}

function paintCorruption(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 24, 12, COLORS.purple0);
  disc(ctx, 19, 22, 5, COLORS.purple2);
  disc(ctx, 29, 27, 6, COLORS.purple1);
  px(ctx, 23, 18, 4, 4, COLORS.purple3);
  for (let arm = 0; arm < 4; arm += 1) {
    const angle = arm * Math.PI / 2 + .4;
    line(ctx, 24, 24, 24 + Math.cos(angle) * 16, 24 + Math.sin(angle) * 15, 2, COLORS.purple1);
  }
}

function paintSprite(ctx: CanvasRenderingContext2D, id: RewildPixelSpriteId) {
  ctx.clearRect(0, 0, FRAME, FRAME);
  switch (id) {
    case "tree-broadleaf": paintBroadleaf(ctx); break;
    case "tree-pine": paintPine(ctx); break;
    case "rock": paintRock(ctx); break;
    case "shrub": paintShrub(ctx); break;
    case "log": paintLog(ctx); break;
    case "fence": paintFence(ctx); break;
    case "sign": paintSign(ctx); break;
    case "flower-cluster": paintFlowerCluster(ctx); break;
    case "water-lilies": paintWaterLilies(ctx); break;
    case "grass-tuft": paintGrassTuft(ctx); break;
    case "house": paintHouse(ctx); break;
    case "house-damaged": paintHouse(ctx, true); break;
    case "datacenter": paintDatacenter(ctx); break;
    case "mainframe": paintDatacenter(ctx, true); break;
    case "plant-sunbloom": paintSunbloom(ctx); break;
    case "plant-thornbramble": paintThorn(ctx); break;
    case "plant-sporecap": paintSpore(ctx); break;
    case "plant-vinewhip": paintVine(ctx); break;
    case "plant-rootreclaimer": paintRoot(ctx); break;
    case "plant-elderoak": paintOak(ctx); break;
    case "plant-elderoak-mature": paintOak(ctx, true); break;
    case "enemy-clickbait": paintClickbait(ctx); break;
    case "enemy-deepfake": paintDeepfake(ctx); break;
    case "enemy-popup": paintPopup(ctx); break;
    case "enemy-fragment": paintFragment(ctx); break;
    case "corruption-node": paintCorruption(ctx); break;
  }
}

let cachedAtlas: HTMLCanvasElement | null = null;

export function createRewildPixelAtlas() {
  if (cachedAtlas) return cachedAtlas;
  if (typeof document === "undefined") return null;

  const atlas = document.createElement("canvas");
  atlas.width = REWILD_PIXEL_ATLAS_WIDTH;
  atlas.height = REWILD_PIXEL_ATLAS_HEIGHT;
  const atlasContext = atlas.getContext("2d");
  if (!atlasContext) return null;
  atlasContext.imageSmoothingEnabled = false;

  const scratch = document.createElement("canvas");
  scratch.width = FRAME;
  scratch.height = FRAME;
  const scratchContext = scratch.getContext("2d");
  if (!scratchContext) return null;
  scratchContext.imageSmoothingEnabled = false;

  for (const id of REWILD_PIXEL_SPRITE_IDS) {
    paintSprite(scratchContext, id);
    const frame = REWILD_PIXEL_ATLAS_FRAMES[id];
    atlasContext.drawImage(scratch, frame.x, frame.y);
  }

  cachedAtlas = atlas;
  return atlas;
}

export function drawRewildSprite(
  ctx: CanvasRenderingContext2D,
  id: RewildPixelSpriteId,
  x: number,
  y: number,
  options: RewildSpriteDrawOptions = {},
) {
  const atlas = createRewildPixelAtlas();
  if (!atlas) return false;
  const frame = REWILD_PIXEL_ATLAS_FRAMES[id];
  const scale = options.scale ?? 1;
  const width = frame.width * scale;
  const height = frame.height * scale;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.translate(Math.round(x), Math.round(y));
  if (options.rotation) ctx.rotate(options.rotation);
  if (options.flipX) ctx.scale(-1, 1);
  ctx.drawImage(
    atlas,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -Math.round(width / 2),
    -Math.round(height / 2),
    Math.round(width),
    Math.round(height),
  );
  ctx.restore();
  return true;
}

const PLANT_SPRITES: Record<PlantKind, RewildPixelSpriteId> = {
  sunbloom: "plant-sunbloom",
  thornbramble: "plant-thornbramble",
  sporecap: "plant-sporecap",
  vinewhip: "plant-vinewhip",
  rootreclaimer: "plant-rootreclaimer",
  elderoak: "plant-elderoak",
};

const ENEMY_SPRITES: Record<EnemyKind, RewildPixelSpriteId> = {
  clickbait: "enemy-clickbait",
  deepfake: "enemy-deepfake",
  popup: "enemy-popup",
  fragment: "enemy-fragment",
};

export function spriteForPlant(kind: PlantKind, mature = false): RewildPixelSpriteId {
  return kind === "elderoak" && mature ? "plant-elderoak-mature" : PLANT_SPRITES[kind];
}

export function spriteForEnemy(kind: EnemyKind): RewildPixelSpriteId {
  return ENEMY_SPRITES[kind];
}
