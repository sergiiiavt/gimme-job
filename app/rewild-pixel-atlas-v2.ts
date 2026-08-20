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

const C = {
  outline: "#121a17",
  shadow: "#18211d",
  leaf0: "#1d4229",
  leaf1: "#2f6533",
  leaf2: "#4e863d",
  leaf3: "#78a653",
  leaf4: "#a1bd69",
  bark0: "#49372b",
  bark1: "#6d4d33",
  bark2: "#977044",
  stone0: "#46524e",
  stone1: "#68746c",
  stone2: "#919787",
  cream: "#d7cca4",
  warm0: "#6b3b2d",
  warm1: "#9b5338",
  warm2: "#c67649",
  sun0: "#8f6524",
  sun1: "#d89a2d",
  sun2: "#f2cd4e",
  metal0: "#1e2528",
  metal1: "#313a3d",
  metal2: "#535e61",
  metal3: "#7b8584",
  hazard: "#d39e37",
  cyan0: "#376c78",
  cyan1: "#68b0ba",
  purple0: "#352943",
  purple1: "#5c3b6d",
  purple2: "#8a5596",
  purple3: "#c47cc5",
  red0: "#673238",
  red1: "#a2484a",
  red2: "#da665b",
  pink: "#d75ba7",
  blue0: "#253449",
  blue1: "#456184",
  water0: "#1d5365",
  water1: "#34798a",
} as const;

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
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
  const size = Math.max(1, Math.round(width));
  ctx.fillStyle = color;
  for (let step = 0; step <= length; step += 1.25) {
    const t = length ? step / length : 0;
    ctx.fillRect(Math.round(x1 + dx * t - size / 2), Math.round(y1 + dy * t - size / 2), size, size);
  }
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  for (let row = -radius; row <= radius; row += 1) {
    const half = radius - Math.abs(row);
    ctx.fillRect(Math.round(x - half), Math.round(y + row), half * 2 + 1, 1);
  }
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  disc(ctx, x, y, radius, color);
  disc(ctx, x, y, Math.max(1, radius - 3), C.outline);
}

function paintTree(ctx: CanvasRenderingContext2D, pine = false) {
  disc(ctx, 24, 26, 13, C.outline);
  if (pine) {
    diamond(ctx, 24, 23, 15, C.leaf0);
    diamond(ctx, 18, 27, 9, C.leaf1);
    diamond(ctx, 31, 27, 8, C.leaf2);
    diamond(ctx, 24, 18, 8, C.leaf3);
    px(ctx, 23, 24, 3, 4, C.bark1);
    px(ctx, 22, 14, 3, 3, C.leaf4);
  } else {
    disc(ctx, 17, 26, 10, C.leaf0);
    disc(ctx, 31, 26, 10, C.leaf1);
    disc(ctx, 24, 18, 11, C.leaf2);
    disc(ctx, 24, 27, 9, C.leaf2);
    disc(ctx, 20, 18, 5, C.leaf3);
    px(ctx, 23, 24, 4, 5, C.bark1);
    px(ctx, 19, 15, 5, 3, C.leaf4);
  }
}

function paintRock(ctx: CanvasRenderingContext2D) {
  diamond(ctx, 24, 25, 14, C.outline);
  diamond(ctx, 24, 23, 11, C.stone0);
  diamond(ctx, 21, 20, 7, C.stone1);
  px(ctx, 16, 18, 9, 3, C.stone2);
  px(ctx, 28, 29, 8, 3, C.shadow);
}

function paintShrub(ctx: CanvasRenderingContext2D) {
  disc(ctx, 16, 26, 7, C.outline);
  disc(ctx, 25, 23, 10, C.outline);
  disc(ctx, 34, 27, 7, C.outline);
  disc(ctx, 16, 25, 5, C.leaf0);
  disc(ctx, 25, 22, 8, C.leaf1);
  disc(ctx, 34, 26, 5, C.leaf2);
  px(ctx, 22, 18, 5, 3, C.leaf3);
}

function paintLog(ctx: CanvasRenderingContext2D) {
  line(ctx, 10, 31, 38, 17, 10, C.outline);
  line(ctx, 11, 30, 37, 17, 7, C.bark0);
  line(ctx, 12, 28, 36, 16, 3, C.bark2);
  disc(ctx, 10, 31, 5, C.bark1);
  disc(ctx, 10, 31, 2, C.outline);
  px(ctx, 29, 17, 3, 7, C.leaf2);
}

