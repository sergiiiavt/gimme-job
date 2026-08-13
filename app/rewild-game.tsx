"use client";

import { useEffect, useRef, useState } from "react";

const COLS = 30;
const ROWS = 14;
const HOUSE_COL = 14;
const HOUSE_ROW = 6;
const HOUSE_TILES = new Set(["14,6", "15,6", "14,7", "15,7"]);
const STORAGE_KEY = "gimmejob.rewild.best.v1";

const TILE = 40;
const FIELD_WIDTH = COLS * TILE;
const FIELD_HEIGHT = ROWS * TILE;
const FIELD_TOP = 58;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;

interface Camera { x: number; y: number; zoom: number }
function createCamera(): Camera { return { x: 0, y: 0, zoom: 1 }; }
function clampCamera(camera: Camera) {
  const viewW = CANVAS_WIDTH / camera.zoom;
  const viewH = CANVAS_HEIGHT / camera.zoom;
  const slackX = Math.max(0, CANVAS_WIDTH - viewW);
  const slackY = Math.max(0, CANVAS_HEIGHT - viewH);
  camera.x = slackX > 0 ? Math.min(Math.max(camera.x, 0), slackX) : (CANVAS_WIDTH - viewW) / 2;
  camera.y = slackY > 0 ? Math.min(Math.max(camera.y, 0), slackY) : (CANVAS_HEIGHT - viewH) / 2;
}
function toCanvasPixel(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const bounds = canvas.getBoundingClientRect();
  return { x: clientX - bounds.left, y: clientY - bounds.top, renderedWidth: bounds.width, renderedHeight: bounds.height };
}

const SPRITE_FILES: Record<string, string> = {
  "terrain-world": "/rewild/terrain-world.png",
  "obj-house": "/rewild/obj-house-v2.png", "obj-sunbloom": "/rewild/obj-sunbloom.png", "obj-thornbramble": "/rewild/obj-thornbramble.png",
  "obj-vinewhip": "/rewild/obj-vinewhip.png", "obj-sporecap": "/rewild/obj-sporecap.png", "obj-rootreclaimer": "/rewild/obj-rootreclaimer.png",
  "obj-elderoak-p1": "/rewild/obj-elderoak-p1.png", "obj-elderoak-p2": "/rewild/obj-elderoak-p2.png",
  "obj-server": "/rewild/obj-server.png", "obj-mainframe": "/rewild/obj-mainframe.png",
  "obj-swarm": "/rewild/obj-swarm.png", "obj-sludge": "/rewild/obj-sludge.png", "obj-popup": "/rewild/obj-popup.png", "obj-fragment": "/rewild/obj-fragment.png",
  "decal-tuft": "/rewild/decal-tuft.png", "decal-flower": "/rewild/decal-flower.png", "decal-pebble": "/rewild/decal-pebble.png",
  "decal-leaf": "/rewild/decal-leaf.png", "decal-mushroom": "/rewild/decal-mushroom.png",
};

