"use client";

import { useEffect, useRef, useState } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  ENEMIES,
  HEX_COLS,
  HEX_HEIGHT,
  HEX_ROWS,
  HEX_SIZE,
  PLANTS,
  PLANT_ORDER,
  cellAt,
  createGameState,
  createReviewGameState,
  facilityOperational,
  facilityStage,
  hexCenter,
  hexDistance,
  hexLine,
  hexPolygon,
  inspectHex,
  objectCorruption,
  pixelToHex,
  placePlant,
  moveCursor,
  toUi,
  updateGame,
  type DataNode,
  type Difficulty,
  type EnemyEntity,
  type EnemyKind,
  type GameState,
  type FacilityRuin,
  type HexCell,
  type HexCoord,
  type HexWorld,
  type PixelPoint,
  type PlantEntity,
  type PlantKind,
  type RewildReviewState,
  type UiSnapshot,
  type WorldObject,
} from "./rewild-hex-world";
import { REWILD_ATLASES, atlasFrame, type RewildAtlasId } from "./rewild-atlases";

const STORAGE_KEY = "gimmejob.rewild.best.v1";
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;
const REVIEW_STATES = new Set<RewildReviewState>(["damage", "collapse", "reclamation", "ecosystem"]);

function requestedReviewState() {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("rewildReview") as RewildReviewState | null;
  return requested && REVIEW_STATES.has(requested) ? requested : null;
}

interface Camera { x: number; y: number; zoom: number }
function createCamera(): Camera { return { x: 0, y: 0, zoom: 1 }; }
function clampCamera(camera: Camera) {
  const viewWidth = CANVAS_WIDTH / camera.zoom;
  const viewHeight = CANVAS_HEIGHT / camera.zoom;
  const slackX = Math.max(0, CANVAS_WIDTH - viewWidth);
  const slackY = Math.max(0, CANVAS_HEIGHT - viewHeight);
  camera.x = slackX > 0 ? Math.min(Math.max(camera.x, 0), slackX) : (CANVAS_WIDTH - viewWidth) / 2;
  camera.y = slackY > 0 ? Math.min(Math.max(camera.y, 0), slackY) : (CANVAS_HEIGHT - viewHeight) / 2;
}

function toCanvasPixel(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const bounds = canvas.getBoundingClientRect();
  const sceneRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  const boxRatio = bounds.width / bounds.height;
  const renderedWidth = boxRatio > sceneRatio ? bounds.width : bounds.height * sceneRatio;
  const renderedHeight = boxRatio > sceneRatio ? bounds.width / sceneRatio : bounds.height;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;
  return { x: clientX - bounds.left - offsetX, y: clientY - bounds.top - offsetY, renderedWidth, renderedHeight };
}

const SPRITE_FILES: Record<string, string> = {
  "terrain-shrub-1": "/rewild/terrain-shrub-1.png", "terrain-shrub-2": "/rewild/terrain-shrub-2.png",
  "terrain-flowers-1": "/rewild/terrain-flowers-1.png", "terrain-flowers-2": "/rewild/terrain-flowers-2.png",
  "terrain-pond-1": "/rewild/terrain-pond-1.png", "terrain-pond-2": "/rewild/terrain-pond-2.png",
  "terrain-rock-1": "/rewild/terrain-rock-1.png", "terrain-rock-2": "/rewild/terrain-rock-2.png",
  "obj-tree-deciduous": "/rewild/obj-tree-deciduous.png", "obj-tree-pine": "/rewild/obj-tree-pine.png",
  "obj-house": "/rewild/obj-house-v2.png", "obj-sunbloom": "/rewild/obj-sunbloom.png", "obj-thornbramble": "/rewild/obj-thornbramble.png",
  "obj-vinewhip": "/rewild/obj-vinewhip.png", "obj-sporecap": "/rewild/obj-sporecap.png", "obj-rootreclaimer": "/rewild/obj-rootreclaimer.png",
  "obj-elderoak-p1": "/rewild/obj-elderoak-p1.png", "obj-elderoak-p2": "/rewild/obj-elderoak-p2.png",
  "obj-server": "/rewild/obj-server.png", "obj-mainframe": "/rewild/obj-mainframe.png",
  "obj-swarm": "/rewild/obj-swarm.png", "obj-sludge": "/rewild/obj-sludge.png", "obj-popup": "/rewild/obj-popup.png", "obj-fragment": "/rewild/obj-fragment.png",
  "decal-tuft": "/rewild/decal-tuft.png", "decal-flower": "/rewild/decal-flower.png", "decal-pebble": "/rewild/decal-pebble.png",
  "decal-leaf": "/rewild/decal-leaf.png", "decal-mushroom": "/rewild/decal-mushroom.png",
};

interface SpriteMeta { pivotY: number; footprint: number }
const DEFAULT_SPRITE_META: SpriteMeta = { pivotY: .88, footprint: 1 };
const SPRITE_META: Record<string, SpriteMeta> = {
  "obj-house": { pivotY: .88, footprint: 3.1 }, "obj-sunbloom": { pivotY: .92, footprint: 1.3 },
  "obj-thornbramble": { pivotY: .88, footprint: 1.05 }, "obj-sporecap": { pivotY: .9, footprint: 1.15 },
  "obj-vinewhip": { pivotY: .88, footprint: 1.25 }, "obj-rootreclaimer": { pivotY: .9, footprint: .95 },
  "obj-elderoak-p1": { pivotY: .9, footprint: 1.4 }, "obj-elderoak-p2": { pivotY: .92, footprint: 2.3 },
  "obj-server": { pivotY: .92, footprint: 1.3 }, "obj-mainframe": { pivotY: .92, footprint: 1.75 },
  "obj-swarm": { pivotY: .84, footprint: .95 }, "obj-sludge": { pivotY: .84, footprint: 1.05 },
  "obj-popup": { pivotY: .9, footprint: 1.3 }, "obj-fragment": { pivotY: .82, footprint: .55 },
  "obj-tree-deciduous": { pivotY: .85, footprint: 3.5 }, "obj-tree-pine": { pivotY: .91, footprint: 3.3 },
};

