"use client";

import { useEffect, useRef, useState } from "react";

const COLS = 30;
const ROWS = 14;
const TILE = 40;
const CANVAS_WIDTH = COLS * TILE;
const CANVAS_HEIGHT = ROWS * TILE;
const HOUSE_COL = 14;
const HOUSE_ROW = 6;
const HOUSE_TILES = new Set(["14,6", "15,6", "14,7", "15,7"]);
const STORAGE_KEY = "gimmejob.rewild.best.v1";

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

function createGameState(best: number, status: GameStatus = "playing"): GameState {
  const state: GameState = {
    status, tiles: createTiles(), plants: [], enemies: [], nodes: [], beams: [],
    sunlight: 120, houseHp: 100, wave: 1, nextWave: 24, elapsed: 0, score: 0,
    selected: "vinewhip", cursor: { col: 13, row: 5 }, message: "AI slop detected. Grow weapons.", messageUntil: 3,
    bossSpawned: false, nextId: 1, best,
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
  state.enemies.push({
    id: nextId(state), kind, x: spawn.col + .5 + offset * .03, y: spawn.row + .5 + offset * .03,
    hp: config.hp, maxHp: config.hp, cooldown: .4, pathTimer: 0, path: [], slowUntil: 0,
  });
}

function spawnEnemyAt(state: GameState, kind: EnemyKind, x: number, y: number) {
  const config = ENEMIES[kind];
  state.enemies.push({ id: nextId(state), kind, x, y, hp: config.hp, maxHp: config.hp, cooldown: .4, pathTimer: 0, path: [], slowUntil: 0 });
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
      plant.hp -= ENEMIES[enemy.kind].damage;
      enemy.cooldown = 1;
      addBeam(state, enemy.x, enemy.y, plant.col + .5, plant.row + .5, "#c8ff45");
    }
    return true;
  }
  if (HOUSE_TILES.has(tileKey(targetCol, targetRow))) {
    if (enemy.cooldown <= 0) {
      const nextHp = state.houseHp - ENEMIES[enemy.kind].damage;
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
    const step = ENEMIES[enemy.kind].speed * slow * dt;
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
  state.nextWave = Math.max(15, 25 - state.wave);
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
    best: state.best, plants: state.plants.length, enemies: state.enemies.length, nodes: state.nodes.length,
  };
}

function drawTile(ctx: CanvasRenderingContext2D, tile: TileKind, col: number, row: number, time: number) {
  const x = col * TILE;
  const y = row * TILE;
  const grass = (col + row) % 2 === 0 ? "#88ad56" : "#82a951";
  ctx.fillStyle = tile === "corrupt" ? "#5d666a" : tile === "house" ? "#8aac57" : grass;
  ctx.fillRect(x, y, TILE, TILE);
  if (tile === "grass" || tile === "house") {
    ctx.fillStyle = "rgba(49,91,45,.22)";
    ctx.fillRect(x + 7 + ((col * 5 + row * 3) % 17), y + 9, 2, 5);
    ctx.fillRect(x + 25, y + 26 + ((col + row) % 4), 2, 4);
  }
  if (tile === "corrupt") {
    ctx.fillStyle = "#6c777b";
    ctx.fillRect(x + 2, y + 2, 17, 16);
    ctx.fillRect(x + 22, y + 20, 16, 18);
    ctx.fillStyle = Math.floor(time * 8 + col + row) % 3 === 0 ? "#c8f348" : "#798487";
    ctx.fillRect(x + 5, y + 10, 10, 2);
    ctx.fillRect(x + 24, y + 28, 11, 2);
  }
  if (tile === "forest") {
    ctx.fillStyle = "#4c6b38"; ctx.fillRect(x + 6, y + 14, 28, 22);
    ctx.fillStyle = "#2f5132"; ctx.fillRect(x + 10, y + 5, 20, 23);
    ctx.fillStyle = "#6f4f30"; ctx.fillRect(x + 18, y + 28, 5, 10);
  } else if (tile === "pond") {
    ctx.fillStyle = "#6aa6a2"; ctx.fillRect(x + 3, y + 8, 34, 28);
    ctx.fillStyle = "#9dc7b4"; ctx.fillRect(x + 8, y + 13, 12, 3); ctx.fillRect(x + 23, y + 25, 9, 3);
  } else if (tile === "rock") {
    ctx.fillStyle = "#7b8175"; ctx.fillRect(x + 8, y + 15, 25, 19);
    ctx.fillStyle = "#a5a897"; ctx.fillRect(x + 12, y + 11, 14, 6);
  } else if (tile === "flowers") {
    ctx.fillStyle = "#f2d86f"; ctx.fillRect(x + 8, y + 10, 6, 6); ctx.fillRect(x + 25, y + 17, 6, 6);
    ctx.fillStyle = "#f2a6a0"; ctx.fillRect(x + 17, y + 27, 6, 6); ctx.fillStyle = "#4f793d"; ctx.fillRect(x + 10, y + 16, 2, 14); ctx.fillRect(x + 27, y + 23, 2, 10);
  }
  ctx.strokeStyle = "rgba(34,58,37,.08)";
  ctx.strokeRect(x, y, TILE, TILE);
}