// Production art has real proportions (tall vines, wide server racks) instead of the
// old square placeholders, so every sprite needs its own render height (in tile units)
// and a vertical pivot (fraction down the image that sits on the ground/tile anchor)
// rather than being stretched into a uniform square. See PRODUCTION_ASSET_SPEC.md's
// anchor conventions (pivot Y ~.88 rooted plants, ~.82 mobile blobs, ~.92 server/rack).
interface SpriteMeta { pivotY: number; footprint: number }
const DEFAULT_SPRITE_META: SpriteMeta = { pivotY: .88, footprint: 1 };
const SPRITE_META: Record<string, SpriteMeta> = {
  "obj-house": { pivotY: .88, footprint: 3.1 },
  "obj-sunbloom": { pivotY: .92, footprint: 1.3 },
  "obj-thornbramble": { pivotY: .88, footprint: 1.05 },
  "obj-sporecap": { pivotY: .90, footprint: 1.15 },
  "obj-vinewhip": { pivotY: .88, footprint: 1.25 },
  "obj-rootreclaimer": { pivotY: .90, footprint: .95 },
  "obj-elderoak-p1": { pivotY: .90, footprint: 1.4 },
  "obj-elderoak-p2": { pivotY: .92, footprint: 2.3 },
  "obj-server": { pivotY: .92, footprint: 1.3 },
  "obj-mainframe": { pivotY: .92, footprint: 1.75 },
  "obj-swarm": { pivotY: .84, footprint: .95 },
  "obj-sludge": { pivotY: .84, footprint: 1.05 },
  "obj-popup": { pivotY: .90, footprint: 1.3 },
  "obj-fragment": { pivotY: .82, footprint: .55 },
};
const DECAL_KINDS = ["tuft", "flower", "pebble", "leaf", "mushroom"] as const;
function hashInt(a: number, b: number, salt: number) {
  let h = (a * 374761393 + b * 668265263 + salt * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const spriteCache = new Map<string, HTMLImageElement>();
function getSpriteByPath(path: string): HTMLImageElement | null {
  let img = spriteCache.get(path);
  if (!img) {
    img = new window.Image();
    img.src = path;
    spriteCache.set(path, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
function getSprite(key: string): HTMLImageElement | null {
  return getSpriteByPath(SPRITE_FILES[key]);
}

function preloadSprites() {
  for (const key of Object.keys(SPRITE_FILES)) getSprite(key);
}

type TileKind = "grass" | "corrupt" | "forest" | "pond" | "rock" | "flowers" | "house";
type PlantKind = "sunbloom" | "thornbramble" | "sporecap" | "vinewhip" | "rootreclaimer" | "elderoak";
type EnemyKind = "clickbait" | "deepfake" | "popup" | "fragment";
type GameStatus = "menu" | "playing" | "paused" | "won" | "lost";

interface Point { col: number; row: number }
interface PlantConfig { name: string; shortName: string; cost: number; role: string; detail: string; unlockWave: number; color: string; maxHp: number }
interface EnemyConfig { name: string; hp: number; speed: number; damage: number; color: string }

const PLANT_ORDER: PlantKind[] = ["sunbloom", "thornbramble", "sporecap", "vinewhip", "rootreclaimer", "elderoak"];
const PLANTS: Record<PlantKind, PlantConfig> = {
  sunbloom: { name: "Sunbloom", shortName: "Sun", cost: 25, role: "Economy", detail: "+2 sunlight each second", unlockWave: 1, color: "#f3c94f", maxHp: 45 },
  thornbramble: { name: "Thornbramble", shortName: "Thorn", cost: 40, role: "Blocker", detail: "Blocks and shreds adjacent AI slop", unlockWave: 1, color: "#597b39", maxHp: 100 },
  vinewhip: { name: "Vinewhip", shortName: "Vine", cost: 50, role: "Ranged", detail: "Long reach and a slowing hit", unlockWave: 1, color: "#7fad4d", maxHp: 55 },
  sporecap: { name: "Sporecap", shortName: "Spore", cost: 60, role: "Area damage", detail: "Pulses damage in a wide circle", unlockWave: 2, color: "#c99ed8", maxHp: 50 },
  rootreclaimer: { name: "Rootreclaimer", shortName: "Root", cost: 45, role: "Reclaim", detail: "Planted on corruption; restores land", unlockWave: 2, color: "#79b57b", maxHp: 65 },
  elderoak: { name: "Elder Oak", shortName: "Oak", cost: 150, role: "Late game", detail: "Matures into a powerful guardian", unlockWave: 4, color: "#9a6a3d", maxHp: 300 },
};

const ENEMIES: Record<EnemyKind, EnemyConfig> = {
  clickbait: { name: "AI Slop Swarm", hp: 10, speed: 1.15, damage: 2, color: "#d7f04f" },
  deepfake: { name: "Deepfake Sludge", hp: 60, speed: .55, damage: 6, color: "#8da1ad" },
  popup: { name: "Popup Parasite", hp: 25, speed: .48, damage: 4, color: "#f08fc5" },
  fragment: { name: "AI Slop Fragment", hp: 15, speed: .9, damage: 3, color: "#a5b7bd" },
};

type Difficulty = "easy" | "normal" | "hard";
interface DifficultyConfig { name: string; description: string; sunlightStart: number; houseHp: number; enemyHp: number; enemySpeed: number; enemyDamage: number; waveTime: number }
const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard"];
const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { name: "Easy", description: "Extra sunlight, slower and weaker AI slop.", sunlightStart: 160, houseHp: 130, enemyHp: .75, enemySpeed: .85, enemyDamage: .7, waveTime: 1.25 },
  normal: { name: "Normal", description: "The standard fight against AI slop.", sunlightStart: 120, houseHp: 100, enemyHp: 1, enemySpeed: 1, enemyDamage: 1, waveTime: 1 },
  hard: { name: "Hard", description: "Less sunlight, faster and tougher AI slop.", sunlightStart: 90, houseHp: 80, enemyHp: 1.35, enemySpeed: 1.15, enemyDamage: 1.4, waveTime: .8 },
};

interface PlantEntity {
  id: number;
  kind: PlantKind;
  col: number;
  row: number;
  hp: number;
  cooldown: number;
  age: number;
  reclaimTimer: number;
  disabledUntil: number;
}

interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  cooldown: number;
  pathTimer: number;
  path: Point[];
  slowUntil: number;
}

interface DataNode {
  id: number;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  spreadTimer: number;
  spawnTimer: number;
  boss: boolean;
}

interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
}

interface GameState {
  status: GameStatus;
  tiles: TileKind[][];
  plants: PlantEntity[];
  enemies: EnemyEntity[];
  nodes: DataNode[];
  beams: Beam[];
  sunlight: number;
  houseHp: number;
  wave: number;
  nextWave: number;
  elapsed: number;
  score: number;
  selected: PlantKind;
  cursor: Point;
  message: string;
  messageUntil: number;
  bossSpawned: boolean;
  nextId: number;
  best: number;
  difficulty: Difficulty;
}

interface UiSnapshot {
  status: GameStatus;
  sunlight: number;
  houseHp: number;
  corruption: number;
  wave: number;
  nextWave: number;
  elapsed: number;
  score: number;
  selected: PlantKind;
  message: string;
  best: number;
  difficulty: Difficulty;
  plants: number;
  enemies: number;
  nodes: number;
}

const BORDER_SPAWNS: Point[] = [
  { col: 2, row: 0 }, { col: 9, row: 0 }, { col: 16, row: 0 }, { col: 23, row: 0 }, { col: 28, row: 0 },
  { col: 29, row: 3 }, { col: 29, row: 7 }, { col: 29, row: 11 }, { col: 25, row: 13 },
  { col: 18, row: 13 }, { col: 10, row: 13 }, { col: 4, row: 13 }, { col: 0, row: 10 }, { col: 0, row: 6 }, { col: 0, row: 2 },
];

const OBSTACLES: Array<[number, number, TileKind]> = [
  [3, 2, "forest"], [4, 2, "forest"], [3, 3, "forest"], [10, 1, "flowers"], [11, 1, "flowers"],
  [22, 2, "flowers"], [23, 2, "flowers"], [26, 3, "rock"], [17, 3, "pond"], [18, 3, "pond"], [18, 4, "pond"],
  [6, 5, "pond"], [6, 6, "pond"], [7, 6, "pond"], [3, 9, "forest"], [4, 9, "forest"], [4, 10, "forest"],
  [25, 6, "forest"], [26, 6, "forest"], [23, 10, "rock"], [24, 10, "rock"], [20, 12, "flowers"], [21, 12, "flowers"],
  [10, 12, "forest"], [11, 12, "forest"],
];

function createTiles() {
  const tiles = Array.from({ length: ROWS }, () => Array<TileKind>(COLS).fill("grass"));
  for (const [col, row, kind] of OBSTACLES) tiles[row][col] = kind;
  for (const key of HOUSE_TILES) {
    const [col, row] = key.split(",").map(Number);
    tiles[row][col] = "house";
  }
  return tiles;
}

function nextId(state: GameState) {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function createNode(state: GameState, point: Point, boss = false) {
  state.tiles[point.row][point.col] = "corrupt";
  state.nodes.push({
    id: nextId(state), col: point.col, row: point.row,
    hp: boss ? 800 : 150, maxHp: boss ? 800 : 150,
    spreadTimer: boss ? 5 : 13 + Math.random() * 3,
    spawnTimer: boss ? 3 : 11 + Math.random() * 3,
    boss,
  });
}

function createGameState(best: number, difficulty: Difficulty, status: GameStatus = "playing"): GameState {
  const config = DIFFICULTIES[difficulty];
  const state: GameState = {
    status, tiles: createTiles(), plants: [], enemies: [], nodes: [], beams: [],
    sunlight: config.sunlightStart, houseHp: config.houseHp, wave: 1, nextWave: 24 * config.waveTime, elapsed: 0, score: 0,
    selected: "vinewhip", cursor: { col: 13, row: 5 }, message: "AI slop detected. Grow weapons.", messageUntil: 3,
    bossSpawned: false, nextId: 1, best, difficulty,
  };
  createNode(state, BORDER_SPAWNS[1]);
  createNode(state, BORDER_SPAWNS[5]);
  return state;
}

function tileKey(col: number, row: number) { return `${col},${row}`; }
function inBounds(col: number, row: number) { return col >= 0 && row >= 0 && col < COLS && row < ROWS; }
function isObstacle(tile: TileKind) { return tile === "forest" || tile === "pond" || tile === "rock" || tile === "flowers"; }
function plantAt(state: GameState, col: number, row: number) { return state.plants.find((plant) => plant.col === col && plant.row === row); }
function nodeAt(state: GameState, col: number, row: number) { return state.nodes.find((node) => node.col === col && node.row === row); }
function distance(aCol: number, aRow: number, bCol: number, bRow: number) { return Math.hypot(aCol - bCol, aRow - bRow); }

function corruptionPercent(state: GameState) {
  let field = 0;
  let corrupted = 0;
  for (const row of state.tiles) {
    for (const tile of row) {
      if (tile === "grass" || tile === "corrupt") field += 1;
      if (tile === "corrupt") corrupted += 1;
    }
  }
  return field ? Math.round((corrupted / field) * 100) : 0;
}

function setMessage(state: GameState, message: string, seconds = 2.6) {
  state.message = message;
  state.messageUntil = state.elapsed + seconds;
}

function findPath(state: GameState, startCol: number, startRow: number) {
  const start = tileKey(startCol, startRow);
  const queue: Point[] = [{ col: startCol, row: startRow }];
  const previous = new Map<string, string | null>([[start, null]]);
  let target: string | null = null;
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = tileKey(current.col, current.row);
    if (HOUSE_TILES.has(currentKey)) { target = currentKey; break; }
    for (const [dc, dr] of directions) {
      const col = current.col + dc;
      const row = current.row + dr;
      const key = tileKey(col, row);
      if (!inBounds(col, row) || previous.has(key) || isObstacle(state.tiles[row][col]) || nodeAt(state, col, row)) continue;
      previous.set(key, currentKey);
      queue.push({ col, row });
    }
  }

  if (!target) return [];
  const path: Point[] = [];
  let cursor: string | null = target;
  while (cursor && cursor !== start) {
    const [col, row] = cursor.split(",").map(Number);
    path.unshift({ col, row });
    cursor = previous.get(cursor) ?? null;
  }
  return path;
}

function addBeam(state: GameState, x1: number, y1: number, x2: number, y2: number, color: string) {
  state.beams.push({ x1, y1, x2, y2, color, life: .18 });
}

function targetPosition(target: EnemyEntity | DataNode) {
  return "kind" in target ? { x: target.x, y: target.y } : { x: target.col + .5, y: target.row + .5 };
}

function damageTarget(state: GameState, plant: PlantEntity, target: EnemyEntity | DataNode, damage: number, color: string) {
  target.hp -= damage;
  const position = targetPosition(target);
  addBeam(state, plant.col + .5, plant.row + .5, position.x, position.y, color);
}

function combatTargets(state: GameState, plant: PlantEntity, radius: number) {
  return [...state.enemies, ...state.nodes]
    .filter((target) => target.hp > 0)
    .filter((target) => {
      const position = targetPosition(target);
      return distance(plant.col + .5, plant.row + .5, position.x, position.y) <= radius;
    });
}

function reclaimNear(state: GameState, plant: PlantEntity) {
  const candidates: Point[] = [];
  for (let radius = 0; radius <= 3; radius += 1) {
    for (let row = plant.row - radius; row <= plant.row + radius; row += 1) {
      for (let col = plant.col - radius; col <= plant.col + radius; col += 1) {
        if (inBounds(col, row) && state.tiles[row][col] === "corrupt" && distance(col, row, plant.col, plant.row) <= radius + .2) candidates.push({ col, row });
      }
    }
    if (candidates.length) break;
  }
  const target = candidates.sort((left, right) => distance(left.col, left.row, plant.col, plant.row) - distance(right.col, right.row, plant.col, plant.row))[0];
  if (!target || nodeAt(state, target.col, target.row)) return;
  state.tiles[target.row][target.col] = "grass";
  state.score += 6;
  addBeam(state, plant.col + .5, plant.row + .5, target.col + .5, target.row + .5, "#a9e37d");
}

function updatePlants(state: GameState, dt: number) {
  for (const plant of state.plants) {
    plant.age += dt;
    plant.cooldown -= dt;
    if (plant.disabledUntil > state.elapsed) continue;
    if (plant.kind === "rootreclaimer") {
      plant.reclaimTimer -= dt;
      if (plant.reclaimTimer <= 0) {
        reclaimNear(state, plant);
        plant.reclaimTimer = 3.7;
      }
      continue;
    }
    if (plant.cooldown > 0 || plant.kind === "sunbloom") continue;

    if (plant.kind === "thornbramble") {
      for (const target of combatTargets(state, plant, 1.3)) damageTarget(state, plant, target, 4, "#a9d45c");
      plant.cooldown = 1;
    } else if (plant.kind === "sporecap") {
      for (const target of combatTargets(state, plant, 2.25)) damageTarget(state, plant, target, 15, "#d7a8ec");
      plant.cooldown = 2;
    } else if (plant.kind === "vinewhip") {
      const target = combatTargets(state, plant, 3.25)[0];
      if (target) {
        damageTarget(state, plant, target, 8, "#77bd4a");
        if ("kind" in target) target.slowUntil = state.elapsed + 2;
      }
      plant.cooldown = .9;
    } else if (plant.kind === "elderoak" && plant.age >= 15) {
      for (const target of combatTargets(state, plant, 2.35)) damageTarget(state, plant, target, 25, "#d8ba68");
      plant.cooldown = 1.5;
    }
  }
}

function spawnEnemy(state: GameState, node: DataNode, kind: EnemyKind, offset = 0) {
  if (state.enemies.length >= 70) return;
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dc, dr]) => ({ col: node.col + dc, row: node.row + dr }))
    .filter((point) => inBounds(point.col, point.row) && !isObstacle(state.tiles[point.row][point.col]) && !HOUSE_TILES.has(tileKey(point.col, point.row)));
  const spawn = neighbors[offset % Math.max(1, neighbors.length)] ?? { col: node.col, row: node.row };
  const config = ENEMIES[kind];
  const mult = DIFFICULTIES[state.difficulty];
  const hp = Math.round(config.hp * mult.enemyHp);
  state.enemies.push({
    id: nextId(state), kind, x: spawn.col + .5 + offset * .03, y: spawn.row + .5 + offset * .03,
    hp, maxHp: hp, speed: config.speed * mult.enemySpeed, damage: config.damage * mult.enemyDamage,
    cooldown: .4, pathTimer: 0, path: [], slowUntil: 0,
  });
}