function paintFence(ctx: CanvasRenderingContext2D) {
  line(ctx, 8, 27, 40, 27, 5, C.outline);
  line(ctx, 8, 27, 40, 27, 3, C.bark2);
  line(ctx, 8, 34, 40, 34, 4, C.outline);
  line(ctx, 8, 34, 40, 34, 2, C.bark1);
  for (const x of [12, 34]) {
    px(ctx, x - 2, 18, 6, 22, C.outline);
    px(ctx, x, 19, 3, 19, C.bark2);
  }
}

function paintSign(ctx: CanvasRenderingContext2D) {
  px(ctx, 21, 23, 6, 18, C.outline);
  px(ctx, 23, 24, 3, 16, C.bark1);
  px(ctx, 9, 11, 31, 16, C.outline);
  px(ctx, 11, 13, 27, 12, C.bark1);
  px(ctx, 14, 16, 18, 2, C.cream);
  px(ctx, 18, 21, 12, 2, C.cream);
}

function paintFlowerCluster(ctx: CanvasRenderingContext2D) {
  for (const [x, y, color] of [[14, 29, C.sun2], [20, 20, C.cream], [28, 26, C.sun1], [34, 19, C.cream], [31, 34, C.sun2]] as const) {
    px(ctx, x, y, 3, 3, color);
    px(ctx, x + 1, y + 3, 1, 5, C.leaf2);
  }
  px(ctx, 11, 36, 25, 2, C.leaf0);
}

function paintLilies(ctx: CanvasRenderingContext2D) {
  disc(ctx, 17, 26, 8, C.leaf1);
  px(ctx, 17, 23, 7, 3, C.water0);
  disc(ctx, 31, 20, 6, C.leaf2);
  px(ctx, 31, 18, 5, 3, C.water0);
  px(ctx, 32, 18, 2, 2, C.sun2);
}

function paintGrass(ctx: CanvasRenderingContext2D) {
  for (const [x, dx] of [[14, -5], [20, -1], [25, 3], [31, 7]] as const) line(ctx, x, 36, x + dx, 21, 2, C.leaf2);
  px(ctx, 10, 36, 27, 2, C.leaf0);
}

function paintHouse(ctx: CanvasRenderingContext2D, damaged = false) {
  const roof = damaged ? C.red0 : C.warm0;
  const roofLight = damaged ? C.red1 : C.warm2;
  px(ctx, 7, 10, 34, 28, C.outline);
  px(ctx, 9, 12, 30, 24, roof);
  px(ctx, 12, 9, 24, 5, roofLight);
  px(ctx, 11, 16, 26, 3, C.warm1);
  px(ctx, 13, 21, 8, 8, C.blue0);
  px(ctx, 15, 23, 4, 4, C.cyan1);
  px(ctx, 28, 21, 7, 12, C.bark0);
  px(ctx, 30, 23, 3, 8, C.bark2);
  px(ctx, 34, 11, 4, 7, C.stone0);
  if (damaged) {
    line(ctx, 11, 13, 20, 22, 2, C.outline);
    line(ctx, 34, 13, 26, 23, 2, C.outline);
    px(ctx, 35, 30, 5, 5, C.shadow);
  }
}

function fan(ctx: CanvasRenderingContext2D, x: number, y: number) {
  disc(ctx, x, y, 5, C.outline);
  disc(ctx, x, y, 3, C.metal2);
  px(ctx, x - 1, y - 4, 2, 8, C.metal0);
  px(ctx, x - 4, y - 1, 8, 2, C.metal0);
}

function paintDatacenter(ctx: CanvasRenderingContext2D, boss = false) {
  const inset = boss ? 5 : 7;
  px(ctx, inset, 8, 48 - inset * 2, 33, C.outline);
  px(ctx, inset + 2, 10, 44 - inset * 2, 29, C.metal0);
  px(ctx, inset + 4, 12, 40 - inset * 2, 25, C.metal1);
  fan(ctx, boss ? 15 : 16, 21);
  fan(ctx, boss ? 33 : 32, 21);
  px(ctx, 12, 33, 24, 3, C.metal2);
  for (const x of [14, 20, 26, 32]) px(ctx, x, 34, 3, 2, x % 4 ? C.hazard : C.cyan1);
  px(ctx, inset + 2, 38, 44 - inset * 2, 3, C.hazard);
  if (boss) {
    px(ctx, 9, 6, 30, 5, C.outline);
    px(ctx, 11, 7, 26, 3, C.metal3);
    px(ctx, 22, 6, 5, 5, C.red2);
  }
}

