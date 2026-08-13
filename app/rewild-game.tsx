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
  "obj-tree-deciduous": { pivotY: .85, footprint: 3.5 },
  "obj-tree-pine": { pivotY: .91, footprint: 3.3 },
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

type SurfaceKind = "grass" | "road" | "forest" | "pond" | "rock" | "flowers" | "house" | "foundation" | "rubble";
type CorruptionLevel = 0 | 1 | 2 | 3 | 4;
interface TerrainCell { surface: SurfaceKind; corruption: CorruptionLevel; seed: number; source: number | null }
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
  buildProgress: number;
  footprint: Point[];
  outlet: Point;
}

interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

interface GameState {
  status: GameStatus;
  tiles: TerrainCell[][];
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

type SceneryKind = "tree" | "pine" | "pond" | "rock" | "shrub" | "flowers" | "road" | "log" | "fence" | "sign" | "ruin";
interface SceneryObject {
  id: string;
  kind: SceneryKind;
  x: number;
  y: number;
  width: number;
  sprite?: string;
  rotation?: number;
  shadow?: boolean;
  cells?: Array<[number, number, SurfaceKind]>;
  points?: Array<{ x: number; y: number }>;
}
const ROAD_POINTS = [
  { x: -.5, y: 8.2 }, { x: 4.2, y: 8.0 }, { x: 8.5, y: 8.3 }, { x: 12.0, y: 7.7 },
  { x: 15.0, y: 8.1 }, { x: 18.1, y: 8.7 }, { x: 21.5, y: 8.2 }, { x: 25.2, y: 7.8 }, { x: 30.5, y: 8.2 },
];
const SCENERY: SceneryObject[] = [
  { id: "road-main", kind: "road", x: 15, y: 8.2, width: 31, shadow: false, points: ROAD_POINTS },
  { id: "tree-nw", kind: "tree", x: 3.7, y: 3.5, width: 4.8, sprite: "obj-tree-deciduous", cells: [[3, 2, "forest"], [4, 2, "forest"], [3, 3, "forest"]] },
  { id: "pine-sw", kind: "pine", x: 4.5, y: 10.5, width: 3.7, sprite: "obj-tree-pine", cells: [[3, 9, "forest"], [4, 9, "forest"], [4, 10, "forest"]] },
  { id: "tree-east", kind: "tree", x: 26.2, y: 7.1, width: 4.4, sprite: "obj-tree-deciduous", cells: [[25, 6, "forest"], [26, 6, "forest"]] },
  { id: "pine-south", kind: "pine", x: 10.8, y: 13.1, width: 3.3, sprite: "obj-tree-pine", cells: [[10, 12, "forest"], [11, 12, "forest"]] },
  { id: "pond-west", kind: "pond", x: 6.8, y: 6.5, width: 4.5, sprite: "terrain-pond-1", shadow: false, cells: [[6, 5, "pond"], [6, 6, "pond"], [7, 6, "pond"]] },
  { id: "pond-east", kind: "pond", x: 18.2, y: 4.0, width: 4.1, sprite: "terrain-pond-2", shadow: false, cells: [[17, 3, "pond"], [18, 3, "pond"], [18, 4, "pond"]] },
  { id: "rocks-ne", kind: "rock", x: 26.5, y: 3.9, width: 2.7, sprite: "terrain-rock-2", cells: [[26, 3, "rock"]] },
  { id: "rocks-se", kind: "rock", x: 24.0, y: 10.8, width: 3.4, sprite: "terrain-rock-1", cells: [[23, 10, "rock"], [24, 10, "rock"]] },
  { id: "flowers-n", kind: "flowers", x: 10.8, y: 1.9, width: 3.0, sprite: "terrain-flowers-1", shadow: false, cells: [[10, 1, "flowers"], [11, 1, "flowers"]] },
  { id: "flowers-ne", kind: "flowers", x: 22.8, y: 2.8, width: 2.7, sprite: "terrain-flowers-2", shadow: false, cells: [[22, 2, "flowers"], [23, 2, "flowers"]] },
  { id: "flowers-s", kind: "flowers", x: 20.8, y: 12.7, width: 2.8, sprite: "terrain-flowers-1", shadow: false, cells: [[20, 12, "flowers"], [21, 12, "flowers"]] },
  { id: "shrub-left", kind: "shrub", x: 1.6, y: 7.8, width: 2.2, sprite: "terrain-shrub-2" },
  { id: "shrub-right", kind: "shrub", x: 28.0, y: 11.2, width: 2.0, sprite: "terrain-shrub-1" },
  { id: "log-west", kind: "log", x: 7.5, y: 11.2, width: 1.8, rotation: -.18 },
  { id: "sign-house", kind: "sign", x: 17.2, y: 8.3, width: 1.0 },
  { id: "ruin-north", kind: "ruin", x: 14.8, y: 1.4, width: 2.0 },
  { id: "fence-house", kind: "fence", x: 12.7, y: 8.6, width: 2.4 },
];

function roadYAt(col: number, points: Array<{ x: number; y: number }>) {
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (col >= left.x && col <= right.x) {
      const progress = (col - left.x) / Math.max(.001, right.x - left.x);
      return left.y + (right.y - left.y) * progress;
    }
  }
  return points.at(-1)?.y ?? 8;
}