function spawnEnemyAt(state: GameState, kind: EnemyKind, x: number, y: number) {
  const config = ENEMIES[kind];
  const mult = DIFFICULTIES[state.difficulty];
  const hp = Math.round(config.hp * mult.enemyHp);
  state.enemies.push({ id: nextId(state), kind, x, y, hp, maxHp: hp, speed: config.speed * mult.enemySpeed, damage: config.damage * mult.enemyDamage, cooldown: .4, pathTimer: 0, path: [], slowUntil: 0 });
}

function spawnFromNode(state: GameState, node: DataNode) {
  const roll = Math.random();
  const kind: EnemyKind = state.wave >= 3 && roll > .72 ? "popup" : state.wave >= 2 && roll > .45 ? "deepfake" : "clickbait";
  const count = kind === "clickbait" ? Math.min(1 + Math.floor(state.wave / 3), 3) : 1;
  for (let index = 0; index < count; index += 1) spawnEnemy(state, node, kind, index);
}

function spreadCorruption(state: GameState) {
  const frontier: Point[] = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (state.tiles[row][col] !== "corrupt") continue;
      for (const [dc, dr] of directions) {
        const next = { col: col + dc, row: row + dr };
        if (!inBounds(next.col, next.row)) continue;
        const tile = state.tiles[next.row][next.col];
        if (tile === "grass" || tile === "house") frontier.push(next);
      }
    }
  }
  if (!frontier.length) return;
  const target = frontier[Math.floor(Math.random() * frontier.length)];
  if (HOUSE_TILES.has(tileKey(target.col, target.row))) {
    finishGame(state, "lost", "AI slop breached the garden perimeter.");
    return;
  }
  if (!plantAt(state, target.col, target.row)) state.tiles[target.row][target.col] = "corrupt";
}

