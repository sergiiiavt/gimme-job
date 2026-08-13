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
  facilityStage,
  hexCenter,
  hexLine,
  hexPolygon,
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
  type HexCell,
  type HexCoord,
  type HexWorld,
  type PixelPoint,
  type PlantEntity,
  type PlantKind,
  type UiSnapshot,
  type WorldObject,
} from "./rewild-hex-world";

const STORAGE_KEY = "gimmejob.rewild.best.v1";
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;

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
function preloadSprites() { for (const key of Object.keys(SPRITE_FILES)) getSprite(key); }

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
    const radius = HEX_SIZE * (.55 + cell.corruption * .11);
    ctx.fillStyle = cell.corruption === 1 ? "rgba(117,106,56,.42)" : cell.corruption === 2 ? "rgba(83,74,49,.58)" : cell.corruption === 3 ? "rgba(55,55,46,.75)" : "rgba(35,36,38,.86)";
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 3, radius * 1.18, radius * .82, seeded(cell, 41) * .5, 0, Math.PI * 2);
    ctx.fill();
    const source = cell.source === null ? null : state.nodes.find((node) => node.id === cell.source);
    if (source) {
      const sourceCenter = hexCenter(source.outlet);
      ctx.strokeStyle = cell.corruption >= 3 ? "#6c4f79" : "#66553f";
      ctx.lineWidth = cell.corruption >= 3 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo((center.x + sourceCenter.x) / 2 + (seeded(cell, 44) - .5) * 15, (center.y + sourceCenter.y) / 2);
      ctx.lineTo(sourceCenter.x, sourceCenter.y);
      ctx.stroke();
    }
    for (let fragment = 0; fragment < cell.corruption; fragment += 1) {
      const x = Math.round(center.x - 17 + seeded(cell, 50 + fragment) * 34);
      const y = Math.round(center.y - 12 + seeded(cell, 60 + fragment) * 24);
      ctx.fillStyle = fragment % 2 ? "#66517a" : "#252a2a";
      ctx.fillRect(x, y, 3 + fragment % 2, 2);
    }
  }
}