function createTiles() {
  const tiles = Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, (_, col): TerrainCell => ({
    surface: "grass", corruption: 0, seed: hashInt(col, row, 17),
    source: null,
  })));
  const road = SCENERY.find((object) => object.kind === "road");
  if (road?.points) {
    let previousRow = Math.floor(roadYAt(.5, road.points));
    for (let col = 0; col < COLS; col += 1) {
      const row = Math.max(0, Math.min(ROWS - 1, Math.floor(roadYAt(col + .5, road.points))));
      tiles[row][col].surface = "road";
      if (row !== previousRow) tiles[previousRow][col].surface = "road";
      previousRow = row;
    }
  }
  for (const object of SCENERY) {
    for (const [col, row, surface] of object.cells ?? []) tiles[row][col].surface = surface;
  }
  for (const key of HOUSE_TILES) {
    const [col, row] = key.split(",").map(Number);
    tiles[row][col].surface = "house";
  }
  return tiles;
}

function nextId(state: GameState) {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function createFacilityFootprint(point: Point, boss: boolean) {
  const across = boss ? 4 : 3;
  const depth = boss ? 3 : 2;
  const cells: Point[] = [];
  if (point.row === 0 || point.row === ROWS - 1) {
    const startCol = Math.max(0, Math.min(COLS - across, point.col - Math.floor(across / 2)));
    const startRow = point.row === 0 ? 0 : ROWS - depth;
    for (let row = startRow; row < startRow + depth; row += 1) for (let col = startCol; col < startCol + across; col += 1) cells.push({ col, row });
  } else {
    const startCol = point.col === 0 ? 1 : COLS - depth - 1;
    const startRow = Math.max(0, Math.min(ROWS - across, point.row - Math.floor(across / 2)));
    for (let row = startRow; row < startRow + across; row += 1) for (let col = startCol; col < startCol + depth; col += 1) cells.push({ col, row });
  }
  return cells;
}

function facilityOutlet(point: Point, footprint: Point[]) {
  if (point.row === 0) return { col: point.col, row: Math.min(ROWS - 1, Math.max(...footprint.map((cell) => cell.row)) + 1) };
  if (point.row === ROWS - 1) return { col: point.col, row: Math.max(0, Math.min(...footprint.map((cell) => cell.row)) - 1) };
  if (point.col === 0) return { col: Math.min(COLS - 1, Math.max(...footprint.map((cell) => cell.col)) + 1), row: point.row };
  return { col: Math.max(0, Math.min(...footprint.map((cell) => cell.col)) - 1), row: point.row };
}

function facilityStage(node: DataNode) { return Math.min(3, Math.floor(node.buildProgress / (node.boss ? 3 : 2))); }

function createNode(state: GameState, point: Point, boss = false) {
  const id = nextId(state);
  const footprint = createFacilityFootprint(point, boss);
  for (const cell of footprint) {
    state.tiles[cell.row][cell.col].surface = "foundation";
    state.tiles[cell.row][cell.col].corruption = 0;
    state.tiles[cell.row][cell.col].source = id;
  }
  state.nodes.push({
    id, col: point.col, row: point.row,
    hp: boss ? 800 : 150, maxHp: boss ? 800 : 150,
    spreadTimer: 1.4, spawnTimer: boss ? 3 : 5,
    boss, buildProgress: 0, footprint, outlet: facilityOutlet(point, footprint),
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
function isObstacle(cell: TerrainCell) { return cell.surface === "forest" || cell.surface === "pond" || cell.surface === "rock" || cell.surface === "flowers" || cell.surface === "foundation"; }
function plantAt(state: GameState, col: number, row: number) { return state.plants.find((plant) => plant.col === col && plant.row === row); }
function nodeAt(state: GameState, col: number, row: number) { return state.nodes.find((node) => node.footprint.some((cell) => cell.col === col && cell.row === row)); }
function distance(aCol: number, aRow: number, bCol: number, bRow: number) { return Math.hypot(aCol - bCol, aRow - bRow); }

function corruptionPercent(state: GameState) {
  let field = 0;
  let corrupted = 0;
  for (const row of state.tiles) {
    for (const cell of row) {
      if (cell.surface === "grass" || cell.surface === "road" || cell.surface === "rubble") field += 1;
      if (cell.corruption >= 3) corrupted += 1;
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
  state.beams.push({ x1, y1, x2, y2, color, life: .34, maxLife: .34 });
}

function targetPosition(target: EnemyEntity | DataNode) {
  if ("kind" in target) return { x: target.x, y: target.y };
  return {
    x: target.footprint.reduce((sum, cell) => sum + cell.col + .5, 0) / target.footprint.length,
    y: target.footprint.reduce((sum, cell) => sum + cell.row + .5, 0) / target.footprint.length,
  };
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
        if (inBounds(col, row) && state.tiles[row][col].corruption > 0 && distance(col, row, plant.col, plant.row) <= radius + .2) candidates.push({ col, row });
      }
    }
    if (candidates.length) break;
  }
  const target = candidates.sort((left, right) => distance(left.col, left.row, plant.col, plant.row) - distance(right.col, right.row, plant.col, plant.row))[0];
  if (!target || nodeAt(state, target.col, target.row)) return;
  const cell = state.tiles[target.row][target.col];
  cell.corruption = Math.max(0, cell.corruption - 1) as CorruptionLevel;
  if (cell.corruption === 0) cell.source = null;
  if (cell.surface === "rubble" && cell.corruption === 0) cell.surface = "grass";
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
    .map(([dc, dr]) => ({ col: node.outlet.col + dc, row: node.outlet.row + dr }))
    .filter((point) => inBounds(point.col, point.row) && !isObstacle(state.tiles[point.row][point.col]) && !HOUSE_TILES.has(tileKey(point.col, point.row)));
  const spawn = neighbors[offset % Math.max(1, neighbors.length)] ?? node.outlet;
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

function spreadCorruption(state: GameState, node: DataNode) {
  const frontier: Array<Point & { nextLevel: CorruptionLevel; score: number }> = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const sourceLevel = state.tiles[row][col].corruption;
      if (sourceLevel === 0 || state.tiles[row][col].source !== node.id) continue;
      for (const [dc, dr] of directions) {
        const next = { col: col + dc, row: row + dr };
        if (!inBounds(next.col, next.row)) continue;
        const cell = state.tiles[next.row][next.col];
        if (cell.surface === "foundation" || cell.surface === "rock" || cell.corruption >= 4) continue;
        if (cell.surface === "house") {
          if (sourceLevel >= 3) finishGame(state, "lost", "AI slop breached the garden perimeter.");
          continue;
        }
        const sameCellStage = sourceLevel < 4 && hashInt(col, row, Math.floor(state.elapsed) + node.id) % 3 === 0;
        const nextLevel = sameCellStage ? Math.min(4, sourceLevel + 1) as CorruptionLevel : 1;
        if (cell.corruption >= nextLevel) continue;
        const conduit = cell.surface === "road" || cell.surface === "pond" ? 6 : 0;
        const connected = distance(col, row, node.outlet.col, node.outlet.row) < 2 ? 4 : 0;
        const towardHouse = 10 - distance(next.col, next.row, HOUSE_COL + 1, HOUSE_ROW + 1);
        frontier.push({ ...next, nextLevel, score: conduit + connected + towardHouse + (hashInt(next.col, next.row, node.id) % 5) });
      }
      if (sourceLevel < 4) frontier.push({ col, row, nextLevel: Math.min(4, sourceLevel + 1) as CorruptionLevel, score: 20 + sourceLevel * 4 });
    }
  }
  if (!frontier.length) return;
  const target = frontier.sort((left, right) => right.score - left.score)[0];
  if (!plantAt(state, target.col, target.row)) {
    state.tiles[target.row][target.col].corruption = target.nextLevel;
    state.tiles[target.row][target.col].source = node.id;
  }
}

function addWaveNode(state: GameState, boss = false) {
  const available = BORDER_SPAWNS.filter((point) => createFacilityFootprint(point, boss).every((cell) => !nodeAt(state, cell.col, cell.row) && !plantAt(state, cell.col, cell.row) && !HOUSE_TILES.has(tileKey(cell.col, cell.row))));
  if (!available.length) return;
  const point = available[Math.floor(Math.random() * available.length)];
  createNode(state, point, boss);
  setMessage(state, boss ? "AI SLOP MAINFRAME ONLINE. Break the feed." : "A fresh AI slop server is poisoning the field.", 4);
}

function updateNodes(state: GameState, dt: number) {
  for (const node of state.nodes) {
    node.buildProgress += dt;
    node.spreadTimer -= dt;
    node.spawnTimer -= dt;
    if (facilityStage(node) >= 2 && node.spreadTimer <= 0) {
      const outlet = state.tiles[node.outlet.row][node.outlet.col];
      outlet.corruption = Math.max(outlet.corruption, facilityStage(node) === 2 ? 1 : 2) as CorruptionLevel;
      outlet.source = node.id;
      spreadCorruption(state, node);
      node.spreadTimer = node.boss ? 1.7 : Math.max(2.2, 3.6 - state.wave * .08);
    }
    if (facilityStage(node) === 3 && node.spawnTimer <= 0) {
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
    for (const cell of node.footprint) {
      state.tiles[cell.row][cell.col].surface = "rubble";
      state.tiles[cell.row][cell.col].corruption = Math.max(2, state.tiles[cell.row][cell.col].corruption) as CorruptionLevel;
      state.tiles[cell.row][cell.col].source = null;
    }
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
  const cell = state.tiles[row][col];
  const valid = state.selected === "rootreclaimer" ? cell.corruption > 0 : cell.surface === "grass" && cell.corruption === 0;
  if (!valid) {
    const tileLabel = cell.surface === "house" ? "the house" : cell.corruption > 0 ? "corrupted ground" : cell.surface;
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
function drawSprite(ctx: CanvasRenderingContext2D, key: string, cx: number, groundY: number, scale = 1, shadow = true) {
  const { img, meta, width, height } = spriteFootprint(key, scale);
  if (shadow) drawGroundShadow(ctx, cx, groundY, width);
  const top = groundY - height * meta.pivotY;
  const left = cx - width / 2;
  if (img) ctx.drawImage(img, left, top, width, height);
  return { width, height, top, left };
}

function edgeMask(tiles: TerrainCell[][], col: number, row: number, minimum: CorruptionLevel) {
  let mask = 0;
  if (row > 0 && tiles[row - 1][col].corruption >= minimum) mask |= 1;
  if (col + 1 < COLS && tiles[row][col + 1].corruption >= minimum) mask |= 2;
  if (row + 1 < ROWS && tiles[row + 1][col].corruption >= minimum) mask |= 4;
  if (col > 0 && tiles[row][col - 1].corruption >= minimum) mask |= 8;
  return mask;
}

function drawPixelCracks(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, color: string) {
  ctx.fillStyle = color;
  const startX = x + 9 + seed % 18;
  const startY = y + 8 + (seed >>> 4) % 16;
  ctx.fillRect(startX, startY, 9, 2);
  ctx.fillRect(startX + 7, startY, 2, 8);
  ctx.fillRect(startX + 7, startY + 6, 7, 2);
}

function drawTile(ctx: CanvasRenderingContext2D, state: GameState, col: number, row: number) {
  const tiles = state.tiles;
  const x = col * TILE;
  const y = row * TILE;
  const cell = tiles[row][col];
  if (cell.surface === "road") {
    ctx.fillStyle = "#9a7447"; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#b18a54"; ctx.fillRect(x, y + 4, TILE, TILE - 9);
    ctx.fillStyle = "#735738";
    if (row === 0 || tiles[row - 1][col].surface !== "road") ctx.fillRect(x, y, TILE, 4);
    if (row + 1 === ROWS || tiles[row + 1][col].surface !== "road") ctx.fillRect(x, y + TILE - 5, TILE, 5);
    ctx.fillStyle = "#d0aa68";
    ctx.fillRect(x + 6 + cell.seed % 15, y + 12, 3, 2);
    ctx.fillRect(x + 22, y + 27 + (cell.seed >>> 6) % 5, 4, 2);
  } else if (cell.surface === "foundation") {
    const node = cell.source === null ? null : state.nodes.find((candidate) => candidate.id === cell.source);
    const stage = node ? facilityStage(node) : 1;
    if (stage === 0) {
      ctx.fillStyle = "#76573b"; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#96704a"; ctx.fillRect(x + 4, y + 4, TILE - 8, 5);
      ctx.fillStyle = "#4e3d31"; ctx.fillRect(x + 7, y + 23, 22, 4);
    } else {
      ctx.fillStyle = "#5f625d"; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#777a72"; ctx.fillRect(x + 2, y + 2, TILE - 4, 4);
      ctx.fillStyle = "#3d403e"; ctx.fillRect(x + 2, y + TILE - 5, TILE - 4, 3);
      ctx.fillStyle = "#9b8a55"; ctx.fillRect(x + 7, y + 9, 3, 3); ctx.fillRect(x + 29, y + 27, 3, 3);
    }
  } else if (cell.surface === "rubble") {
    ctx.fillStyle = "#514d46"; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#79766d";
    ctx.fillRect(x + 4, y + 7, 12, 7); ctx.fillRect(x + 23, y + 5, 9, 12); ctx.fillRect(x + 11, y + 25, 17, 8);
  }

  if (cell.corruption > 0) {
    const palette = ["", "#a79a4e", "#7b663e", "#493d35", "#29242d"];
    ctx.fillStyle = palette[cell.corruption];
    ctx.globalAlpha = cell.surface === "pond" ? .62 : cell.surface === "road" ? .74 : .9;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.globalAlpha = 1;
    const mask = edgeMask(tiles, col, row, cell.corruption);
    ctx.fillStyle = cell.corruption < 3 ? "#c0b15e" : "#17171d";
    if (!(mask & 1)) ctx.fillRect(x, y, TILE, 3);
    if (!(mask & 2)) ctx.fillRect(x + TILE - 3, y, 3, TILE);
    if (!(mask & 4)) ctx.fillRect(x, y + TILE - 3, TILE, 3);
    if (!(mask & 8)) ctx.fillRect(x, y, 3, TILE);
    if (cell.corruption >= 2) drawPixelCracks(ctx, x, y, cell.seed, cell.corruption === 4 ? "#72547a" : "#302a27");
    if (cell.corruption === 1) {
      ctx.fillStyle = "#726f32";
      ctx.fillRect(x + 6 + cell.seed % 21, y + 11, 3, 9);
      ctx.fillRect(x + 25, y + 21 + (cell.seed >>> 8) % 8, 2, 6);
    }
  }

  if (cell.corruption === 0 && cell.surface === "grass" && !HOUSE_TILES.has(tileKey(col, row)) && hashInt(col, row, 1) % 11 === 0) {
    const kind = DECAL_KINDS[hashInt(col, row, 2) % DECAL_KINDS.length];
    const offX = (hashInt(col, row, 3) % 16) - 8;
    const offY = (hashInt(col, row, 4) % 16) - 8;
    const size = TILE * .4;
    const img = getSprite(`decal-${kind}`);
    if (img) ctx.drawImage(img, x + TILE / 2 - size / 2 + offX, y + TILE / 2 - size / 2 + offY, size, size);
  }

}

function drawMeadow(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#78963f";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (let row = 0; row < Math.ceil(CANVAS_HEIGHT / 8); row += 1) {
    for (let col = 0; col < Math.ceil(CANVAS_WIDTH / 8); col += 1) {
      const seed = hashInt(col, row, 211);
      if (seed % 5) continue;
      ctx.fillStyle = seed % 3 ? "#6e8c39" : "#88a84a";
      ctx.fillRect(col * 8 + seed % 5, row * 8 + (seed >>> 6) % 5, 2, 2);
    }
  }
}

function drawSceneryShadow(ctx: CanvasRenderingContext2D, object: SceneryObject) {
  if (object.shadow === false || object.kind === "pond" || object.kind === "flowers") return;
  const width = object.width * TILE;
  ctx.fillStyle = "rgba(24,34,19,.21)";
  ctx.beginPath();
  ctx.ellipse(object.x * TILE, object.y * TILE + 4, width * .3, width * .095, -.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawPrimitiveScenery(ctx: CanvasRenderingContext2D, object: SceneryObject) {
  const x = object.x * TILE;
  const y = object.y * TILE;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(object.rotation ?? 0);
  if (object.kind === "log") {
    ctx.fillStyle = "#4f3323"; ctx.fillRect(-30, -7, 60, 14);
    ctx.fillStyle = "#765034"; ctx.fillRect(-25, -5, 48, 5);
    ctx.fillStyle = "#b18a55"; ctx.beginPath(); ctx.arc(29, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#664327"; ctx.beginPath(); ctx.arc(29, 0, 3.5, 0, Math.PI * 2); ctx.stroke();
  } else if (object.kind === "sign") {
    ctx.fillStyle = "#644126"; ctx.fillRect(-3, -32, 6, 35);
    ctx.fillStyle = "#9c7745"; ctx.fillRect(-17, -32, 35, 14);
    ctx.fillStyle = "#c49b5d"; ctx.fillRect(-13, -29, 25, 3);
  } else if (object.kind === "fence") {
    ctx.fillStyle = "#66462d";
    for (let post = -42; post <= 42; post += 28) ctx.fillRect(post - 3, -22, 6, 26);
    ctx.fillStyle = "#a07b4c"; ctx.fillRect(-47, -16, 94, 5); ctx.fillRect(-47, -4, 94, 5);
  } else if (object.kind === "ruin") {
    ctx.fillStyle = "#545851";
    ctx.fillRect(-28, -25, 15, 29); ctx.fillRect(12, -36, 16, 40); ctx.fillRect(-28, -6, 56, 10);
    ctx.fillStyle = "#858879"; ctx.fillRect(-25, -22, 9, 7); ctx.fillRect(15, -32, 10, 8); ctx.fillRect(-7, -5, 13, 5);
  }
  ctx.restore();
}

function drawPondState(ctx: CanvasRenderingContext2D, object: SceneryObject, state: GameState) {
  const width = object.width * TILE;
  const centerX = object.x * TILE;
  const centerY = object.y * TILE;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, width * .45, width * .19, 0, 0, Math.PI * 2);
  ctx.clip();
  const polluted = (object.cells ?? []).reduce((level, [col, row]) => Math.max(level, state.tiles[row][col].corruption), 0);
  if (polluted > 0) {
    ctx.fillStyle = polluted >= 3 ? "rgba(56,35,65,.65)" : "rgba(109,100,55,.4)";
    ctx.fillRect(centerX - width / 2, centerY - width * .22, width, width * .44);
  }
  const rippleStep = Math.floor(state.elapsed / 4) % 3;
  ctx.strokeStyle = "rgba(211,241,220,.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(centerX - 12 - rippleStep * 4, centerY - 2, 24 + rippleStep * 8, 4 + rippleStep * 2);
  ctx.restore();
}

function drawSceneryObject(ctx: CanvasRenderingContext2D, object: SceneryObject, state: GameState) {
  if (object.kind === "road") return;
  const displaced = (object.cells ?? []).some(([col, row]) => {
    const surface = state.tiles[row][col].surface;
    return surface === "foundation" || surface === "rubble";
  });
  if (displaced) return;
  drawSceneryShadow(ctx, object);
  if (!object.sprite) { drawPrimitiveScenery(ctx, object); return; }
  const img = getSprite(object.sprite);
  if (!img) return;
  const width = object.width * TILE;
  const height = width * img.naturalHeight / img.naturalWidth;
  const corruption = (object.cells ?? []).reduce((level, [col, row]) => Math.max(level, state.tiles[row][col].corruption), 0);
  const pivot = object.kind === "pond" ? .5 : object.kind === "flowers" ? .68 : object.kind === "rock" ? .82 : object.kind === "tree" ? .85 : object.kind === "pine" ? .93 : .88;
  ctx.save();
  ctx.translate(object.x * TILE, object.y * TILE);
  if (corruption >= 2 && (object.kind === "tree" || object.kind === "pine" || object.kind === "flowers" || object.kind === "shrub")) {
    ctx.filter = corruption >= 4 ? "grayscale(1) brightness(.55) sepia(.25)" : "saturate(.45) sepia(.35) brightness(.8)";
  }
  ctx.globalAlpha = object.kind === "flowers" && corruption >= 3 ? .3 : 1;
  ctx.drawImage(img, -width / 2, -height * pivot, width, height);
  ctx.restore();
  if (object.kind === "pond") drawPondState(ctx, object, state);
}

function drawAmbientWorld(ctx: CanvasRenderingContext2D) {
  const light = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  light.addColorStop(0, "rgba(244,237,155,.05)");
  light.addColorStop(.5, "rgba(244,237,155,0)");
  light.addColorStop(1, "rgba(10,32,21,.06)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawWorldMesh(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const cell = state.tiles[row][col];
      if (cell.surface !== "grass" || cell.corruption !== 0 || hashInt(col, row, 93) % 5 !== 0) continue;
      ctx.fillStyle = "rgba(43,91,43,.34)";
      ctx.fillRect((col + .45) * TILE, (row + .48) * TILE, 2, 10);
      ctx.fillRect((col + .34) * TILE, (row + .55) * TILE, 6, 2);
    }
  }
  ctx.restore();
}

function drawCombatEffects(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const beam of state.beams) {
    const progress = 1 - beam.life / beam.maxLife;
    const x1 = beam.x1 * TILE;
    const y1 = beam.y1 * TILE;
    const x2 = beam.x2 * TILE;
    const y2 = beam.y2 * TILE;
    ctx.save();
    ctx.strokeStyle = beam.color;
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.lineWidth = 2.5;
    ctx.shadowColor = beam.color;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 10, x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = (1 - progress) * .7;
    ctx.beginPath();
    ctx.ellipse(x2, y2, 4 + progress * 17, 2 + progress * 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCorruptionDetails(ctx: CanvasRenderingContext2D, tiles: TerrainCell[][]) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (tiles[row][col].corruption < 3) continue;
      const x = (col + .5) * TILE + (hashInt(col, row, 21) % 9) - 4;
      const y = (row + .5) * TILE + (hashInt(col, row, 22) % 7) - 3;
      ctx.fillStyle = tiles[row][col].corruption === 4 ? "#79617f" : "#352f34";
      ctx.fillRect(x - 5, y - 2, 12, 3);
      ctx.fillRect(x + 4, y - 8, 3, 8);
      ctx.fillStyle = "#19181d";
      ctx.fillRect(x + 5, y - 13, 2, 6);
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
  const box = drawSprite(ctx, "obj-house", x, groundY, 1, false);
  const barW = box.width * .55;
  const color = hp > 55 ? "#6aa34a" : hp > 25 ? "#e5b44f" : "#e06c69";
  drawHealth(ctx, x - barW / 2, box.top + 7, barW, hp / 100, color);
}

function drawPlant(ctx: CanvasRenderingContext2D, plant: PlantEntity, state: GameState) {
  const x = plant.col * TILE + TILE / 2;
  const groundY = plant.row * TILE + TILE / 2;
  const disabled = plant.disabledUntil > state.elapsed;
  const mature = plant.kind !== "elderoak" || plant.age >= 15;
  const growth = Math.min(1, plant.age / .32);
  const scale = (plant.kind === "elderoak" && !mature ? .6 + .4 * (plant.age / 15) : 1) * growth;
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

function drawNode(ctx: CanvasRenderingContext2D, node: DataNode) {
  const stage = facilityStage(node);
  const minCol = Math.min(...node.footprint.map((cell) => cell.col));
  const maxCol = Math.max(...node.footprint.map((cell) => cell.col));
  const minRow = Math.min(...node.footprint.map((cell) => cell.row));
  const maxRow = Math.max(...node.footprint.map((cell) => cell.row));
  const left = minCol * TILE;
  const right = (maxCol + 1) * TILE;
  const bottom = (maxRow + 1) * TILE;
  const centerX = (left + right) / 2;
  if (stage === 0) {
    ctx.fillStyle = "#9b7a42";
    for (const cell of node.footprint) {
      ctx.fillRect(cell.col * TILE + 5, cell.row * TILE + 5, TILE - 10, 3);
      ctx.fillRect(cell.col * TILE + 5, cell.row * TILE + TILE - 8, TILE - 10, 3);
    }
    ctx.fillStyle = "#d0a943"; ctx.fillRect(centerX - 13, bottom - 26, 26, 14);
    ctx.fillStyle = "#353b39"; ctx.fillRect(centerX - 18, bottom - 13, 36, 8);
  } else {
    const wallHeight = stage === 1 ? 23 : stage === 2 ? 43 : node.boss ? 76 : 58;
    ctx.fillStyle = "#2d3135"; ctx.fillRect(left + 4, bottom - wallHeight, right - left - 8, wallHeight - 4);
    ctx.fillStyle = stage === 1 ? "#77766d" : "#687078"; ctx.fillRect(left + 8, bottom - wallHeight + 5, right - left - 16, wallHeight - 13);
    ctx.fillStyle = "#25282c";
    for (let x = left + 15; x < right - 12; x += 22) ctx.fillRect(x, bottom - wallHeight + 12, 12, wallHeight - 25);
    if (stage >= 2) {
      ctx.fillStyle = "#171b1e"; ctx.fillRect(centerX - 10, bottom - 24, 20, 20);
      ctx.fillStyle = "#758343"; ctx.fillRect(centerX - 6, bottom - 18, 3, 3); ctx.fillRect(centerX + 3, bottom - 18, 3, 3);
      ctx.fillStyle = "#40464c"; ctx.fillRect(left + 12, bottom - wallHeight - 9, 22, 9); ctx.fillRect(right - 35, bottom - wallHeight - 9, 22, 9);
    }
    if (stage === 3) {
      ctx.strokeStyle = "#22232a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(centerX, bottom); ctx.lineTo(node.outlet.col * TILE + TILE / 2, node.outlet.row * TILE + TILE / 2); ctx.stroke();
      ctx.fillStyle = "#a5613e"; ctx.fillRect(left + 5, bottom - wallHeight + 8, 4, 12);
    }
  }
  drawHealth(ctx, centerX - 26, minRow * TILE - 10, 52, node.hp / node.maxHp);
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity, time: number) {
  const x = enemy.x * TILE;
  const groundY = enemy.y * TILE;
  const hitJitter = Math.floor(time * 20 + enemy.id) % 17 === 0 ? 1 : 0;
  const box = drawSprite(ctx, enemySpriteKey(enemy.kind), x + hitJitter, groundY);
  drawHealth(ctx, x - 14, box.top - 8, 28, enemy.hp / enemy.maxHp);
}

function renderGame(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  drawMeadow(ctx);
  drawAmbientWorld(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FIELD_TOP, FIELD_WIDTH, FIELD_HEIGHT);
  ctx.clip();
  ctx.translate(0, FIELD_TOP);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) drawTile(ctx, state, col, row);
  }
  drawCorruptionDetails(ctx, state.tiles);
  for (const object of SCENERY) {
    if (object.kind === "pond" || object.kind === "flowers") drawSceneryObject(ctx, object, state);
  }
  drawWorldMesh(ctx, state);
  ctx.restore();
  ctx.save();
  ctx.translate(0, FIELD_TOP);
  const renderables = [
    { depth: HOUSE_ROW + 1, draw: () => drawHouse(ctx, state.houseHp) },
    ...SCENERY.filter((object) => object.kind !== "road" && object.kind !== "pond" && object.kind !== "flowers")
      .map((object) => ({ depth: object.y, draw: () => drawSceneryObject(ctx, object, state) })),
    ...state.plants.map((plant) => ({ depth: plant.row + .5, draw: () => drawPlant(ctx, plant, state) })),
    ...state.nodes.map((node) => ({ depth: Math.max(...node.footprint.map((cell) => cell.row)) + 1, draw: () => drawNode(ctx, node) })),
    ...state.enemies.map((enemy) => ({ depth: enemy.y, draw: () => drawEnemy(ctx, enemy, state.elapsed) })),
  ].sort((left, right) => left.depth - right.depth);
  for (const renderable of renderables) renderable.draw();
  drawCombatEffects(ctx, state);
  if (state.houseHp < 75) {
    const houseX = (HOUSE_COL + 1) * TILE;
    const houseY = (HOUSE_ROW + .2) * TILE;
    for (let puff = 0; puff < 3; puff += 1) {
      const rise = (state.elapsed * (8 + puff * 2) + puff * 17) % 42;
      ctx.fillStyle = `rgba(54,49,45,${.16 * (1 - rise / 42)})`;
      ctx.beginPath();
      ctx.arc(houseX - 17 + Math.sin(state.elapsed + puff) * 5, houseY - rise, 5 + puff, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (state.status === "playing") {
    ctx.strokeStyle = "#f4ef9d";
    ctx.lineWidth = 3;
    ctx.strokeRect(state.cursor.col * TILE + 3, state.cursor.row * TILE + 3, TILE - 6, TILE - 6);
  }
  ctx.restore();
  ctx.restore();
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