function drawHouse(ctx: CanvasRenderingContext2D, hp: number) {
  const x = HOUSE_COL * TILE;
  const y = HOUSE_ROW * TILE;
  ctx.fillStyle = "rgba(45,61,39,.18)"; ctx.fillRect(x + 7, y + 18, 70, 60);
  ctx.fillStyle = "#ead7a0"; ctx.fillRect(x + 10, y + 29, 60, 43);
  ctx.fillStyle = "#9b553d"; ctx.fillRect(x + 5, y + 20, 70, 16); ctx.fillRect(x + 15, y + 12, 50, 9);
  ctx.fillStyle = "#68452e"; ctx.fillRect(x + 32, y + 48, 15, 24);
  ctx.fillStyle = "#8bc4c0"; ctx.fillRect(x + 17, y + 45, 10, 10); ctx.fillRect(x + 53, y + 45, 10, 10);
  ctx.fillStyle = hp > 55 ? "#6aa34a" : hp > 25 ? "#e5b44f" : "#e06c69"; ctx.fillRect(x + 8, y + 4, Math.max(0, 64 * (hp / 100)), 4);
  ctx.strokeStyle = "#273b2d"; ctx.strokeRect(x + 8, y + 3, 64, 6);
}

function drawHealth(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, ratio: number, color = "#de6e70") {
  ctx.fillStyle = "rgba(24,30,29,.7)"; ctx.fillRect(x, y, width, 4);
  ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * ratio), 2);
}