function addWaveNode(state: GameState, boss = false) {
  const available = BORDER_SPAWNS.filter((point) => !nodeAt(state, point.col, point.row) && !plantAt(state, point.col, point.row));
  if (!available.length) return;
  const point = available[Math.floor(Math.random() * available.length)];
  createNode(state, point, boss);
  setMessage(state, boss ? "AI SLOP MAINFRAME ONLINE. Break the feed." : "A fresh AI slop server is poisoning the field.", 4);
}

function updateNodes(state: GameState, dt: number) {
  for (const node of state.nodes) {
    node.spreadTimer -= dt;
    node.spawnTimer -= dt;
    if (node.spreadTimer <= 0) {
      spreadCorruption(state);
      node.spreadTimer = node.boss ? 5.5 : Math.max(8, 14 - state.wave * .45);
    }
    if (node.spawnTimer <= 0) {
      spawnFromNode(state, node);
      node.spawnTimer = node.boss ? 3.4 : Math.max(8, 13 - state.wave * .4);
    }
  }
}

function attackPlantOrHouse(state: GameState, enemy: EnemyEntity, targetCol: number, targetRow: number) {
  const plant = plantAt(state, targetCol, targetRow);
  if (plant) {
    if (enemy.cooldown <= 0) {
      plant.hp -= enemy.damage;
      enemy.cooldown = 1;
      addBeam(state, enemy.x, enemy.y, plant.col + .5, plant.row + .5, "#c8ff45");
    }
    return true;
  }
  if (HOUSE_TILES.has(tileKey(targetCol, targetRow))) {
    if (enemy.cooldown <= 0) {
      const nextHp = state.houseHp - enemy.damage;
      state.houseHp = Math.max(0, nextHp);
      enemy.cooldown = .85;
      addBeam(state, enemy.x, enemy.y, targetCol + .5, targetRow + .5, "#f36c76");
      if (state.houseHp <= 0) finishGame(state, "lost", "AI slop flattened the last human house.");
    }
    return true;
  }
  return false;
}

function updateEnemies(state: GameState, dt: number) {
  for (const enemy of state.enemies) {
    enemy.pathTimer -= dt;
    if (enemy.kind === "popup" && enemy.cooldown <= 0) {
      const nearby = state.plants.find((plant) => distance(enemy.x, enemy.y, plant.col + .5, plant.row + .5) <= 3.1);
      if (nearby) {
        nearby.disabledUntil = state.elapsed + 3.2;
        enemy.cooldown = 5;
        addBeam(state, enemy.x, enemy.y, nearby.col + .5, nearby.row + .5, "#ff8dcb");
        setMessage(state, `${PLANTS[nearby.kind].name} tore down an AI slop popup.`);
        continue;
      }
    }
    enemy.cooldown -= dt;
    const currentCol = Math.max(0, Math.min(COLS - 1, Math.floor(enemy.x)));
    const currentRow = Math.max(0, Math.min(ROWS - 1, Math.floor(enemy.y)));
    if (HOUSE_TILES.has(tileKey(currentCol, currentRow))) {
      attackPlantOrHouse(state, enemy, currentCol, currentRow);
      continue;
    }
    if (enemy.pathTimer <= 0 || !enemy.path.length) {
      enemy.path = findPath(state, currentCol, currentRow);
      enemy.pathTimer = 1.1;
    }
    const next = enemy.path[0];
    if (!next) continue;
    if (attackPlantOrHouse(state, enemy, next.col, next.row)) continue;
    const targetX = next.col + .5;
    const targetY = next.row + .5;
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const magnitude = Math.max(.001, Math.hypot(dx, dy));
    const slow = enemy.slowUntil > state.elapsed ? .7 : 1;
    const step = enemy.speed * slow * dt;
    enemy.x += (dx / magnitude) * Math.min(step, magnitude);
    enemy.y += (dy / magnitude) * Math.min(step, magnitude);
    if (magnitude < .08) enemy.path.shift();
  }
}