function paintSunbloom(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 24, 14, C.outline);
  for (let petal = 0; petal < 8; petal += 1) {
    const angle = petal * Math.PI / 4;
    disc(ctx, 24 + Math.cos(angle) * 10, 24 + Math.sin(angle) * 10, 4, petal % 2 ? C.sun1 : C.sun2);
  }
  disc(ctx, 24, 24, 6, C.bark0);
  disc(ctx, 24, 24, 3, C.sun0);
}

function paintThorn(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 24, 14, C.outline);
  disc(ctx, 24, 24, 11, C.leaf0);
  for (let arm = 0; arm < 8; arm += 1) {
    const angle = arm * Math.PI / 4;
    line(ctx, 24, 24, 24 + Math.cos(angle) * 16, 24 + Math.sin(angle) * 16, 3, arm % 2 ? C.leaf2 : C.leaf1);
    diamond(ctx, 24 + Math.cos(angle) * 16, 24 + Math.sin(angle) * 16, 2, C.red2);
  }
  disc(ctx, 24, 24, 4, C.leaf3);
}

function paintSpore(ctx: CanvasRenderingContext2D) {
  for (const [x, y, radius] of [[15, 27, 7], [26, 22, 10], [35, 29, 6]] as const) {
    px(ctx, x - 2, y, 4, 10, C.cream);
    disc(ctx, x, y, radius + 2, C.outline);
    disc(ctx, x, y, radius, C.purple2);
    px(ctx, x - 2, y - 2, 3, 3, C.purple3);
  }
}

function paintVine(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 27, 11, C.outline);
  disc(ctx, 24, 27, 8, C.leaf1);
  for (const angle of [-1.15, -.45, .4]) {
    line(ctx, 24, 24, 24 + Math.cos(angle) * 18, 24 + Math.sin(angle) * 18, 4, C.outline);
    line(ctx, 24, 24, 24 + Math.cos(angle) * 18, 24 + Math.sin(angle) * 18, 2, C.leaf3);
    diamond(ctx, 24 + Math.cos(angle) * 18, 24 + Math.sin(angle) * 18, 3, C.leaf4);
  }
}

function paintRoot(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 24, 10, C.outline);
  disc(ctx, 24, 24, 7, C.leaf2);
  ring(ctx, 24, 24, 5, C.cyan1);
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = arm * Math.PI / 3;
    line(ctx, 24, 24, 24 + Math.cos(angle) * 17, 24 + Math.sin(angle) * 17, 3, C.outline);
    line(ctx, 24, 24, 24 + Math.cos(angle) * 17, 24 + Math.sin(angle) * 17, 1, C.bark2);
  }
}

function paintOak(ctx: CanvasRenderingContext2D, mature = false) {
  const radius = mature ? 16 : 12;
  disc(ctx, 24, 24, radius + 2, C.outline);
  disc(ctx, 18, 26, radius * .65, C.leaf0);
  disc(ctx, 31, 26, radius * .64, C.leaf1);
  disc(ctx, 24, 17, radius * .7, C.leaf2);
  disc(ctx, 24, 25, radius * .55, C.leaf3);
  px(ctx, 22, 23, 5, mature ? 11 : 8, C.bark1);
  if (mature) {
    px(ctx, 18, 14, 6, 3, C.leaf4);
    px(ctx, 31, 20, 5, 3, C.leaf4);
  }
}

function paintClickbait(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 24, 12, C.outline);
  diamond(ctx, 24, 24, 10, C.sun2);
  px(ctx, 20, 20, 3, 3, C.outline);
  px(ctx, 27, 20, 3, 3, C.outline);
  px(ctx, 22, 28, 7, 2, C.red1);
  for (const x of [14, 34]) line(ctx, 24, 24, x, 32, 3, C.sun1);
}

function paintDeepfake(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 25, 15, C.outline);
  disc(ctx, 21, 24, 12, C.metal2);
  disc(ctx, 31, 28, 8, C.metal1);
  px(ctx, 16, 19, 7, 4, C.cyan1);
  px(ctx, 28, 20, 5, 3, C.red2);
  px(ctx, 19, 31, 16, 3, C.metal0);
}