function drawPlant(ctx: CanvasRenderingContext2D, plant: PlantEntity, state: GameState) {
  const x = plant.col * TILE;
  const y = plant.row * TILE;
  const disabled = plant.disabledUntil > state.elapsed;
  ctx.save();
  if (disabled) ctx.globalAlpha = .52;
  if (plant.kind === "sunbloom") {
    ctx.fillStyle = "#4f793d"; ctx.fillRect(x + 19, y + 19, 4, 17);
    ctx.fillStyle = "#f5d85a"; ctx.fillRect(x + 12, y + 9, 18, 18); ctx.fillStyle = "#a66b35"; ctx.fillRect(x + 17, y + 14, 8, 8);
  } else if (plant.kind === "thornbramble") {
    ctx.fillStyle = "#3e6035"; ctx.fillRect(x + 6, y + 14, 28, 22); ctx.fillStyle = "#a6cf62";
    ctx.fillRect(x + 5, y + 12, 7, 4); ctx.fillRect(x + 27, y + 9, 5, 8); ctx.fillRect(x + 30, y + 29, 7, 4);
  } else if (plant.kind === "sporecap") {
    ctx.fillStyle = "#e1b5e9"; ctx.fillRect(x + 8, y + 10, 25, 13); ctx.fillStyle = "#8b5a9a"; ctx.fillRect(x + 12, y + 8, 17, 5);
    ctx.fillStyle = "#e8d5b6"; ctx.fillRect(x + 17, y + 22, 8, 14);
  } else if (plant.kind === "vinewhip") {
    ctx.fillStyle = "#416f36"; ctx.fillRect(x + 17, y + 15, 6, 21); ctx.fillRect(x + 20, y + 10, 14, 5); ctx.fillRect(x + 29, y + 7, 5, 9);
    ctx.fillStyle = "#9bd052"; ctx.fillRect(x + 8, y + 18, 12, 7); ctx.fillRect(x + 19, y + 26, 13, 7);
  } else if (plant.kind === "rootreclaimer") {
    ctx.fillStyle = "#d0c28b"; ctx.fillRect(x + 16, y + 7, 9, 13); ctx.fillStyle = "#5c913f"; ctx.fillRect(x + 9, y + 17, 23, 13);
    ctx.fillStyle = "#b6e377"; ctx.fillRect(x + 6, y + 25, 9, 5); ctx.fillRect(x + 27, y + 27, 9, 5);
  } else {
    const mature = plant.age >= 15;
    ctx.fillStyle = "#765035"; ctx.fillRect(x + 17, y + 18, 8, 19);
    ctx.fillStyle = mature ? "#345b32" : "#638849"; ctx.fillRect(x + (mature ? 4 : 9), y + (mature ? 3 : 9), mature ? 33 : 23, mature ? 24 : 18);
    if (!mature) { ctx.fillStyle = "#f1d36a"; ctx.fillRect(x + 7, y + 4, Math.min(26, (plant.age / 15) * 26), 3); }
  }
  if (disabled) {
    ctx.globalAlpha = .95; ctx.fillStyle = "#fafafa"; ctx.fillRect(x + 5, y + 4, 31, 13); ctx.fillStyle = "#ee78b9"; ctx.fillRect(x + 9, y + 8, 21, 2);
  }
  ctx.restore();
  drawHealth(ctx, x + 7, y + 36, 26, plant.hp / PLANTS[plant.kind].maxHp, "#77b956");
}

function drawNode(ctx: CanvasRenderingContext2D, node: DataNode, time: number) {
  const x = node.col * TILE;
  const y = node.row * TILE;
  const glitch = Math.floor(time * 11 + node.id) % 5 === 0 ? 3 : 0;
  ctx.fillStyle = node.boss ? "#333b42" : "#4c555b"; ctx.fillRect(x + 5 - glitch, y + 4, node.boss ? 34 : 30, 33);
  ctx.fillStyle = "#919ba0"; ctx.fillRect(x + 9, y + 8, 22, 5); ctx.fillRect(x + 9, y + 18, 22, 5); ctx.fillRect(x + 9, y + 28, 22, 5);
  ctx.fillStyle = Math.floor(time * 7) % 2 ? "#d9f54f" : "#ff6fb4"; ctx.fillRect(x + 12, y + 10, 4, 2); ctx.fillRect(x + 23, y + 20, 5, 2); ctx.fillRect(x + 14, y + 30, 9, 2);
  if (node.boss) { ctx.fillStyle = "#d9f54f"; ctx.fillRect(x + 2, y + 12, 5, 5); ctx.fillRect(x + 33, y + 19, 5, 5); }
  drawHealth(ctx, x + 4, y + 1, 32, node.hp / node.maxHp);
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity, time: number) {
  const config = ENEMIES[enemy.kind];
  const x = Math.round(enemy.x * TILE);
  const y = Math.round(enemy.y * TILE);
  const glitch = Math.floor(time * 13 + enemy.id) % 7 === 0 ? 3 : 0;
  ctx.fillStyle = config.color;
  if (enemy.kind === "clickbait") {
    ctx.fillRect(x - 10 + glitch, y - 7, 20, 15); ctx.fillRect(x - 14, y - 3, 5, 4); ctx.fillRect(x + 9, y + 2, 7, 4);
    ctx.fillStyle = "#24312f"; ctx.fillRect(x - 5, y - 3, 3, 3); ctx.fillRect(x + 4, y - 4, 4, 4);
  } else if (enemy.kind === "deepfake" || enemy.kind === "fragment") {
    const size = enemy.kind === "fragment" ? 12 : 22;
    ctx.fillRect(x - size / 2 + glitch, y - size / 2, size, size); ctx.fillRect(x - size / 2 - 4, y + 2, 5, 9); ctx.fillRect(x + size / 2 - 1, y - 1, 7, 5);
    ctx.fillStyle = "#eef3df"; ctx.fillRect(x - 6, y - 5, 5, 5); ctx.fillRect(x + 3, y - 2, 3, 7); ctx.fillStyle = "#2c3333"; ctx.fillRect(x - 4, y - 3, 2, 2); ctx.fillRect(x + 4, y, 2, 2);
  } else {
    ctx.fillRect(x - 11 + glitch, y - 9, 22, 18); ctx.fillStyle = "#fff"; ctx.fillRect(x - 8, y - 5, 16, 9); ctx.fillStyle = "#ef5aa6"; ctx.fillRect(x - 5, y - 2, 10, 2); ctx.fillRect(x + 7, y - 13, 6, 6);
  }
  drawHealth(ctx, x - 12, y - 15, 24, enemy.hp / enemy.maxHp);
}

function renderGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) drawTile(ctx, state.tiles[row][col], col, row, state.elapsed);
  }
  ctx.fillStyle = "rgba(243,217,115,.12)"; ctx.fillRect((HOUSE_COL - 4) * TILE, (HOUSE_ROW - 4) * TILE, 10 * TILE, 10 * TILE);
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
  if (corruptionPercent(state) > 18) {
    ctx.fillStyle = `rgba(205,255,65,${Math.min(.08, corruptionPercent(state) / 1200)})`;
    for (let y = Math.floor(state.elapsed * 25) % 8; y < CANVAS_HEIGHT; y += 8) ctx.fillRect(0, y, CANVAS_WIDTH, 1);
  }
}

const PLANT_TIPS: Record<PlantKind, string> = {
  sunbloom: "Grows sunlight, your currency",
  thornbramble: "Blocks the path, hits close enemies",
  vinewhip: "Hits from range and slows enemies",
  sporecap: "Damages every enemy nearby at once",
  rootreclaimer: "Heals corrupted ground it stands on",
  elderoak: "Grows into a powerful late-game guardian",
};

const ENEMY_TIPS: Record<Exclude<EnemyKind, "fragment">, string> = {
  clickbait: "Fast and weak, rushes in groups",
  deepfake: "Slow and tough, splits when killed",
  popup: "Disables your nearest plant",
};

function TutorialIcon({ paint }: { paint: (ctx: CanvasRenderingContext2D) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TILE, TILE);
    paint(ctx);
  }, [paint]);
  return <canvas ref={ref} width={TILE} height={TILE} aria-hidden="true"/>;
}

function plantIconPaint(kind: PlantKind) {
  return (ctx: CanvasRenderingContext2D) => {
    const plant: PlantEntity = { id: 0, kind, col: 0, row: 0, hp: PLANTS[kind].maxHp, cooldown: 0, age: kind === "elderoak" ? 20 : 0, reclaimTimer: 0, disabledUntil: 0 };
    drawPlant(ctx, plant, { elapsed: 0 } as GameState);
  };
}

function enemyIconPaint(kind: EnemyKind) {
  return (ctx: CanvasRenderingContext2D) => {
    const config = ENEMIES[kind];
    const enemy: EnemyEntity = { id: 0, kind, x: .5, y: .5, hp: config.hp, maxHp: config.hp, cooldown: 0, pathTimer: 0, path: [], slowUntil: 0 };
    drawEnemy(ctx, enemy, 0);
  };
}

function nodeIconPaint() {
  return (ctx: CanvasRenderingContext2D) => {
    const node: DataNode = { id: 0, col: 0, row: 0, hp: 150, maxHp: 150, spreadTimer: 0, spawnTimer: 0, boss: false };
    drawNode(ctx, node, 0);
  };
}

function houseIconPaint(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ead7a0"; ctx.fillRect(6, 18, 28, 18);
  ctx.fillStyle = "#9b553d"; ctx.fillRect(3, 10, 34, 10); ctx.fillRect(9, 5, 22, 6);
  ctx.fillStyle = "#68452e"; ctx.fillRect(17, 26, 8, 10);
  ctx.fillStyle = "#8bc4c0"; ctx.fillRect(9, 21, 6, 6); ctx.fillRect(25, 21, 6, 6);
}