function finishGame(state: GameState, status: "won" | "lost", message: string) {
  if (state.status === "won" || state.status === "lost") return;
  state.status = status;
  state.message = message;
  state.score += status === "won" ? 1000 + Math.round(state.houseHp * 5) : 0;
  state.best = Math.max(state.best, state.score);
  try { window.localStorage.setItem(STORAGE_KEY, String(state.best)); } catch { /* local persistence is optional */ }
}

function cleanupDefeated(state: GameState) {
  const deadEnemies = state.enemies.filter((enemy) => enemy.hp <= 0);
  for (const enemy of deadEnemies) {
    state.score += enemy.kind === "deepfake" ? 35 : enemy.kind === "popup" ? 25 : 12;
    if (enemy.kind === "deepfake") {
      spawnEnemyAt(state, "fragment", enemy.x - .12, enemy.y);
      spawnEnemyAt(state, "fragment", enemy.x + .12, enemy.y);
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  const deadNodes = state.nodes.filter((node) => node.hp <= 0);
  for (const node of deadNodes) {
    state.score += node.boss ? 800 : 180;
    setMessage(state, node.boss ? "The AI Slop Mainframe is dead. Good." : "AI slop server destroyed. Keep pushing.", 4);
  }
  state.nodes = state.nodes.filter((node) => node.hp > 0);
  state.plants = state.plants.filter((plant) => plant.hp > 0);
}

function advanceWave(state: GameState) {
  state.wave += 1;
  state.nextWave = Math.max(15, 25 - state.wave) * DIFFICULTIES[state.difficulty].waveTime;
  state.sunlight += 35 + state.wave * 4;
  setMessage(state, `Wave ${state.wave}: more AI slop crawled out of the feed.`, 3.5);
  if (state.wave % 2 === 0) addWaveNode(state);
  if (state.wave === 5 && !state.bossSpawned) {
    state.bossSpawned = true;
    addWaveNode(state, true);
  }
}

function updateGame(state: GameState, dt: number) {
  if (state.status !== "playing") return;
  state.elapsed += dt;
  state.nextWave -= dt;
  const sunblooms = state.plants.filter((plant) => plant.kind === "sunbloom" && plant.disabledUntil <= state.elapsed).length;
  state.sunlight += (1 + sunblooms * 2) * dt;
  if (state.nextWave <= 0) advanceWave(state);
  updateNodes(state, dt);
  updatePlants(state, dt);
  updateEnemies(state, dt);
  for (const beam of state.beams) beam.life -= dt;
  state.beams = state.beams.filter((beam) => beam.life > 0);
  cleanupDefeated(state);

  if (state.bossSpawned && state.nodes.length === 0 && state.enemies.length === 0 && corruptionPercent(state) === 0) {
    finishGame(state, "won", "AI slop erased. The field belongs to people again.");
  }
}

function placePlant(state: GameState, col: number, row: number) {
  if (state.status !== "playing" || !inBounds(col, row) || plantAt(state, col, row) || nodeAt(state, col, row)) return;
  const config = PLANTS[state.selected];
  if (state.wave < config.unlockWave) { setMessage(state, `${config.name} unlocks at wave ${config.unlockWave}.`); return; }
  if (state.sunlight < config.cost) { setMessage(state, `Not enough sunlight for ${config.name}.`); return; }
  const tile = state.tiles[row][col];
  const valid = state.selected === "rootreclaimer" ? tile === "corrupt" : tile === "grass";
  if (!valid) {
    const tileLabel = tile === "house" ? "the house" : tile === "corrupt" ? "corrupted ground" : tile;
    setMessage(state, state.selected === "rootreclaimer" ? "Rootreclaimers need corrupted ground." : `Can't plant ${config.name} on ${tileLabel}.`);
    return;
  }
  state.sunlight -= config.cost;
  state.plants.push({ id: nextId(state), kind: state.selected, col, row, hp: config.maxHp, cooldown: .2, age: 0, reclaimTimer: 3.7, disabledUntil: 0 });
  setMessage(state, `${config.name} planted.`);
}

function toUi(state: GameState): UiSnapshot {
  return {
    status: state.status, sunlight: Math.floor(state.sunlight), houseHp: Math.round(state.houseHp),
    corruption: corruptionPercent(state), wave: state.wave, nextWave: Math.max(0, Math.ceil(state.nextWave)),
    elapsed: state.elapsed, score: state.score, selected: state.selected,
    message: state.messageUntil >= state.elapsed || state.status === "won" || state.status === "lost" ? state.message : "Grow something useful.",
    best: state.best, difficulty: state.difficulty, plants: state.plants.length, enemies: state.enemies.length, nodes: state.nodes.length,
  };
}

function plantSpriteKey(kind: PlantKind, mature = true) {
  if (kind === "elderoak") return mature ? "obj-elderoak-p2" : "obj-elderoak-p1";
  return `obj-${kind}`;
}

function enemySpriteKey(kind: EnemyKind) {
  if (kind === "clickbait") return "obj-swarm";
  if (kind === "deepfake") return "obj-sludge";
  if (kind === "popup") return "obj-popup";
  return "obj-fragment";
}

function spriteFootprint(key: string, scale: number) {
  const img = getSprite(key);
  const meta = SPRITE_META[key] ?? DEFAULT_SPRITE_META;
  const height = TILE * meta.footprint * scale;
  const aspect = img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
  return { img, meta, height, width: height * aspect };
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number, width: number) {
  ctx.fillStyle = "rgba(20,26,16,.28)";
  ctx.beginPath();
  ctx.ellipse(cx, groundY + width * .06, width * .40, width * .15, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Draws a sprite at its native aspect ratio (never stretched) anchored so that its
// pivot point sits at (cx, groundY), and drops a contact shadow sized to its footprint
// width. Returns the sprite's on-screen box so callers can place health bars, glitch
// offsets, etc. relative to it.
function drawSprite(ctx: CanvasRenderingContext2D, key: string, cx: number, groundY: number, scale = 1) {
  const { img, meta, width, height } = spriteFootprint(key, scale);
  drawGroundShadow(ctx, cx, groundY, width);
  const top = groundY - height * meta.pivotY;
  const left = cx - width / 2;
  if (img) ctx.drawImage(img, left, top, width, height);
  return { width, height, top, left };
}

function drawTile(ctx: CanvasRenderingContext2D, tiles: TileKind[][], col: number, row: number, time: number) {
  const x = col * TILE;
  const y = row * TILE;
  const corrupt = tiles[row][col] === "corrupt";
  if (corrupt) {
    const left = col > 0 && tiles[row][col - 1] === "corrupt";
    const right = col + 1 < COLS && tiles[row][col + 1] === "corrupt";
    const top = row > 0 && tiles[row - 1][col] === "corrupt";
    const bottom = row + 1 < ROWS && tiles[row + 1][col] === "corrupt";
    const wobble = (hashInt(col, row, 18) % 7) - 3;
    ctx.fillStyle = "rgba(42,30,55,.78)";
    ctx.beginPath();
    ctx.moveTo(x + (left ? 0 : 6 + wobble), y + (top ? 0 : 8));
    ctx.quadraticCurveTo(x + TILE / 2, y + (top ? 0 : 2), x + (right ? TILE : TILE - 7 + wobble), y + (top ? 0 : 7));
    ctx.lineTo(x + (right ? TILE : TILE - 4), y + (bottom ? TILE : TILE - 8));
    ctx.quadraticCurveTo(x + TILE / 2, y + (bottom ? TILE : TILE - 2), x + (left ? 0 : 6), y + (bottom ? TILE : TILE - 6));
    ctx.closePath();
    ctx.fill();
    const glow = ctx.createRadialGradient(x + TILE / 2, y + TILE / 2, 2, x + TILE / 2, y + TILE / 2, TILE * .52);
    glow.addColorStop(0, "rgba(117,58,136,.34)");
    glow.addColorStop(1, "rgba(42,30,55,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 4, y - 4, TILE + 8, TILE + 8);
  }

  if (!corrupt && tiles[row][col] === "grass" && !HOUSE_TILES.has(tileKey(col, row)) && hashInt(col, row, 1) % 11 === 0) {
    const kind = DECAL_KINDS[hashInt(col, row, 2) % DECAL_KINDS.length];
    const offX = (hashInt(col, row, 3) % 16) - 8;
    const offY = (hashInt(col, row, 4) % 16) - 8;
    const size = TILE * .4;
    const img = getSprite(`decal-${kind}`);
    if (img) ctx.drawImage(img, x + TILE / 2 - size / 2 + offX, y + TILE / 2 - size / 2 + offY, size, size);
  }

  if (tiles[row][col] === "corrupt" && Math.floor(time * 8 + col + row) % 3 === 0) {
    ctx.fillStyle = "rgba(200,243,72,.35)";
    ctx.fillRect(x + 6, y + 14, 10, 2);
    ctx.fillRect(x + 22, y + 24, 9, 2);
  }
}

function drawMeadow(ctx: CanvasRenderingContext2D) {
  const world = getSprite("terrain-world");
  if (world) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(world, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#7f9f43";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawCorruptionDetails(ctx: CanvasRenderingContext2D, tiles: TileKind[][]) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (tiles[row][col] !== "corrupt") continue;
      const x = (col + .5) * TILE + (hashInt(col, row, 21) % 9) - 4;
      const y = (row + .5) * TILE + (hashInt(col, row, 22) % 7) - 3;
      ctx.fillStyle = hashInt(col, row, 19) % 2 ? "rgba(126,64,149,.78)" : "rgba(196,225,60,.66)";
      ctx.beginPath();
      ctx.ellipse(x, y, 5 + hashInt(col, row, 20) % 7, 3 + hashInt(col, row, 23) % 5, (hashInt(col, row, 24) % 10) / 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(20,16,28,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.quadraticCurveTo(x + ((hashInt(col, row, 25) % 9) - 4), y - 10, x + ((hashInt(col, row, 26) % 13) - 6), y - 15);
      ctx.stroke();
      ctx.fillStyle = "rgba(16,17,24,.72)";
      ctx.fillRect(x - 1, y - 10, 2, 9);
    }
  }
}

function drawHealth(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, ratio: number, color = "#de6e70") {
  ctx.fillStyle = "rgba(24,30,29,.7)"; ctx.fillRect(x, y, width, 4);
  ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * ratio), 2);
}

function drawHouse(ctx: CanvasRenderingContext2D, hp: number) {
  const x = (HOUSE_COL + 1) * TILE;
  const groundY = (HOUSE_ROW + 1) * TILE;
  const clearing = TILE * SPRITE_META["obj-house"].footprint;
  ctx.fillStyle = "rgba(154,122,74,.28)";
  ctx.beginPath();
  ctx.ellipse(x, groundY + clearing * .12, clearing * .5, clearing * .2, 0, 0, Math.PI * 2);
  ctx.fill();
  const box = drawSprite(ctx, "obj-house", x, groundY);
  const barW = box.width * .55;
  const color = hp > 55 ? "#6aa34a" : hp > 25 ? "#e5b44f" : "#e06c69";
  drawHealth(ctx, x - barW / 2, box.top + 7, barW, hp / 100, color);
}

function drawPlant(ctx: CanvasRenderingContext2D, plant: PlantEntity, state: GameState) {
  const x = plant.col * TILE + TILE / 2;
  const groundY = plant.row * TILE + TILE / 2;
  const disabled = plant.disabledUntil > state.elapsed;
  const mature = plant.kind !== "elderoak" || plant.age >= 15;
  const scale = plant.kind === "elderoak" && !mature ? .6 + .4 * (plant.age / 15) : 1;
  const spriteKey = plantSpriteKey(plant.kind, mature);
  ctx.save();
  if (disabled) ctx.globalAlpha = .55;
  const box = drawSprite(ctx, spriteKey, x, groundY, scale);
  ctx.restore();
  if (disabled) {
    const midY = box.top + box.height * .4;
    ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.ellipse(x, midY, box.width * .32, box.width * .32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ee78b9"; ctx.fillRect(x - box.width * .18, midY - 1.5, box.width * .36, 3);
  }
  drawHealth(ctx, x - 14, box.top - 8, 28, plant.hp / PLANTS[plant.kind].maxHp, "#77b956");
}

function drawNode(ctx: CanvasRenderingContext2D, node: DataNode, time: number) {
  const x = node.col * TILE + TILE / 2;
  const groundY = node.row * TILE + TILE / 2;
  const glitch = Math.floor(time * 11 + node.id) % 5 === 0 ? 3 : 0;
  const box = drawSprite(ctx, node.boss ? "obj-mainframe" : "obj-server", x + glitch, groundY);
  drawHealth(ctx, x - 18, box.top - 8, 36, node.hp / node.maxHp);
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity, time: number) {
  const x = enemy.x * TILE;
  const groundY = enemy.y * TILE;
  const glitch = Math.floor(time * 13 + enemy.id) % 7 === 0 ? 3 : 0;
  const box = drawSprite(ctx, enemySpriteKey(enemy.kind), x + glitch, groundY);
  drawHealth(ctx, x - 14, box.top - 8, 28, enemy.hp / enemy.maxHp);
}

function renderGame(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  drawMeadow(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FIELD_TOP, FIELD_WIDTH, FIELD_HEIGHT);
  ctx.clip();
  ctx.translate(0, FIELD_TOP);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) drawTile(ctx, state.tiles, col, row, state.elapsed);
  }
  drawCorruptionDetails(ctx, state.tiles);
  ctx.restore();
  ctx.save();
  ctx.translate(0, FIELD_TOP);
  drawHouse(ctx, state.houseHp);
  for (const plant of state.plants) drawPlant(ctx, plant, state);
  for (const node of state.nodes) drawNode(ctx, node, state.elapsed);
  for (const enemy of state.enemies) drawEnemy(ctx, enemy, state.elapsed);
  for (const beam of state.beams) {
    ctx.strokeStyle = beam.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(beam.x1 * TILE, beam.y1 * TILE); ctx.lineTo(beam.x2 * TILE, beam.y2 * TILE); ctx.stroke();
  }
  if (state.status === "playing") {
    ctx.strokeStyle = "#f4ef9d";
    ctx.lineWidth = 3;
    ctx.strokeRect(state.cursor.col * TILE + 3, state.cursor.row * TILE + 3, TILE - 6, TILE - 6);
  }
  ctx.restore();
  ctx.restore();
  if (corruptionPercent(state) > 18) {
    ctx.fillStyle = `rgba(205,255,65,${Math.min(.08, corruptionPercent(state) / 1200)})`;
    for (let y = Math.floor(state.elapsed * 25) % 8; y < CANVAS_HEIGHT; y += 8) ctx.fillRect(0, y, CANVAS_WIDTH, 1);
  }
}

function SpriteIcon({ spriteKey }: { spriteKey: string }) {
  return <img src={SPRITE_FILES[spriteKey]} alt="" aria-hidden="true"/>;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function RewildGuide({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="kb-content rw-page">
      <header className="rw-guide-head"><span>ANTI-SLOP FIELD MANUAL / 01</span><h1>How to fight AI slop</h1><p>Plants are weapons, sunlight is ammunition, and every concrete-grey tile is territory stolen by the feed. Defend the house at the center of the field: it is game over at 0 HP.</p><button className="rw-guide-play" onClick={onPlay}>Open the battlefield</button></header>
      <section className="rw-guide-grid">
        <article><span>01</span><h2>Arm</h2><p>Plant defenses on healthy grass. Sunblooms fund the fight; blockers and attackers turn the path into a trap.</p></article>
        <article><span>02</span><h2>Crush</h2><p>AI slop servers spread corruption and manufacture junk. Reach them with Vinewhips, Sporecaps, and mature Elder Oaks.</p></article>
        <article><span>03</span><h2>Reclaim</h2><p>Rootreclaimers invade corrupted tiles. Give them time and they rip the grey rot out of nearby ground.</p></article>
        <article><span>04</span><h2>Erase</h2><p>Destroy every AI slop server and the Mainframe, clear the remaining sludge, and take back every tile.</p></article>
      </section>
      <section className="rw-field-guide">
        <div><span>DEFENDERS</span><h2>Weapons that grow</h2></div>
        <div className="rw-guide-list">{PLANT_ORDER.map((kind) => <article key={kind}><SpriteIcon spriteKey={plantSpriteKey(kind)}/><div><strong>{PLANTS[kind].name}</strong><span>{PLANTS[kind].role} · {PLANTS[kind].cost} sun · wave {PLANTS[kind].unlockWave}</span><p>{PLANTS[kind].detail}</p></div></article>)}</div>
      </section>
      <section className="rw-field-guide rw-enemy-guide">
        <div><span>AI SLOP</span><h2>Targets to destroy</h2></div>
        <div className="rw-guide-list">
          {(["clickbait", "deepfake", "popup"] as EnemyKind[]).map((kind) => <article key={kind}><SpriteIcon spriteKey={enemySpriteKey(kind)}/><div><strong>{ENEMIES[kind].name}</strong><span>{ENEMIES[kind].hp} HP · speed {ENEMIES[kind].speed}</span><p>{kind === "clickbait" ? "Fast, disposable, and engineered to steal attention." : kind === "deepfake" ? "Slow synthetic sludge. Splits into two more problems when destroyed." : "A hostile popup that disables defenders with junk nobody requested."}</p></div></article>)}
          <article><SpriteIcon spriteKey="obj-server"/><div><strong>AI Slop Server</strong><span>150 HP · spreads corruption</span><p>Spawns enemies and slowly corrupts nearby tiles. Destroy it to stop the spread.</p></div></article>
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
    try { best = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0) || 0; } catch { /* local persistence is optional */ }
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
        if (time - lastUiRef.current > 150) {
          lastUiRef.current = time;
          setUi(toUi(state));
        }
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
      camera.x -= ((event.clientX - drag.x) * drag.scaleX) / camera.zoom;
      camera.y -= ((event.clientY - drag.y) * drag.scaleY) / camera.zoom;
      clampCamera(camera);
      dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    };
    const onMouseUp = () => { dragRef.current = null; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      const { x, y, renderedWidth, renderedHeight } = toCanvasPixel(canvas, event.clientX, event.clientY);
      const canvasX = (x / renderedWidth) * CANVAS_WIDTH;
      const canvasY = (y / renderedHeight) * CANVAS_HEIGHT;
      const worldX = canvasX / camera.zoom + camera.x;
      const worldY = canvasY / camera.zoom + camera.y;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * Math.exp(-event.deltaY * 0.0015)));
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
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < PLANT_ORDER.length) {
        const kind = PLANT_ORDER[index];
        if (state.wave >= PLANTS[kind].unlockWave) {
          state.selected = kind;
          setUi(toUi(state));
        }
      }
      if (event.code === "Space" && (state.status === "playing" || state.status === "paused")) {
        event.preventDefault();
        state.status = state.status === "playing" ? "paused" : "playing";
        setUi(toUi(state));
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
    const canvasX = (x / renderedWidth) * CANVAS_WIDTH;
    const canvasY = (y / renderedHeight) * CANVAS_HEIGHT;
    const col = Math.floor((canvasX / camera.zoom + camera.x) / TILE);
    const row = Math.floor((canvasY / camera.zoom + camera.y - FIELD_TOP) / TILE);
    if (!inBounds(col, row)) return;
    state.cursor = { col, row };
    placePlant(state, col, row);
    setUi(toUi(state));
  };
  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (!state || state.status !== "playing") return;
    const movement: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (movement[event.key]) {
      event.preventDefault();
      const [dc, dr] = movement[event.key];
      state.cursor = { col: Math.max(0, Math.min(COLS - 1, state.cursor.col + dc)), row: Math.max(0, Math.min(ROWS - 1, state.cursor.row + dr)) };
      setUi(toUi(state));
    } else if (event.key === "Enter") {
      event.preventDefault();
      placePlant(state, state.cursor.col, state.cursor.row);
      setUi(toUi(state));
    }
  };

  const overlay = ui.status === "menu" || ui.status === "won" || ui.status === "lost";
  return (
    <div className="rw-play-page">
      <section className="rw-game-shell" aria-label="Fight AI slop game">
        <div className="rw-hud" aria-live="polite">
          <div className="rw-hud-brand"><span>Pixel defense · final stand</span><strong>Fight AI slop</strong><small>{ui.best.toLocaleString()} best · {DIFFICULTIES[ui.difficulty].name}</small></div>
          <div><span>Sunlight</span><strong>{ui.sunlight}</strong></div>
          <div><span>House</span><strong>{ui.houseHp}%</strong></div>
          <div><span>Corruption</span><strong>{ui.corruption}%</strong></div>
          <div><span>Wave</span><strong>{ui.wave} · {ui.nextWave}s</strong></div>
          <div><span>Score</span><strong>{ui.score.toLocaleString()}</strong></div>
        </div>

        <div className="rw-stage">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onClick={onCanvasClick} onKeyDown={onCanvasKeyDown} tabIndex={0} aria-label="A thirty by fourteen pixel field under attack by AI slop. Select a plant, then click a tile or use arrow keys and Enter to plant. Right-drag to pan the camera, scroll to zoom."/>
          {overlay && (
            <div className={`rw-overlay rw-overlay-${ui.status}`}>
              <span>{ui.status === "menu" ? "AI SLOP DETECTED" : ui.status === "won" ? "FEED TERMINATED" : "AI SLOP WON"}</span>
              <h2>{ui.status === "menu" ? "Fight back." : ui.status === "won" ? "AI slop erased." : "The feed ate everything."}</h2>
              <p>{ui.status === "menu" ? "AI slop servers are poisoning the field. Grow defenses, break the feed, and keep the last human house standing." : ui.message}</p>
              {ui.status !== "menu" && <div className="rw-result"><span>{ui.wave} waves</span><span>{formatTime(ui.elapsed)}</span><span>{ui.score.toLocaleString()} score</span></div>}
              <div className="rw-difficulty-picker" role="group" aria-label="Difficulty">
                {DIFFICULTY_ORDER.map((key) => (
                  <button type="button" className={difficulty === key ? "active" : ""} aria-pressed={difficulty === key} key={key} onClick={() => setDifficulty(key)}>
                    <strong>{DIFFICULTIES[key].name}</strong>
                    <small>{DIFFICULTIES[key].description}</small>
                  </button>
                ))}
              </div>
              <div className="rw-overlay-actions">
                <button onClick={start}>{ui.status === "menu" ? "Start the fight" : "Fight again"}</button>
              </div>
            </div>
          )}
          {ui.status === "paused" && <div className="rw-pause-card"><span>PAUSED</span><strong>AI slop is still waiting. It never gets tired.</strong><button onClick={togglePause}>Resume</button></div>}

          <div className={`rw-build-menu${overlay ? " rw-build-menu-hidden" : ""}`} aria-label="Build menu" aria-hidden={overlay}>
            <div className="rw-build-menu-head"><span>Build</span></div>
            <div className="rw-plant-bar" aria-label="Plants">
              {PLANT_ORDER.map((kind, index) => {
                const config = PLANTS[kind];
                const locked = ui.wave < config.unlockWave;
                return (
                  <button className={ui.selected === kind ? "active" : ""} disabled={locked || ui.status === "menu" || ui.status === "won" || ui.status === "lost"} aria-pressed={ui.selected === kind} key={kind} onClick={() => choosePlant(kind)}>
                    <i style={{ background: config.color }}>{locked ? "×" : index + 1}</i>
                    <span><strong>{config.shortName}</strong><small>{locked ? `Wave ${config.unlockWave}` : `${config.cost} sun`}</small></span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rw-status-line"><span>{ui.message}</span><small>{ui.enemies} AI slop · {ui.nodes} slop servers · {ui.plants} defenders</small></div>

        <footer className="rw-controls">
          <p><strong>Plant:</strong> choose a card from the build menu or press 1–6, then click a tile. Right-drag to pan, scroll to zoom, arrows + Enter to plant. Rootreclaimers only grow on corruption.</p>
          <div><button onClick={() => onViewChange("guide")}>Field guide</button><button onClick={togglePause} disabled={ui.status === "menu" || ui.status === "won" || ui.status === "lost"}>{ui.status === "paused" ? "Resume" : "Pause"}</button><button onClick={start}>Restart</button></div>
        </footer>
      </section>
    </div>
  );
}