const spriteCache = new Map<string, HTMLImageElement>();
function getSprite(key: string) {
  const path = SPRITE_FILES[key];
  let image = spriteCache.get(path);
  if (!image) {
    image = new window.Image();
    image.src = path;
    spriteCache.set(path, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}
function getImage(path: string) {
  let image = spriteCache.get(path);
  if (!image) {
    image = new window.Image();
    image.src = path;
    spriteCache.set(path, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}
function preloadSprites() {
  for (const key of Object.keys(SPRITE_FILES)) getSprite(key);
  for (const atlas of Object.values(REWILD_ATLASES)) getImage(atlas.image);
}

interface AtlasDrawOptions { width: number; rotation?: number; alpha?: number; flip?: boolean; pivotX?: number; pivotY?: number }
function drawAtlasFrame(ctx: CanvasRenderingContext2D, atlasId: RewildAtlasId, name: string, x: number, y: number, options: AtlasDrawOptions) {
  const atlas = REWILD_ATLASES[atlasId];
  const source = atlasFrame(atlasId, name);
  const image = getImage(atlas.image);
  const width = options.width;
  const height = width * source.frame.height / source.frame.width;
  const pivotX = options.pivotX ?? source.pivot.x;
  const pivotY = options.pivotY ?? source.pivot.y;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.translate(Math.round(x), Math.round(y));
  if (options.rotation) ctx.rotate(options.rotation);
  if (options.flip) ctx.scale(-1, 1);
  if (image) ctx.drawImage(image, source.frame.x, source.frame.y, source.frame.width, source.frame.height, -width * pivotX, -height * pivotY, width, height);
  else { ctx.fillStyle = "#3f484d"; ctx.fillRect(-width * pivotX, -height * pivotY, width, height); }
  ctx.restore();
  return { left: x - width * pivotX, top: y - height * pivotY, width, height };
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: PixelPoint[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
}

function seeded(cell: HexCell, salt: number) {
  let value = (cell.seed ^ Math.imul(salt + 1, 2654435761)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519) >>> 0;
  return (value ^ (value >>> 13)) / 0xffffffff;
}

function drawSprite(ctx: CanvasRenderingContext2D, key: string, x: number, groundY: number, scale = 1, flip = false) {
  const image = getSprite(key);
  const meta = SPRITE_META[key] ?? DEFAULT_SPRITE_META;
  const width = HEX_HEIGHT * meta.footprint * scale;
  const height = image ? width * image.naturalHeight / image.naturalWidth : width;
  const left = x - width / 2;
  const top = groundY - height * meta.pivotY;
  if (image) {
    ctx.save();
    if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(image, -width / 2, top, width, height); }
    else ctx.drawImage(image, left, top, width, height);
    ctx.restore();
  } else {
    ctx.fillStyle = "#53663d";
    ctx.fillRect(Math.round(left), Math.round(top), Math.round(width), Math.round(height));
  }
  return { left, top, width, height };
}

function plantSpriteKey(plant: PlantEntity | PlantKind) {
  const kind = typeof plant === "string" ? plant : plant.kind;
  if (kind === "elderoak" && typeof plant !== "string" && plant.age >= 15) return "obj-elderoak-p2";
  return kind === "elderoak" ? "obj-elderoak-p1" : `obj-${kind}`;
}
function enemySpriteKey(kind: EnemyKind) {
  return kind === "clickbait" ? "obj-swarm" : kind === "deepfake" ? "obj-sludge" : kind === "popup" ? "obj-popup" : "obj-fragment";
}

function drawMeadow(ctx: CanvasRenderingContext2D, world: HexWorld) {
  ctx.fillStyle = "#709b3d";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const macroPatches = [
    { x: 170, y: 90, rx: 270, ry: 155, color: "rgba(137,168,64,.22)" },
    { x: 940, y: 145, rx: 310, ry: 190, color: "rgba(79,130,50,.17)" },
    { x: 310, y: 545, rx: 360, ry: 170, color: "rgba(83,129,45,.15)" },
    { x: 880, y: 555, rx: 330, ry: 180, color: "rgba(157,169,62,.1)" },
  ];
  for (const patch of macroPatches) {
    const gradient = ctx.createRadialGradient(patch.x, patch.y, 0, patch.x, patch.y, patch.rx);
    gradient.addColorStop(0, patch.color);
    gradient.addColorStop(1, "rgba(112,155,61,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.ellipse(patch.x, patch.y, patch.rx, patch.ry, -.08, 0, Math.PI * 2); ctx.fill();
  }
  for (const cell of world.cells.values()) {
    if (cell.surface === "water" || cell.surface === "foundation" || cell.surface === "house") continue;
    const center = hexCenter(cell.hex);
    if (cell.detail < .27 || cell.readability > .72) continue;
    const count = cell.detail > .68 ? 3 : 1;
    for (let detail = 0; detail < count; detail += 1) {
      const x = Math.round(center.x - 17 + seeded(cell, 10 + detail) * 34);
      const y = Math.round(center.y - 12 + seeded(cell, 20 + detail) * 24);
      ctx.fillStyle = seeded(cell, 30 + detail) > .7 ? "#b6b452" : "#416e34";
      ctx.fillRect(x, y, 2, 1);
      ctx.fillRect(x + 1, y - 2, 1, 2);
    }
  }
}

function roadPath(ctx: CanvasRenderingContext2D, world: HexWorld) {
  const points = world.road.points.map(hexCenter);
  ctx.beginPath();
  ctx.moveTo(-30, points[0].y);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    if (!next) { ctx.lineTo(CANVAS_WIDTH + 30, point.y); break; }
    const middleX = (point.x + next.x) / 2;
    const middleY = (point.y + next.y) / 2;
    ctx.quadraticCurveTo(point.x, point.y, middleX, middleY);
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, world: HexWorld) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  roadPath(ctx, world);
  ctx.strokeStyle = "#617c39";
  ctx.lineWidth = 38;
  ctx.stroke();
  roadPath(ctx, world);
  ctx.strokeStyle = "#9e804f";
  ctx.lineWidth = 29;
  ctx.stroke();
  roadPath(ctx, world);
  ctx.strokeStyle = "rgba(221,190,113,.26)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 11]);
  ctx.stroke();
  ctx.restore();
}

function drawCorruption(ctx: CanvasRenderingContext2D, state: GameState) {
  const corrupted = [...state.world.cells.values()].filter((cell) => cell.corruption > 0);
  for (const cell of corrupted) {
    const center = hexCenter(cell.hex);
    const stateFrame = ["", "healthy-stressed-transition", "stressed-exposed-transition", "exposed-cracked-transition", "cracked-sludge-transition"][cell.corruption];
    const width = 82 + cell.corruption * 5;
    drawAtlasFrame(ctx, "facilityGround", stateFrame, center.x + (seeded(cell, 41) - .5) * 8, center.y + 4 + (seeded(cell, 42) - .5) * 5, {
      width,
      flip: seeded(cell, 43) > .5,
      alpha: cell.corruption === 1 ? .84 : .96,
      pivotY: .52,
    });
    if (cell.surface === "road") drawAtlasFrame(ctx, "worldConnections", cell.corruption >= 3 ? "road-crack-branched" : "road-crack", center.x, center.y + 4, { width: 67, pivotY: .52, flip: seeded(cell, 46) > .5 });
  }
}

function drawGrounding(ctx: CanvasRenderingContext2D, object: WorldObject, state: GameState) {
  const center = hexCenter(object.anchor);
  const corruption = objectCorruption(state, object);
  if (object.kind === "house") {
    ctx.fillStyle = "rgba(121,91,54,.74)";
    ctx.beginPath();
    ctx.moveTo(center.x - 47, center.y - 9); ctx.lineTo(center.x + 37, center.y - 12); ctx.lineTo(center.x + 51, center.y + 11);
    ctx.lineTo(center.x + 26, center.y + 25); ctx.lineTo(center.x - 35, center.y + 22); ctx.lineTo(center.x - 53, center.y + 7); ctx.closePath(); ctx.fill();
    const roadPoint = state.world.road.cells.reduce((closest, roadCell) => hexDistance(roadCell, object.anchor) < hexDistance(closest, object.anchor) ? roadCell : closest);
    const roadCenter = hexCenter(roadPoint);
    ctx.strokeStyle = "rgba(168,129,70,.84)"; ctx.lineCap = "round"; ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(center.x + 30, center.y + 12); ctx.quadraticCurveTo(center.x + 62, center.y + 22, roadCenter.x, roadCenter.y); ctx.stroke();
    ctx.fillStyle = "#8b6a3d";
    for (let plot = 0; plot < 3; plot += 1) ctx.fillRect(center.x - 45 + plot * 15, center.y + 17, 10, 5);
    return;
  }
  if (object.kind === "tree" || object.kind === "pine") {
    ctx.fillStyle = corruption ? "rgba(51,52,38,.55)" : "rgba(67,99,39,.46)";
    ctx.beginPath(); ctx.ellipse(center.x, center.y + 8, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = corruption >= 2 ? "#504454" : "#547237";
    ctx.lineWidth = 3;
    for (let root = -1; root <= 1; root += 1) {
      ctx.beginPath(); ctx.moveTo(center.x, center.y + 4); ctx.lineTo(center.x + root * 24 + (root ? 8 : 3), center.y + 15); ctx.stroke();
    }
  } else if (object.kind === "rock") {
    ctx.fillStyle = "rgba(59,86,42,.48)"; ctx.beginPath(); ctx.ellipse(center.x, center.y + 8, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSimpleProp(ctx: CanvasRenderingContext2D, object: WorldObject) {
  const center = hexCenter(object.anchor);
  if (object.kind === "log") {
    ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(object.rotation ?? 0); ctx.fillStyle = "#704b2e"; ctx.fillRect(-27, -6, 54, 12); ctx.fillStyle = "#b08049"; ctx.fillRect(-22, -4, 41, 3); ctx.restore();
  } else if (object.kind === "sign") {
    ctx.fillStyle = "#66472f"; ctx.fillRect(center.x - 2, center.y - 23, 4, 27); ctx.fillStyle = "#a87543"; ctx.fillRect(center.x - 14, center.y - 25, 28, 12); ctx.fillStyle = "#d7a65f"; ctx.fillRect(center.x - 10, center.y - 22, 20, 2);
  } else if (object.kind === "ruin") {
    ctx.fillStyle = "#5f665e"; ctx.fillRect(center.x - 23, center.y - 7, 14, 11); ctx.fillRect(center.x + 7, center.y - 18, 13, 22); ctx.fillStyle = "#929687"; ctx.fillRect(center.x - 20, center.y - 11, 10, 4); ctx.fillRect(center.x + 9, center.y - 22, 10, 5);
  } else if (object.kind === "fence") {
    ctx.strokeStyle = "#6b4b30"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(center.x - 44, center.y); ctx.lineTo(center.x + 44, center.y); ctx.stroke();
    ctx.fillStyle = "#8f653a"; for (let x = -40; x <= 40; x += 20) ctx.fillRect(center.x + x - 2, center.y - 13, 5, 21);
  }
}

function drawWorldObject(ctx: CanvasRenderingContext2D, object: WorldObject, state: GameState) {
  const center = hexCenter(object.anchor);
  drawGrounding(ctx, object, state);
  if (!object.sprite) { drawSimpleProp(ctx, object); return; }
  if (object.shadow && object.kind !== "house") {
    ctx.fillStyle = "rgba(28,48,29,.2)";
    ctx.beginPath(); ctx.ellipse(center.x + 4, center.y + 8, HEX_HEIGHT * object.width * .18, HEX_HEIGHT * object.width * .07, -.08, 0, Math.PI * 2); ctx.fill();
  }
  const box = drawSprite(ctx, object.sprite, center.x, center.y + 8, object.width / (SPRITE_META[object.sprite]?.footprint ?? 1));
  const corruption = objectCorruption(state, object);
  if (corruption >= 2 && (object.kind === "tree" || object.kind === "pine" || object.kind === "shrub" || object.kind === "flowers")) {
    ctx.fillStyle = corruption >= 4 ? "rgba(38,31,45,.36)" : "rgba(75,62,58,.22)";
    ctx.fillRect(box.left, box.top, box.width, box.height);
    ctx.strokeStyle = "#674e72"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(center.x - 5, center.y); ctx.lineTo(center.x - 11, center.y - box.height * .44); ctx.lineTo(center.x - 3, center.y - box.height * .68); ctx.stroke();
  }
  if (object.kind === "pond") {
    const contaminated = [...state.world.cells.values()]
      .filter((cell) => cell.corruption >= 2 && object.footprint.some((pondCell) => hexDistance(pondCell, cell.hex) <= 2))
      .sort((left, right) => right.corruption - left.corruption)[0];
    if (contaminated) {
      const source = hexCenter(contaminated.hex);
      const angle = Math.atan2(source.y - center.y, source.x - center.x);
      const shorelineX = center.x + Math.cos(angle) * 46;
      const shorelineY = center.y + Math.sin(angle) * 25 + 4;
      drawAtlasFrame(ctx, "worldConnections", "shoreline-polluted-outlet", shorelineX, shorelineY, { width: 86, rotation: angle * .3, pivotY: .52 });
    }
  }
  if (object.kind === "house" && state.houseHp < DIFFICULTIES[state.difficulty].houseHp * .7) {
    const ratio = Math.max(0, state.houseHp / DIFFICULTIES[state.difficulty].houseHp);
    ctx.strokeStyle = ratio > .35 ? "#704b36" : "#45383a"; ctx.lineWidth = ratio > .35 ? 2 : 4;
    ctx.beginPath(); ctx.moveTo(center.x - 19, center.y - 22); ctx.lineTo(center.x - 7, center.y - 7); ctx.lineTo(center.x - 16, center.y + 5); ctx.stroke();
    if (ratio <= .35) drawAtlasFrame(ctx, "worldConnections", "concrete-damaged-seam", center.x + 7, center.y + 20, { width: 72, pivotY: .55 });
  }
}

function footprintBounds(footprint: HexCoord[]) {
  const centers = footprint.map(hexCenter);
  return {
    left: Math.min(...centers.map((point) => point.x)) - HEX_SIZE,
    right: Math.max(...centers.map((point) => point.x)) + HEX_SIZE,
    top: Math.min(...centers.map((point) => point.y)) - HEX_HEIGHT / 2,
    bottom: Math.max(...centers.map((point) => point.y)) + HEX_HEIGHT / 2,
  };
}

function drawFacilityGround(ctx: CanvasRenderingContext2D, node: DataNode) {
  const stage = facilityStage(node);
  const bounds = footprintBounds(node.footprint);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2 + 9;
  const frames = ["survey-stakes", "excavation", "concrete-footings", "concrete-apron"];
  drawAtlasFrame(ctx, "facilityGround", frames[stage], centerX, centerY, { width: node.boss ? 310 : 182, pivotY: .52 });
  if (stage >= 1 && stage < 3) drawAtlasFrame(ctx, "facilityGround", stage === 1 ? "compacted-substrate" : "active-cable-trench", centerX + (node.boss ? 78 : 44), centerY + 7, { width: node.boss ? 155 : 90, alpha: .93, pivotY: .52 });
}

interface FacilityModule { frame: string; x: number; y: number; width: number; depth: number; flip?: boolean }

function facilityModules(node: DataNode): FacilityModule[] {
  const center = hexCenter(node.anchor);
  const stage = facilityStage(node);
  const inward = node.anchor.q > HEX_COLS / 2 ? -1 : 1;
  const at = (offset: number) => center.x + offset * inward;
  if (stage === 0) return [];
  if (stage === 1) return [
    { frame: "wall-straight", x: at(-28), y: center.y + 4, width: node.boss ? 92 : 72, depth: center.y + 4, flip: inward < 0 },
    { frame: "utility-crates", x: at(38), y: center.y + 17, width: 58, depth: center.y + 17, flip: inward < 0 },
  ];
  const size = node.boss ? 1.24 : 1;
  const modules: FacilityModule[] = [
    { frame: "wall-corner", x: at(-65 * size), y: center.y - 20 * size, width: 80 * size, depth: center.y - 20 * size, flip: inward < 0 },
    { frame: "server-hall-body", x: at(-17 * size), y: center.y + 5 * size, width: 88 * size, depth: center.y + 5 * size, flip: inward < 0 },
    { frame: "cooling-fan-bank", x: at(51 * size), y: center.y + 2 * size, width: 84 * size, depth: center.y + 2 * size, flip: inward < 0 },
    { frame: "loading-bay", x: at(-59 * size), y: center.y + 39 * size, width: 76 * size, depth: center.y + 39 * size, flip: inward < 0 },
    { frame: "access-door", x: at(10 * size), y: center.y + 48 * size, width: 68 * size, depth: center.y + 48 * size, flip: inward < 0 },
    { frame: "transformer-power", x: at(72 * size), y: center.y + 43 * size, width: 72 * size, depth: center.y + 43 * size, flip: inward < 0 },
    { frame: "utility-crates", x: at(-12 * size), y: center.y + 66 * size, width: 52 * size, depth: center.y + 66 * size, flip: inward < 0 },
  ];
  if (stage === 3) modules.push(
    { frame: "fence-straight", x: at(-90 * size), y: center.y + 62 * size, width: 70 * size, depth: center.y + 62 * size, flip: inward < 0 },
    { frame: "security-gate", x: at(58 * size), y: center.y + 77 * size, width: 75 * size, depth: center.y + 77 * size, flip: inward < 0 },
    { frame: "cable-entry-cabinet", x: at(102 * size), y: center.y + 69 * size, width: 56 * size, depth: center.y + 69 * size, flip: inward < 0 },
  );
  return modules;
}

function damagedFacilityModules(node: DataNode) {
  const modules = facilityModules(node);
  const ratio = Math.max(0, node.hp / node.maxHp);
  if (ratio > .72) return modules;
  const disabledFrames = new Set(ratio <= .2 ? ["cooling-fan-bank", "transformer-power", "cable-entry-cabinet", "utility-crates"] : ratio <= .45 ? ["cooling-fan-bank", "transformer-power"] : ["utility-crates"]);
  return modules.map((facilityModule, index) => disabledFrames.has(facilityModule.frame)
    ? { ...facilityModule, frame: index % 2 ? "damaged-wall-rubble" : "concrete-barriers", y: facilityModule.y + 7, width: facilityModule.width * .9 }
    : facilityModule);
}

function drawNodeConnections(ctx: CanvasRenderingContext2D, node: DataNode, state: GameState) {
  const stage = facilityStage(node);
  if (stage < 2) return;
  const start = hexCenter(node.anchor);
  const outlet = hexCenter(node.outlet);
  const roadCell = state.world.road.cells.reduce((closest, roadHex) => hexDistance(roadHex, node.outlet) < hexDistance(closest, node.outlet) ? roadHex : closest);
  const routeTarget = stage === 3 && hexDistance(roadCell, node.outlet) <= 4 ? roadCell : node.outlet;
  const cableCells = hexLine(node.anchor, routeTarget).map(hexCenter);
  const operational = facilityOperational(node);
  for (let index = 1; index < cableCells.length; index += 1) {
    const from = cableCells[index - 1];
    const to = cableCells[index];
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const broken = !operational && index === cableCells.length - 1;
    drawAtlasFrame(ctx, "worldConnections", broken ? "cable-broken" : Math.abs(angle) < .3 ? "cable-straight" : "cable-diagonal", (from.x + to.x) / 2, (from.y + to.y) / 2, { width: 62, rotation: angle, pivotY: .5 });
  }
  drawAtlasFrame(ctx, "worldConnections", operational && stage === 3 ? "drain-polluting" : "drain-clean", outlet.x, outlet.y + 7, { width: 61, pivotY: .55 });
  if (hexDistance(roadCell, node.outlet) <= 3) { const crossing = hexCenter(roadCell); drawAtlasFrame(ctx, "worldConnections", "road-cable-crossing", crossing.x, crossing.y + 3, { width: 72, pivotY: .52 }); }
  if (operational && stage === 3) drawAtlasFrame(ctx, "datacenter", "polluted-drain-outlet", start.x + 92, start.y + 75, { width: 57 });
}

function drawNode(ctx: CanvasRenderingContext2D, node: DataNode) {
  const bounds = footprintBounds(node.footprint);
  const center = hexCenter(node.anchor);
  for (const facilityModule of damagedFacilityModules(node).sort((left, right) => left.depth - right.depth)) drawAtlasFrame(ctx, "datacenter", facilityModule.frame, facilityModule.x, facilityModule.y, { width: facilityModule.width, flip: facilityModule.flip });
  if (node.hp / node.maxHp <= .45) {
    drawAtlasFrame(ctx, "worldConnections", "concrete-damaged-seam", center.x - 15, center.y + 49, { width: 89, pivotY: .55, flip: node.anchor.q % 2 === 0 });
    if (!facilityOperational(node)) drawAtlasFrame(ctx, "worldConnections", "rebar-seam", center.x + 38, center.y + 55, { width: 72, pivotY: .55 });
  }
  if (node.hp < node.maxHp) drawHealth(ctx, center.x - 34, bounds.top - 23, 68, node.hp / node.maxHp);
}

function drawRuinConnections(ctx: CanvasRenderingContext2D, ruin: FacilityRuin, state: GameState) {
  const remainingCells = ruin.footprint.filter((hex) => cellAt(state.world, hex)?.surface === "rubble").map(hexCenter);
  const start = remainingCells.length ? { x: remainingCells.reduce((total, point) => total + point.x, 0) / remainingCells.length, y: remainingCells.reduce((total, point) => total + point.y, 0) / remainingCells.length } : hexCenter(ruin.anchor);
  const outlet = hexCenter(ruin.outlet);
  const route = hexLine(ruin.anchor, ruin.outlet).map(hexCenter);
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1]; const to = route[index];
    drawAtlasFrame(ctx, "worldConnections", index === route.length - 1 ? "cable-broken" : "cable-straight", (from.x + to.x) / 2, (from.y + to.y) / 2, { width: 62, rotation: Math.atan2(to.y - from.y, to.x - from.x), pivotY: .5 });
  }
  drawAtlasFrame(ctx, "worldConnections", "drain-clean", outlet.x, outlet.y + 7, { width: 61, pivotY: .55 });
  drawAtlasFrame(ctx, "datacenter", "damaged-wall-rubble", start.x, start.y + 49, { width: ruin.boss ? 150 : 105 });
  if (remainingCells.length > 1) drawAtlasFrame(ctx, "worldConnections", "rebar-seam", start.x + 46, start.y + 58, { width: 75, pivotY: .55 });
}

function drawRubble(ctx: CanvasRenderingContext2D, cell: HexCell) {
  const center = hexCenter(cell.hex);
  const recovering = cell.corruption <= 1;
  drawAtlasFrame(ctx, "facilityGround", recovering ? "early-reclamation" : "damaged-slab-sludge", center.x, center.y + 5, { width: 70, pivotY: .52, flip: seeded(cell, 77) > .5 });
  if (!recovering) drawAtlasFrame(ctx, "worldConnections", "rubble-seam", center.x + 7, center.y + 11, { width: 46, pivotY: .55, alpha: .92 });
}

function drawHealth(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, ratio: number) {
  ctx.fillStyle = "rgba(20,27,23,.78)"; ctx.fillRect(Math.round(x), Math.round(y), width, 5);
  ctx.fillStyle = ratio > .55 ? "#77ac59" : ratio > .25 ? "#d0a94b" : "#c35a49"; ctx.fillRect(Math.round(x + 1), Math.round(y + 1), Math.max(0, Math.round((width - 2) * ratio)), 3);
}

function drawPlant(ctx: CanvasRenderingContext2D, plant: PlantEntity, state: GameState) {
  const center = hexCenter(plant);
  const cell = cellAt(state.world, plant)!;
  ctx.fillStyle = plant.kind === "rootreclaimer" ? "rgba(67,91,57,.55)" : "rgba(63,100,43,.45)";
  ctx.beginPath(); ctx.ellipse(center.x, center.y + 6, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (plant.kind === "rootreclaimer" && (cell.corruption > 0 || plant.reclaimUntil > state.elapsed)) {
    const target = plant.reclaimTarget ? hexCenter(plant.reclaimTarget) : center;
    const route = hexLine(plant, plant.reclaimTarget ?? plant).map(hexCenter);
    for (let index = 1; index < route.length; index += 1) {
      const from = route[index - 1]; const to = route[index];
      drawAtlasFrame(ctx, "worldConnections", index % 2 ? "roots-bend" : "roots-straight", (from.x + to.x) / 2, (from.y + to.y) / 2, { width: 68, rotation: Math.atan2(to.y - from.y, to.x - from.x), pivotY: .5 });
    }
    drawAtlasFrame(ctx, "worldConnections", "roots-reclaiming", target.x, target.y + 8, { width: 78, pivotY: .55 });
  }
  const box = drawSprite(ctx, plantSpriteKey(plant), center.x, center.y + 7);
  if (plant.attackTarget && plant.attackUntil > state.elapsed) {
    const target = hexCenter(plant.attackTarget);
    ctx.strokeStyle = "rgba(224,231,145,.8)"; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(center.x, center.y - 8); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]);
  }
  drawHealth(ctx, center.x - 16, box.top - 7, 32, plant.hp / PLANTS[plant.kind].maxHp);
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity) {
  const box = drawSprite(ctx, enemySpriteKey(enemy.kind), enemy.position.x, enemy.position.y + 7);
  drawHealth(ctx, enemy.position.x - 14, box.top - 7, 28, enemy.hp / enemy.maxHp);
}

function drawEffects(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const beam of state.beams) {
    ctx.globalAlpha = Math.max(0, beam.life / beam.maxLife);
    ctx.strokeStyle = beam.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(beam.from.x, beam.from.y); ctx.lineTo(beam.to.x, beam.to.y); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const effect of state.effects) {
    const progress = 1 - effect.life / effect.maxLife;
    const alpha = Math.sin(Math.PI * Math.min(1, progress));
    ctx.save(); ctx.globalAlpha = alpha;
    if (effect.kind === "impact" || effect.kind === "shutdown") {
      ctx.fillStyle = effect.kind === "shutdown" ? "#c8d0ba" : "#e7c368";
      for (let spark = 0; spark < 5; spark += 1) {
        const angle = spark * 1.27 + effect.seed * .17;
        const distance = 8 + progress * 25;
        ctx.fillRect(Math.round(effect.position.x + Math.cos(angle) * distance), Math.round(effect.position.y + Math.sin(angle) * distance), 3, 2);
      }
    } else {
      ctx.fillStyle = effect.kind === "reclaim" ? "#9bc875" : "#8a7458";
      const radius = 10 + progress * (effect.kind === "collapse" ? 58 : 34);
      for (let mote = 0; mote < 7; mote += 1) {
        const angle = mote * .9 + effect.seed * .13;
        ctx.fillRect(Math.round(effect.position.x + Math.cos(angle) * radius), Math.round(effect.position.y + Math.sin(angle) * radius * .45), 4, 3);
      }
    }
    ctx.restore();
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, state: GameState) {
  const polygon = hexPolygon(state.cursor, .85);
  tracePolygon(ctx, polygon);
  const canPlace = inspectHex(state, state.cursor).valid;
  ctx.fillStyle = canPlace ? "rgba(177,222,116,.12)" : "rgba(220,104,83,.1)";
  ctx.fill();
  ctx.strokeStyle = canPlace ? "#c8e882" : "#dc745f";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function renderGame(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  drawMeadow(ctx, state.world);
  drawRoad(ctx, state.world);
  for (const node of state.nodes) drawFacilityGround(ctx, node);
  drawCorruption(ctx, state);
  for (const node of state.nodes) drawNodeConnections(ctx, node, state);
  for (const ruin of state.ruins) drawRuinConnections(ctx, ruin, state);
  for (const cell of state.world.cells.values()) if (cell.surface === "rubble") drawRubble(ctx, cell);

  const underConstruction = (object: WorldObject) => [...state.nodes, ...state.ruins].some((facility) => object.footprint.some((cell) => facility.footprint.some((facilityCell) => facilityCell.q === cell.q && facilityCell.r === cell.r && cellAt(state.world, facilityCell)?.surface !== "meadow")));
  const underlays = state.world.objects.filter((object) => (object.kind === "pond" || object.kind === "flowers") && !underConstruction(object));
  for (const object of underlays) drawWorldObject(ctx, object, state);
  const renderables = [
    ...state.world.objects.filter((object) => object.kind !== "pond" && object.kind !== "flowers" && !underConstruction(object)).map((object) => ({ depth: hexCenter(object.anchor).y, draw: () => drawWorldObject(ctx, object, state) })),
    ...state.plants.map((plant) => ({ depth: hexCenter(plant).y, draw: () => drawPlant(ctx, plant, state) })),
    ...state.nodes.map((node) => ({ depth: footprintBounds(node.footprint).bottom, draw: () => drawNode(ctx, node) })),
    ...state.enemies.map((enemy) => ({ depth: enemy.position.y, draw: () => drawEnemy(ctx, enemy) })),
  ].sort((left, right) => left.depth - right.depth);
  for (const renderable of renderables) renderable.draw();
  drawEffects(ctx, state);
  if (state.status === "playing") drawCursor(ctx, state);
  ctx.restore();
}

function SpriteIcon({ spriteKey }: { spriteKey: string }) { return <img src={SPRITE_FILES[spriteKey]} alt="" aria-hidden="true"/>; }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }

function RewildGuide({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="kb-content rw-page">
      <header className="rw-guide-head"><span>ANTI-SLOP FIELD MANUAL / 02</span><h1>How to fight AI slop</h1><p>The field now runs on an invisible six-direction topology. You see continuous meadow, roads, water, roots, and freestanding objects—not a board. Every action changes relationships in that living hex world.</p><button className="rw-guide-play" onClick={onPlay}>Open the battlefield</button></header>
      <section className="rw-guide-grid">
        <article><span>01</span><h2>Root</h2><p>Plant on healthy soil. Each defender occupies a real place and can redirect six-direction enemy movement.</p></article>
        <article><span>02</span><h2>Break</h2><p>Datacenters excavate irregular multi-hex compounds, connect cables, manufacture junk, and poison adjacent land.</p></article>
        <article><span>03</span><h2>Relate</h2><p>Roads conduct corruption quickly, water resists it, objects become contaminated, and roots reconnect damaged soil.</p></article>
        <article><span>04</span><h2>Reclaim</h2><p>Destroyed infrastructure remains as rubble. Rootreclaimers must heal it before the landscape becomes whole again.</p></article>
      </section>
      <section className="rw-field-guide">
        <div><span>DEFENDERS</span><h2>Weapons that grow</h2></div>
        <div className="rw-guide-list">{PLANT_ORDER.map((kind) => <article key={kind}><SpriteIcon spriteKey={plantSpriteKey(kind)}/><div><strong>{PLANTS[kind].name}</strong><span>{PLANTS[kind].role} · {PLANTS[kind].cost} sun · wave {PLANTS[kind].unlockWave}</span><p>{PLANTS[kind].detail}</p></div></article>)}</div>
      </section>
      <section className="rw-field-guide rw-enemy-guide">
        <div><span>AI SLOP</span><h2>Targets to demolish</h2></div>
        <div className="rw-guide-list">
          {(["clickbait", "deepfake", "popup"] as EnemyKind[]).map((kind) => <article key={kind}><SpriteIcon spriteKey={enemySpriteKey(kind)}/><div><strong>{ENEMIES[kind].name}</strong><span>{ENEMIES[kind].hp} HP · speed {ENEMIES[kind].speed}</span><p>{kind === "clickbait" ? "Fast attention waste moving through six-direction paths." : kind === "deepfake" ? "Slow synthetic sludge that fragments when destroyed." : "Hostile clutter that disables living defenses."}</p></div></article>)}
          <article><SpriteIcon spriteKey="obj-server"/><div><strong>AI Slop Datacenter</strong><span>150 HP · four construction states</span><p>Excavates land, lays foundations and cables, then corrupts and manufactures junk until demolished.</p></div></article>
        </div>
      </section>
    </div>
  );
}

export default function RewildGame({ onViewChange = () => {}, view = "all" }: { onViewChange?: (view: string) => void; view?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastUiRef = useRef(0);
  const cameraRef = useRef<Camera>(createCamera());
  const dragRef = useRef<{ x: number; y: number; scaleX: number; scaleY: number } | null>(null);
  const [ui, setUi] = useState<UiSnapshot>(() => toUi(createGameState(0, "normal", "menu")));
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  useEffect(() => {
    preloadSprites();
    let best = 0;
    try { best = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0) || 0; } catch { /* optional local persistence */ }
    const reviewState = requestedReviewState();
    stateRef.current = reviewState ? createReviewGameState(best, reviewState) : createGameState(best, "normal", "menu");
    setUi(toUi(stateRef.current));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    const frame = (time: number) => {
      const state = stateRef.current;
      if (state) {
        const dt = lastFrameRef.current ? Math.min(.05, (time - lastFrameRef.current) / 1000) : 0;
        lastFrameRef.current = time;
        updateGame(state, dt);
        renderGame(context, state, cameraRef.current);
        if (time - lastUiRef.current > 150) { lastUiRef.current = time; setUi(toUi(state)); }
      }
      animationRef.current = window.requestAnimationFrame(frame);
    };
    animationRef.current = window.requestAnimationFrame(frame);
    return () => { if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 2) return;
      event.preventDefault();
      const { renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
      dragRef.current = { x: event.clientX, y: event.clientY, scaleX: CANVAS_WIDTH / renderedWidth, scaleY: CANVAS_HEIGHT / renderedHeight };
    };
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const camera = cameraRef.current;
      camera.x -= (event.clientX - drag.x) * drag.scaleX / camera.zoom;
      camera.y -= (event.clientY - drag.y) * drag.scaleY / camera.zoom;
      clampCamera(camera);
      dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    };
    const onMouseUp = () => { dragRef.current = null; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      const { x, y, renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
      const canvasX = x / renderedWidth * CANVAS_WIDTH;
      const canvasY = y / renderedHeight * CANVAS_HEIGHT;
      const worldX = canvasX / camera.zoom + camera.x;
      const worldY = canvasY / camera.zoom + camera.y;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * Math.exp(-event.deltaY * .0015)));
      camera.zoom = nextZoom;
      camera.x = worldX - canvasX / nextZoom;
      camera.y = worldY - canvasY / nextZoom;
      clampCamera(camera);
    };
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("contextmenu", onContextMenu); canvas.removeEventListener("mousedown", onMouseDown); canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < PLANT_ORDER.length) {
        const kind = PLANT_ORDER[index];
        if (state.wave >= PLANTS[kind].unlockWave) { state.selected = kind; setUi(toUi(state)); }
      }
      if (event.code === "Space" && (state.status === "playing" || state.status === "paused")) {
        event.preventDefault(); state.status = state.status === "playing" ? "paused" : "playing"; setUi(toUi(state));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (view === "guide") return <RewildGuide onPlay={() => onViewChange("all")}/>;

  const start = () => {
    const best = stateRef.current?.best ?? 0;
    const reviewState = requestedReviewState();
    stateRef.current = reviewState ? createReviewGameState(best, reviewState) : createGameState(best, difficulty);
    lastFrameRef.current = 0;
    cameraRef.current = createCamera();
    setUi(toUi(stateRef.current));
  };
  const choosePlant = (kind: PlantKind) => {
    const state = stateRef.current;
    if (!state || state.wave < PLANTS[kind].unlockWave) return;
    state.selected = kind;
    setUi(toUi(state));
  };
  const togglePause = () => {
    const state = stateRef.current;
    if (!state || (state.status !== "playing" && state.status !== "paused")) return;
    state.status = state.status === "playing" ? "paused" : "playing";
    setUi(toUi(state));
  };
  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas) return;
    const { x, y, renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
    if (x < 0 || y < 0 || x >= renderedWidth || y >= renderedHeight) return;
    const camera = cameraRef.current;
    const worldX = x / renderedWidth * CANVAS_WIDTH / camera.zoom + camera.x;
    const worldY = y / renderedHeight * CANVAS_HEIGHT / camera.zoom + camera.y;
    const hex = pixelToHex(worldX, worldY);
    if (!hex) return;
    state.cursor = hex;
    placePlant(state, hex);
    setUi(toUi(state));
  };
  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.buttons !== 0) return;
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas || state.status !== "playing") return;
    const { x, y, renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
    if (x < 0 || y < 0 || x >= renderedWidth || y >= renderedHeight) return;
    const camera = cameraRef.current;
    const hex = pixelToHex(x / renderedWidth * CANVAS_WIDTH / camera.zoom + camera.x, y / renderedHeight * CANVAS_HEIGHT / camera.zoom + camera.y);
    if (!hex || (hex.q === state.cursor.q && hex.r === state.cursor.r)) return;
    state.cursor = hex;
    setUi(toUi(state));
  };
  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (!state || state.status !== "playing") return;
    const movement: Record<string, number> = { ArrowRight: 0, e: 1, ArrowDown: 2, ArrowLeft: 3, q: 4, ArrowUp: 5 };
    if (movement[event.key] !== undefined) {
      event.preventDefault(); moveCursor(state, movement[event.key]); setUi(toUi(state));
    } else if (event.key === "Enter") {
      event.preventDefault(); placePlant(state, state.cursor); setUi(toUi(state));
    }
  };

  const overlay = ui.status === "menu" || ui.status === "won" || ui.status === "lost";
  return (
    <div className="rw-play-page">
      <section className="rw-game-shell" aria-label="Fight AI slop game">
        <div className="rw-hud" aria-live="polite">
          <div className="rw-hud-brand"><span>Invisible hex world · final stand</span><strong>Fight AI slop</strong><small>{ui.best.toLocaleString()} best · {DIFFICULTIES[ui.difficulty].name}</small></div>
          <div><span>Sunlight</span><strong>{ui.sunlight}</strong></div><div><span>House</span><strong>{ui.houseIntegrity}%</strong></div><div><span>Corruption</span><strong>{ui.corruption}%</strong></div><div><span>Wave</span><strong>{ui.wave} · {ui.nextWave}s</strong></div><div><span>Score</span><strong>{ui.score.toLocaleString()}</strong></div>
        </div>
        <div className="rw-stage">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onClick={onCanvasClick} onPointerMove={onCanvasPointerMove} onKeyDown={onCanvasKeyDown} tabIndex={0} aria-label={`A ${HEX_COLS} by ${HEX_ROWS} invisible hex field under attack by AI slop. Select a plant, then click the landscape or use six-direction keys and Enter to plant. Right-drag to pan and scroll to zoom.`}/>
          {overlay && <div className={`rw-overlay rw-overlay-${ui.status}`}>
            <span>{ui.status === "menu" ? "AI INFRASTRUCTURE DETECTED" : ui.status === "won" ? "FEED TERMINATED" : "AI SLOP WON"}</span>
            <h2>{ui.status === "menu" ? "The world is alive." : ui.status === "won" ? "AI slop erased." : "The feed ate everything."}</h2>
            <p>{ui.status === "menu" ? "Defend a continuous landscape built on an invisible hex topology. Datacenters excavate, connect, manufacture, corrupt, collapse into rubble—and the rest of the world responds." : ui.message}</p>
            {ui.status !== "menu" && <div className="rw-result"><span>{ui.wave} waves</span><span>{formatTime(ui.elapsed)}</span><span>{ui.score.toLocaleString()} score</span></div>}
            <div className="rw-difficulty-picker" role="group" aria-label="Difficulty">{DIFFICULTY_ORDER.map((key) => <button type="button" className={difficulty === key ? "active" : ""} aria-pressed={difficulty === key} key={key} onClick={() => setDifficulty(key)}><strong>{DIFFICULTIES[key].name}</strong><small>{DIFFICULTIES[key].description}</small></button>)}</div>
            <div className="rw-overlay-actions"><button onClick={start}>{ui.status === "menu" ? "Enter the living field" : "Fight again"}</button></div>
          </div>}
          {ui.status === "paused" && <div className="rw-pause-card"><span>PAUSED</span><strong>The landscape is holding its breath.</strong><button onClick={togglePause}>Resume</button></div>}
          {!overlay && ui.status !== "paused" && <aside className={`rw-inspector${ui.inspection.valid ? " rw-inspector-valid" : ""}`} aria-live="polite">
            <div><span>{ui.inspection.subtitle}</span>{ui.inspection.score !== null && <b>{ui.inspection.score}</b>}</div>
            <strong>{ui.inspection.title}</strong>
            <ul>{ui.inspection.details.slice(0, 3).map((detail) => <li key={detail}>{detail}</li>)}</ul>
          </aside>}
          <div className={`rw-build-menu${overlay || ui.reviewState ? " rw-build-menu-hidden" : ""}`} aria-label="Build menu" aria-hidden={overlay || Boolean(ui.reviewState)}>
            <div className="rw-build-menu-head"><span>Grow</span></div>
            <div className="rw-plant-bar" aria-label="Plants">{PLANT_ORDER.map((kind, index) => {
              const config = PLANTS[kind]; const locked = ui.wave < config.unlockWave;
              return <button className={ui.selected === kind ? "active" : ""} disabled={locked || ui.status === "menu" || ui.status === "won" || ui.status === "lost"} aria-pressed={ui.selected === kind} key={kind} onClick={() => choosePlant(kind)}><i style={{ background: config.color }}>{locked ? "×" : index + 1}</i><span><strong>{config.shortName}</strong><small>{locked ? `Wave ${config.unlockWave}` : `${config.cost} sun`}</small></span></button>;
            })}</div>
          </div>
        </div>
        <div className="rw-status-line"><span>{ui.message}</span><small>{ui.enemies} AI slop · {ui.nodes} datacenters · {ui.plants} defenders</small></div>
        <footer className="rw-controls"><p><strong>Grow:</strong> choose 1–6, then click the landscape. Arrows plus Q/E move through six neighbors; Enter plants. Water resists corruption, roads conduct it, and roots reclaim rubble.</p><div><button onClick={() => onViewChange("guide")}>Field guide</button><button onClick={togglePause} disabled={ui.status === "menu" || ui.status === "won" || ui.status === "lost"}>{ui.status === "paused" ? "Resume" : "Pause"}</button><button onClick={start}>Restart</button></div></footer>
      </section>
    </div>
  );
}