function RewildQuickGuide() {
  return (
    <section className="rw-tut-section">
      <span>SIXTY-SECOND GUIDE</span>
      <h2>What does what</h2>
      <div className="rw-tut-group">
        <h3>Plant these</h3>
        <div className="rw-tut-row">
          {PLANT_ORDER.map((kind) => (
            <div className="rw-tut-block" key={kind}>
              <TutorialIcon paint={plantIconPaint(kind)}/>
              <span className="rw-tut-arrow">→</span>
              <p><strong>{PLANTS[kind].name}</strong>{PLANT_TIPS[kind]}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rw-tut-group">
        <h3>Watch for these</h3>
        <div className="rw-tut-row">
          {(["clickbait", "deepfake", "popup"] as const).map((kind) => (
            <div className="rw-tut-block" key={kind}>
              <TutorialIcon paint={enemyIconPaint(kind)}/>
              <span className="rw-tut-arrow">→</span>
              <p><strong>{ENEMIES[kind].name}</strong>{ENEMY_TIPS[kind]}</p>
            </div>
          ))}
          <div className="rw-tut-block">
            <TutorialIcon paint={nodeIconPaint()}/>
            <span className="rw-tut-arrow">→</span>
            <p><strong>AI Slop Server</strong>Spawns enemies and spreads corruption, destroy it</p>
          </div>
        </div>
      </div>
      <div className="rw-tut-group">
        <h3>Your goal</h3>
        <div className="rw-tut-row">
          <div className="rw-tut-block">
            <TutorialIcon paint={houseIconPaint}/>
            <span className="rw-tut-arrow">→</span>
            <p><strong>The house</strong>Defend it, game over at 0 HP</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function RewildGuide({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="kb-content rw-page">
      <header className="rw-guide-head"><span>ANTI-SLOP FIELD MANUAL / 01</span><h1>How to fight AI slop</h1><p>Plants are weapons, sunlight is ammunition, and every concrete-grey tile is territory stolen by the feed.</p><button className="rw-guide-play" onClick={onPlay}>Open the battlefield</button></header>
      <RewildQuickGuide/>
      <section className="rw-guide-grid">
        <article><span>01</span><h2>Arm</h2><p>Plant defenses on healthy grass. Sunblooms fund the fight; blockers and attackers turn the path into a trap.</p></article>
        <article><span>02</span><h2>Crush</h2><p>AI slop servers spread corruption and manufacture junk. Reach them with Vinewhips, Sporecaps, and mature Elder Oaks.</p></article>
        <article><span>03</span><h2>Reclaim</h2><p>Rootreclaimers invade corrupted tiles. Give them time and they rip the grey rot out of nearby ground.</p></article>
        <article><span>04</span><h2>Erase</h2><p>Destroy every AI slop server and the Mainframe, clear the remaining sludge, and take back every tile.</p></article>
      </section>
      <section className="rw-field-guide">
        <div><span>DEFENDERS</span><h2>Weapons that grow</h2></div>
        <div className="rw-guide-list">{PLANT_ORDER.map((kind) => <article key={kind}><i style={{ background: PLANTS[kind].color }}/><div><strong>{PLANTS[kind].name}</strong><span>{PLANTS[kind].role} · {PLANTS[kind].cost} sun · wave {PLANTS[kind].unlockWave}</span><p>{PLANTS[kind].detail}</p></div></article>)}</div>
      </section>
      <section className="rw-field-guide rw-enemy-guide">
        <div><span>AI SLOP</span><h2>Targets to destroy</h2></div>
        <div className="rw-guide-list">{(["clickbait", "deepfake", "popup"] as EnemyKind[]).map((kind) => <article key={kind}><i style={{ background: ENEMIES[kind].color }}/><div><strong>{ENEMIES[kind].name}</strong><span>{ENEMIES[kind].hp} HP · speed {ENEMIES[kind].speed}</span><p>{kind === "clickbait" ? "Fast, disposable, and engineered to steal attention." : kind === "deepfake" ? "Slow synthetic sludge. Splits into two more problems when destroyed." : "A hostile popup that disables defenders with junk nobody requested."}</p></div></article>)}</div>
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
  const [ui, setUi] = useState<UiSnapshot>(() => toUi(createGameState(0, "menu")));

  useEffect(() => {
    let best = 0;
    try { best = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0) || 0; } catch { /* local persistence is optional */ }
    stateRef.current = createGameState(best, "menu");
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
        renderGame(context, state);
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
    stateRef.current = createGameState(best);
    lastFrameRef.current = 0;
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
    const bounds = canvas.getBoundingClientRect();
    const boardRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
    const boxRatio = bounds.width / bounds.height;
    const renderedWidth = boxRatio > boardRatio ? bounds.height * boardRatio : bounds.width;
    const renderedHeight = boxRatio > boardRatio ? bounds.height : bounds.width / boardRatio;
    const offsetX = (bounds.width - renderedWidth) / 2;
    const offsetY = (bounds.height - renderedHeight) / 2;
    const x = event.clientX - bounds.left - offsetX;
    const y = event.clientY - bounds.top - offsetY;
    if (x < 0 || y < 0 || x >= renderedWidth || y >= renderedHeight) return;
    const col = Math.floor((x / renderedWidth) * COLS);
    const row = Math.floor((y / renderedHeight) * ROWS);
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
          <div className="rw-hud-brand"><span>Pixel defense · final stand</span><strong>Fight AI slop</strong><small>{ui.best.toLocaleString()} best</small></div>
          <div><span>Sunlight</span><strong>{ui.sunlight}</strong></div>
          <div><span>House</span><strong>{ui.houseHp}%</strong></div>
          <div><span>Corruption</span><strong>{ui.corruption}%</strong></div>
          <div><span>Wave</span><strong>{ui.wave} · {ui.nextWave}s</strong></div>
          <div><span>Score</span><strong>{ui.score.toLocaleString()}</strong></div>
        </div>

        <div className="rw-stage">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onClick={onCanvasClick} onKeyDown={onCanvasKeyDown} tabIndex={0} aria-label="A thirty by fourteen pixel field under attack by AI slop. Select a plant, then click a tile or use arrow keys and Enter to plant."/>
          {overlay && (
            <div className={`rw-overlay rw-overlay-${ui.status}`}>
              <span>{ui.status === "menu" ? "AI SLOP DETECTED" : ui.status === "won" ? "FEED TERMINATED" : "AI SLOP WON"}</span>
              <h2>{ui.status === "menu" ? "Fight back." : ui.status === "won" ? "AI slop erased." : "The feed ate everything."}</h2>
              <p>{ui.status === "menu" ? "AI slop servers are poisoning the field. Grow defenses, break the feed, and keep the last human house standing." : ui.message}</p>
              {ui.status !== "menu" && <div className="rw-result"><span>{ui.wave} waves</span><span>{formatTime(ui.elapsed)}</span><span>{ui.score.toLocaleString()} score</span></div>}
              <div className="rw-overlay-actions">
                <button onClick={start}>{ui.status === "menu" ? "Start the fight" : "Fight again"}</button>
              </div>
            </div>
          )}
          {ui.status === "paused" && <div className="rw-pause-card"><span>PAUSED</span><strong>AI slop is still waiting. It never gets tired.</strong><button onClick={togglePause}>Resume</button></div>}
        </div>

        <div className="rw-status-line"><span>{ui.message}</span><small>{ui.enemies} AI slop · {ui.nodes} slop servers · {ui.plants} defenders</small></div>

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

        <footer className="rw-controls">
          <p><strong>Plant:</strong> choose a card or press 1–6, then click a tile. Keyboard: arrows + Enter. Rootreclaimers only grow on corruption.</p>
          <div><button onClick={() => onViewChange("guide")}>Field guide</button><button onClick={togglePause} disabled={ui.status === "menu" || ui.status === "won" || ui.status === "lost"}>{ui.status === "paused" ? "Resume" : "Pause"}</button><button onClick={start}>Restart</button></div>
        </footer>
      </section>
    </div>
  );
}