function drawGrounding(ctx: CanvasRenderingContext2D, object: WorldObject, state: GameState) {
  const center = hexCenter(object.anchor);
  const corruption = objectCorruption(state, object);
  if (object.kind === "house") {
    ctx.fillStyle = "rgba(164,126,65,.32)";
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 8, 57, 28, -.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(181,142,76,.48)";
    ctx.fillRect(center.x + 28, center.y + 6, 34, 12);
    ctx.fillStyle = "rgba(105,112,75,.72)";
    ctx.fillRect(center.x - 43, center.y + 14, 5, 3); ctx.fillRect(center.x + 43, center.y - 3, 4, 3);
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
  const bottom = bounds.bottom - 5;
  ctx.fillStyle = stage === 0 ? "rgba(127,91,52,.9)" : stage === 1 ? "rgba(91,91,82,.9)" : "rgba(69,75,73,.82)";
  ctx.beginPath();
  ctx.ellipse(centerX, bottom - 13, (bounds.right - bounds.left) * .48, node.boss ? 34 : 25, -.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stage === 0 ? "rgba(177,137,77,.9)" : "rgba(51,58,57,.82)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(centerX, bottom - 13, (bounds.right - bounds.left) * .46, node.boss ? 30 : 22, -.035, Math.PI * .08, Math.PI * .92);
  ctx.stroke();
  if (stage === 0) {
    ctx.fillStyle = "#5d4933";
    for (let trench = -1; trench <= 1; trench += 1) ctx.fillRect(Math.round(centerX - 38), Math.round(bottom - 21 + trench * 9), 76 - Math.abs(trench) * 10, 3);
  }
}

function drawNode(ctx: CanvasRenderingContext2D, node: DataNode) {
  const stage = facilityStage(node);
  const bounds = footprintBounds(node.footprint);
  const center = hexCenter(node.anchor);
  drawFacilityGround(ctx, node);
  if (stage === 0) {
    ctx.fillStyle = "#d0a943"; ctx.fillRect(center.x - 14, center.y - 8, 28, 14);
    ctx.fillStyle = "#353b39"; ctx.fillRect(center.x - 18, center.y + 5, 36, 8);
  } else {
    const wallHeight = stage === 1 ? 24 : stage === 2 ? 48 : node.boss ? 88 : 66;
    const left = bounds.left + 10;
    const right = bounds.right - 10;
    const bottom = bounds.bottom - 5;
    ctx.fillStyle = "#282d30"; ctx.fillRect(left, bottom - wallHeight, right - left, wallHeight);
    ctx.fillStyle = stage === 1 ? "#77766d" : "#636c70"; ctx.fillRect(left + 6, bottom - wallHeight + 5, right - left - 12, wallHeight - 12);
    ctx.fillStyle = "#24282b";
    for (let x = left + 14; x < right - 10; x += 22) ctx.fillRect(x, bottom - wallHeight + 13, 11, wallHeight - 26);
    if (stage >= 2) {
      ctx.fillStyle = "#15191c"; ctx.fillRect(center.x - 11, bottom - 25, 22, 21);
      ctx.fillStyle = "#8da24d"; ctx.fillRect(center.x - 6, bottom - 18, 3, 3); ctx.fillRect(center.x + 3, bottom - 18, 3, 3);
      ctx.fillStyle = "#3f484d"; ctx.fillRect(left + 12, bottom - wallHeight - 9, 24, 9); ctx.fillRect(right - 36, bottom - wallHeight - 9, 24, 9);
    }
    if (stage === 3) {
      const outlet = hexCenter(node.outlet);
      const cableCells = hexLine(node.anchor, node.outlet);
      ctx.strokeStyle = "#24262c"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(center.x, bottom); for (const cell of cableCells) { const point = hexCenter(cell); ctx.lineTo(point.x, point.y); } ctx.lineTo(outlet.x, outlet.y); ctx.stroke();
      ctx.fillStyle = "#4a3a4d"; ctx.fillRect(outlet.x - 12, outlet.y - 9, 24, 18);
      ctx.fillStyle = "#83638a"; ctx.fillRect(outlet.x - 6, outlet.y - 5, 4, 4);
    }
  }
  drawHealth(ctx, center.x - 27, bounds.top - 13, 54, node.hp / node.maxHp);
}

function drawRubble(ctx: CanvasRenderingContext2D, cell: HexCell) {
  const center = hexCenter(cell.hex);
  ctx.fillStyle = "rgba(107,85,55,.68)"; ctx.beginPath(); ctx.ellipse(center.x, center.y + 4, 23, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#50565a";
  ctx.fillRect(center.x - 15, center.y - 4, 10, 7); ctx.fillRect(center.x + 4, center.y - 9, 13, 9); ctx.fillRect(center.x - 2, center.y + 7, 8, 5);
  ctx.fillStyle = "#292c2e"; ctx.fillRect(center.x + 10, center.y - 7, 5, 3); ctx.fillRect(center.x - 12, center.y - 2, 4, 2);
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
  if (plant.kind === "rootreclaimer" && cell.corruption > 0) {
    ctx.strokeStyle = "#86b873"; ctx.lineWidth = 2;
    for (let branch = -1; branch <= 1; branch += 1) { ctx.beginPath(); ctx.moveTo(center.x, center.y + 4); ctx.lineTo(center.x + branch * 21, center.y + 13); ctx.stroke(); }
  }
  const box = drawSprite(ctx, plantSpriteKey(plant), center.x, center.y + 7);
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
}

function drawCursor(ctx: CanvasRenderingContext2D, state: GameState) {
  const polygon = hexPolygon(state.cursor, .85);
  tracePolygon(ctx, polygon);
  ctx.fillStyle = "rgba(244,239,157,.07)";
  ctx.fill();
  ctx.strokeStyle = "#f4ef9d";
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
  drawCorruption(ctx, state);
  for (const cell of state.world.cells.values()) if (cell.surface === "rubble") drawRubble(ctx, cell);

  const underlays = state.world.objects.filter((object) => object.kind === "pond" || object.kind === "flowers");
  for (const object of underlays) drawWorldObject(ctx, object, state);
  const renderables = [
    ...state.world.objects.filter((object) => object.kind !== "pond" && object.kind !== "flowers").map((object) => ({ depth: hexCenter(object.anchor).y, draw: () => drawWorldObject(ctx, object, state) })),
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
    stateRef.current = createGameState(best, "normal", "menu");
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
    stateRef.current = createGameState(best, difficulty);
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
          <div><span>Sunlight</span><strong>{ui.sunlight}</strong></div><div><span>House</span><strong>{ui.houseHp}%</strong></div><div><span>Corruption</span><strong>{ui.corruption}%</strong></div><div><span>Wave</span><strong>{ui.wave} · {ui.nextWave}s</strong></div><div><span>Score</span><strong>{ui.score.toLocaleString()}</strong></div>
        </div>
        <div className="rw-stage">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onClick={onCanvasClick} onKeyDown={onCanvasKeyDown} tabIndex={0} aria-label={`A ${HEX_COLS} by ${HEX_ROWS} invisible hex field under attack by AI slop. Select a plant, then click the landscape or use six-direction keys and Enter to plant. Right-drag to pan and scroll to zoom.`}/>
          {overlay && <div className={`rw-overlay rw-overlay-${ui.status}`}>
            <span>{ui.status === "menu" ? "AI INFRASTRUCTURE DETECTED" : ui.status === "won" ? "FEED TERMINATED" : "AI SLOP WON"}</span>
            <h2>{ui.status === "menu" ? "The world is alive." : ui.status === "won" ? "AI slop erased." : "The feed ate everything."}</h2>
            <p>{ui.status === "menu" ? "Defend a continuous landscape built on an invisible hex topology. Datacenters excavate, connect, manufacture, corrupt, collapse into rubble—and the rest of the world responds." : ui.message}</p>
            {ui.status !== "menu" && <div className="rw-result"><span>{ui.wave} waves</span><span>{formatTime(ui.elapsed)}</span><span>{ui.score.toLocaleString()} score</span></div>}
            <div className="rw-difficulty-picker" role="group" aria-label="Difficulty">{DIFFICULTY_ORDER.map((key) => <button type="button" className={difficulty === key ? "active" : ""} aria-pressed={difficulty === key} key={key} onClick={() => setDifficulty(key)}><strong>{DIFFICULTIES[key].name}</strong><small>{DIFFICULTIES[key].description}</small></button>)}</div>
            <div className="rw-overlay-actions"><button onClick={start}>{ui.status === "menu" ? "Enter the living field" : "Fight again"}</button></div>
          </div>}
          {ui.status === "paused" && <div className="rw-pause-card"><span>PAUSED</span><strong>The landscape is holding its breath.</strong><button onClick={togglePause}>Resume</button></div>}
          <div className={`rw-build-menu${overlay ? " rw-build-menu-hidden" : ""}`} aria-label="Build menu" aria-hidden={overlay}>
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