function paintPopup(ctx: CanvasRenderingContext2D) {
  px(ctx, 10, 11, 29, 28, C.outline);
  px(ctx, 12, 13, 25, 24, C.purple0);
  px(ctx, 12, 13, 25, 5, C.pink);
  px(ctx, 31, 14, 4, 3, C.cream);
  px(ctx, 15, 22, 17, 3, C.purple3);
  px(ctx, 17, 29, 13, 4, C.red1);
  px(ctx, 20, 30, 7, 2, C.cream);
}

function paintFragment(ctx: CanvasRenderingContext2D) {
  diamond(ctx, 24, 24, 10, C.outline);
  diamond(ctx, 24, 24, 7, C.metal2);
  px(ctx, 21, 19, 4, 4, C.cyan1);
  px(ctx, 26, 26, 4, 3, C.red1);
}

function paintCorruption(ctx: CanvasRenderingContext2D) {
  disc(ctx, 24, 24, 14, C.outline);
  disc(ctx, 24, 24, 11, C.purple0);
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = arm * Math.PI / 3 + .2;
    line(ctx, 24, 24, 24 + Math.cos(angle) * 15, 24 + Math.sin(angle) * 15, 3, C.purple1);
  }
  disc(ctx, 24, 24, 5, C.purple2);
  px(ctx, 22, 21, 4, 3, C.purple3);
}

const PAINTERS: Record<RewildPixelSpriteId, (ctx: CanvasRenderingContext2D) => void> = {
  "tree-broadleaf": (ctx) => paintTree(ctx, false),
  "tree-pine": (ctx) => paintTree(ctx, true),
  rock: paintRock,
  shrub: paintShrub,
  log: paintLog,
  fence: paintFence,
  sign: paintSign,
  "flower-cluster": paintFlowerCluster,
  "water-lilies": paintLilies,
  "grass-tuft": paintGrass,
  house: (ctx) => paintHouse(ctx, false),
  "house-damaged": (ctx) => paintHouse(ctx, true),
  datacenter: (ctx) => paintDatacenter(ctx, false),
  mainframe: (ctx) => paintDatacenter(ctx, true),
  "plant-sunbloom": paintSunbloom,
  "plant-thornbramble": paintThorn,
  "plant-sporecap": paintSpore,
  "plant-vinewhip": paintVine,
  "plant-rootreclaimer": paintRoot,
  "plant-elderoak": (ctx) => paintOak(ctx, false),
  "plant-elderoak-mature": (ctx) => paintOak(ctx, true),
  "enemy-clickbait": paintClickbait,
  "enemy-deepfake": paintDeepfake,
  "enemy-popup": paintPopup,
  "enemy-fragment": paintFragment,
  "corruption-node": paintCorruption,
};

let cachedAtlas: HTMLCanvasElement | null = null;

export function createRewildPixelAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = REWILD_PIXEL_ATLAS_WIDTH;
  canvas.height = REWILD_PIXEL_ATLAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Rewild pixel atlas requires a 2D canvas context.");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const id of REWILD_PIXEL_SPRITE_IDS) {
    const frame = REWILD_PIXEL_ATLAS_FRAMES[id];
    ctx.save();
    ctx.translate(frame.x, frame.y);
    PAINTERS[id](ctx);
    ctx.restore();
  }
  return canvas;
}

function pixelAtlas() {
  if (!cachedAtlas) cachedAtlas = createRewildPixelAtlas();
  return cachedAtlas;
}

export function drawRewildSprite(
  ctx: CanvasRenderingContext2D,
  id: RewildPixelSpriteId,
  x: number,
  y: number,
  options: RewildSpriteDrawOptions = {},
) {
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
  ctx.drawImage(pixelAtlas(), frame.x, frame.y, frame.width, frame.height, -Math.round(width / 2), -Math.round(height / 2), width, height);
  ctx.restore();
}

export function spriteForPlant(kind: PlantKind, mature = false): RewildPixelSpriteId {
  if (kind === "elderoak") return mature ? "plant-elderoak-mature" : "plant-elderoak";
  return `plant-${kind}` as RewildPixelSpriteId;
}

export function spriteForEnemy(kind: EnemyKind): RewildPixelSpriteId {
  return `enemy-${kind}` as RewildPixelSpriteId;
}
