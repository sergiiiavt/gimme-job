export const HEX_COLS = 30;
export const HEX_ROWS = 14;
export const HEX_SIZE = 25;
export const HEX_WIDTH = HEX_SIZE * 2;
export const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;
export const HEX_X_STEP = HEX_SIZE * 1.5;
export const FIELD_LEFT = 28;
export const FIELD_TOP = 17;
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 675;
export const MAP_SEED = 0x5e7a11;

export type SurfaceKind = "meadow" | "road" | "water" | "house" | "foundation" | "rubble";
export type CorruptionLevel = 0 | 1 | 2 | 3 | 4;
export type PlantKind = "sunbloom" | "thornbramble" | "sporecap" | "vinewhip" | "rootreclaimer" | "elderoak";
export type EnemyKind = "clickbait" | "deepfake" | "popup" | "fragment";
export type GameStatus = "menu" | "playing" | "paused" | "won" | "lost";
export type Difficulty = "easy" | "normal" | "hard";
export type RewildReviewState = "damage" | "collapse" | "reclamation" | "ecosystem";
export type WorldEffectKind = "construction" | "impact" | "shutdown" | "collapse" | "reclaim";

export interface HexCoord { q: number; r: number }
export interface PixelPoint { x: number; y: number }
export interface HexCell {
  hex: HexCoord;
  surface: SurfaceKind;
  corruption: CorruptionLevel;
  source: number | null;
  seed: number;
  moisture: number;
  detail: number;
  readability: number;
}

export type WorldObjectKind = "house" | "tree" | "pine" | "pond" | "rock" | "flowers" | "shrub" | "log" | "fence" | "sign" | "ruin";
export interface WorldObject {
  id: string;
  kind: WorldObjectKind;
  anchor: HexCoord;
  footprint: HexCoord[];
  sprite?: string;
  width: number;
  collision: boolean;
  shadow: boolean;
  rotation?: number;
}

export interface RoadNetwork { id: string; cells: HexCoord[]; points: HexCoord[] }
export interface HexWorld {
  seed: number;
  cells: Map<string, HexCell>;
  objects: WorldObject[];
  road: RoadNetwork;
}

export interface PlantConfig { name: string; shortName: string; cost: number; role: string; detail: string; unlockWave: number; color: string; maxHp: number }
export interface EnemyConfig { name: string; hp: number; speed: number; damage: number; color: string }
export interface DifficultyConfig { name: string; description: string; sunlightStart: number; houseHp: number; enemyHp: number; enemySpeed: number; enemyDamage: number; waveTime: number }

export const PLANT_ORDER: PlantKind[] = ["sunbloom", "thornbramble", "sporecap", "vinewhip", "rootreclaimer", "elderoak"];
export const PLANTS: Record<PlantKind, PlantConfig> = {
  sunbloom: { name: "Sunbloom", shortName: "Sun", cost: 25, role: "Economy", detail: "+2 sunlight each second", unlockWave: 1, color: "#f3c94f", maxHp: 45 },
  thornbramble: { name: "Thornbramble", shortName: "Thorn", cost: 40, role: "Blocker", detail: "Blocks and shreds adjacent AI slop", unlockWave: 1, color: "#597b39", maxHp: 100 },
  vinewhip: { name: "Vinewhip", shortName: "Vine", cost: 50, role: "Ranged", detail: "Long reach and a slowing hit", unlockWave: 1, color: "#7fad4d", maxHp: 55 },
  sporecap: { name: "Sporecap", shortName: "Spore", cost: 60, role: "Area damage", detail: "Pulses damage across nearby hexes", unlockWave: 2, color: "#c99ed8", maxHp: 50 },
  rootreclaimer: { name: "Rootreclaimer", shortName: "Root", cost: 45, role: "Reclaim", detail: "Grows on corruption; nearby trees extend and accelerate its roots", unlockWave: 1, color: "#79b57b", maxHp: 65 },
  elderoak: { name: "Elder Oak", shortName: "Oak", cost: 150, role: "Late game", detail: "Matures into a powerful guardian", unlockWave: 4, color: "#9a6a3d", maxHp: 300 },
};

export const ENEMIES: Record<EnemyKind, EnemyConfig> = {
  clickbait: { name: "AI Slop Swarm", hp: 10, speed: 1.15, damage: 2, color: "#d7f04f" },
  deepfake: { name: "Deepfake Sludge", hp: 60, speed: .55, damage: 6, color: "#8da1ad" },
  popup: { name: "Popup Parasite", hp: 25, speed: .48, damage: 4, color: "#f08fc5" },
  fragment: { name: "AI Slop Fragment", hp: 15, speed: .9, damage: 3, color: "#a5b7bd" },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard"];
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { name: "Easy", description: "Extra sunlight, slower and weaker AI slop.", sunlightStart: 160, houseHp: 130, enemyHp: .75, enemySpeed: .85, enemyDamage: .7, waveTime: 1.25 },
  normal: { name: "Normal", description: "The standard fight against AI slop.", sunlightStart: 120, houseHp: 100, enemyHp: 1, enemySpeed: 1, enemyDamage: 1, waveTime: 1 },
  hard: { name: "Hard", description: "Less sunlight, faster and tougher AI slop.", sunlightStart: 90, houseHp: 80, enemyHp: 1.35, enemySpeed: 1.15, enemyDamage: 1.4, waveTime: .8 },
};

export interface PlantEntity extends HexCoord {
  id: number;
  kind: PlantKind;
  hp: number;
  cooldown: number;
  age: number;
  reclaimTimer: number;
  disabledUntil: number;
  reclaimTarget: HexCoord | null;
  reclaimUntil: number;
  attackTarget: HexCoord | null;
  attackUntil: number;
}

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  position: PixelPoint;
  hex: HexCoord;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  cooldown: number;
  pathTimer: number;
  path: HexCoord[];
  slowUntil: number;
  breached: boolean;
}

export interface DataNode {
  id: number;
  anchor: HexCoord;
  hp: number;
  maxHp: number;
  spreadTimer: number;
  spawnTimer: number;
  boss: boolean;
  buildProgress: number;
  footprint: HexCoord[];
  outlet: HexCoord;
}

export interface FacilityRuin {
  id: number;
  anchor: HexCoord;
  footprint: HexCoord[];
  outlet: HexCoord;
  boss: boolean;
  collapsedAt: number;
}

export interface Beam { from: PixelPoint; to: PixelPoint; color: string; life: number; maxLife: number }
export interface WorldEffect { kind: WorldEffectKind; position: PixelPoint; life: number; maxLife: number; seed: number }
export interface GameState {
  status: GameStatus;
  world: HexWorld;
  plants: PlantEntity[];
  enemies: EnemyEntity[];
  nodes: DataNode[];
  ruins: FacilityRuin[];
  beams: Beam[];
  effects: WorldEffect[];
  ecosystemTimer: number;
  sunlight: number;
  houseHp: number;
  wave: number;
  nextWave: number;
  elapsed: number;
  score: number;
  selected: PlantKind;
  cursor: HexCoord;
  message: string;
  messageUntil: number;
  bossSpawned: boolean;
  nextId: number;
  best: number;
  difficulty: Difficulty;
  reviewState: RewildReviewState | null;
}

export interface UiSnapshot {
  status: GameStatus;
  sunlight: number;
  houseHp: number;
  houseIntegrity: number;
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
  reviewState: RewildReviewState | null;
  inspection: EcosystemInspection;
}

export interface EcosystemInspection {
  title: string;
  subtitle: string;
  details: string[];
  valid: boolean;
  score: number | null;
}

interface CubeCoord { x: number; y: number; z: number }
const CUBE_DIRECTIONS: CubeCoord[] = [
  { x: 1, y: -1, z: 0 }, { x: 1, y: 0, z: -1 }, { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 }, { x: -1, y: 0, z: 1 }, { x: 0, y: -1, z: 1 },
];

export const HOUSE_CENTER: HexCoord = { q: 15, r: 6 };
export const HOUSE_FOOTPRINT: HexCoord[] = [{ q: 15, r: 6 }, { q: 14, r: 6 }, { q: 15, r: 7 }];
export const BORDER_SPAWNS: HexCoord[] = [
  { q: 2, r: 1 }, { q: 8, r: 1 }, { q: 15, r: 1 }, { q: 22, r: 1 }, { q: 28, r: 2 },
  { q: 28, r: 4 }, { q: 28, r: 8 }, { q: 28, r: 11 }, { q: 24, r: 12 },
  { q: 18, r: 12 }, { q: 10, r: 12 }, { q: 4, r: 12 }, { q: 1, r: 10 }, { q: 1, r: 6 }, { q: 1, r: 3 },
];

export function hexKey(hex: HexCoord) { return `${hex.q},${hex.r}`; }
export function sameHex(left: HexCoord, right: HexCoord) { return left.q === right.q && left.r === right.r; }
export function inHexBounds(hex: HexCoord) { return hex.q >= 0 && hex.r >= 0 && hex.q < HEX_COLS && hex.r < HEX_ROWS; }

function offsetToCube(hex: HexCoord): CubeCoord {
  const x = hex.q;
  const z = hex.r - (hex.q - (hex.q & 1)) / 2;
  return { x, z, y: -x - z };
}

function cubeToOffset(cube: CubeCoord): HexCoord {
  return { q: cube.x, r: cube.z + (cube.x - (cube.x & 1)) / 2 };
}

export function hexNeighbors(hex: HexCoord) {
  const cube = offsetToCube(hex);
  return CUBE_DIRECTIONS.map((direction) => cubeToOffset({ x: cube.x + direction.x, y: cube.y + direction.y, z: cube.z + direction.z })).filter(inHexBounds);
}

export function hexDistance(left: HexCoord, right: HexCoord) {
  const a = offsetToCube(left);
  const b = offsetToCube(right);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

export function hexCenter(hex: HexCoord): PixelPoint {
  return {
    x: FIELD_LEFT + HEX_SIZE + hex.q * HEX_X_STEP,
    y: FIELD_TOP + HEX_HEIGHT / 2 + (hex.r + (hex.q & 1) * .5) * HEX_HEIGHT,
  };
}

export function pixelToHex(x: number, y: number) {
  let closest: HexCoord | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let q = 0; q < HEX_COLS; q += 1) {
    for (let r = 0; r < HEX_ROWS; r += 1) {
      const candidate = { q, r };
      const center = hexCenter(candidate);
      const squared = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (squared < closestDistance) { closestDistance = squared; closest = candidate; }
    }
  }
  return closestDistance <= (HEX_SIZE * 1.15) ** 2 ? closest : null;
}

export function hexPolygon(hex: HexCoord, scale = 1) {
  const center = hexCenter(hex);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 3 * index;
    return { x: center.x + Math.cos(angle) * HEX_SIZE * scale, y: center.y + Math.sin(angle) * HEX_SIZE * scale };
  });
}

export function hexDisk(center: HexCoord, radius: number) {
  const result: HexCoord[] = [];
  for (let q = 0; q < HEX_COLS; q += 1) for (let r = 0; r < HEX_ROWS; r += 1) {
    const candidate = { q, r };
    if (hexDistance(center, candidate) <= radius) result.push(candidate);
  }
  return result;
}

function cubeRound(cube: CubeCoord) {
  let x = Math.round(cube.x);
  let y = Math.round(cube.y);
  let z = Math.round(cube.z);
  const xDiff = Math.abs(x - cube.x);
  const yDiff = Math.abs(y - cube.y);
  const zDiff = Math.abs(z - cube.z);
  if (xDiff > yDiff && xDiff > zDiff) x = -y - z;
  else if (yDiff > zDiff) y = -x - z;
  else z = -x - y;
  return { x, y, z };
}

export function hexLine(start: HexCoord, end: HexCoord) {
  const a = offsetToCube(start);
  const b = offsetToCube(end);
  const distance = hexDistance(start, end);
  if (!distance) return [start];
  const result: HexCoord[] = [];
  for (let step = 0; step <= distance; step += 1) {
    const t = step / distance;
    const cube = cubeRound({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const hex = cubeToOffset(cube);
    if (inHexBounds(hex) && !result.some((entry) => sameHex(entry, hex))) result.push(hex);
  }
  return result;
}

export function hashInt(a: number, b: number, salt: number) {
  let hash = (a * 374761393 + b * 668265263 + salt * 1597334677) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function smoothStep(value: number) { return value * value * (3 - 2 * value); }
function valueNoise(x: number, y: number, salt: number) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const tx = smoothStep(x - left);
  const ty = smoothStep(y - top);
  const sample = (sx: number, sy: number) => hashInt(sx, sy, salt) / 0xffffffff;
  const north = sample(left, top) * (1 - tx) + sample(left + 1, top) * tx;
  const south = sample(left, top + 1) * (1 - tx) + sample(left + 1, top + 1) * tx;
  return north * (1 - ty) + south * ty;
}

function worldObject(id: string, kind: WorldObjectKind, anchor: HexCoord, sprite: string | undefined, width: number, collision: boolean, shadow: boolean, footprintRadius = 0, rotation?: number): WorldObject {
  const footprint = footprintRadius ? hexDisk(anchor, footprintRadius) : [anchor];
  return { id, kind, anchor, footprint, sprite, width, collision, shadow, rotation };
}

const ROAD_WAYPOINTS: HexCoord[] = [{ q: 0, r: 8 }, { q: 5, r: 8 }, { q: 10, r: 9 }, { q: 15, r: 8 }, { q: 21, r: 9 }, { q: 25, r: 8 }, { q: 29, r: 9 }];

function createRoadNetwork(): RoadNetwork {
  const cells: HexCoord[] = [];
  for (let index = 1; index < ROAD_WAYPOINTS.length; index += 1) {
    for (const hex of hexLine(ROAD_WAYPOINTS[index - 1], ROAD_WAYPOINTS[index])) if (!cells.some((entry) => sameHex(entry, hex))) cells.push(hex);
  }
  return { id: "road-main", cells, points: ROAD_WAYPOINTS };
}

export function createHexWorld(seed = MAP_SEED): HexWorld {
  const road = createRoadNetwork();
  const roadKeys = new Set(road.cells.map(hexKey));
  const cells = new Map<string, HexCell>();
  for (let q = 0; q < HEX_COLS; q += 1) for (let r = 0; r < HEX_ROWS; r += 1) {
    const hex = { q, r };
    const distanceToHouse = hexDistance(hex, HOUSE_CENTER);
    const distanceToRoad = road.cells.reduce((best, roadHex) => Math.min(best, hexDistance(hex, roadHex)), 99);
    const moisture = Math.min(1, .22 + valueNoise(q / 6, r / 5, seed ^ 0x13579) * .52 + valueNoise(q / 2.7, r / 2.7, seed ^ 0x24680) * .18);
    const readability = Math.max(0, Math.min(1, Math.max(1 - distanceToHouse / 4, 1 - distanceToRoad / 2.5)));
    const detail = Math.max(0, Math.min(1, valueNoise(q / 4, r / 4, seed ^ 0x531) * (1 - readability * .72)));
    cells.set(hexKey(hex), { hex, surface: roadKeys.has(hexKey(hex)) ? "road" : "meadow", corruption: 0, source: null, seed: hashInt(q, r, seed), moisture, detail, readability });
  }

  const objects: WorldObject[] = [
    worldObject("house", "house", HOUSE_CENTER, "obj-house", 3.2, true, false, 1),
    worldObject("tree-nw", "tree", { q: 3, r: 3 }, "obj-tree-deciduous", 3.7, true, true, 1),
    worldObject("pine-west", "pine", { q: 4, r: 10 }, "obj-tree-pine", 3.15, true, true, 1),
    worldObject("tree-east", "tree", { q: 26, r: 7 }, "obj-tree-deciduous", 3.55, true, true, 1),
    worldObject("pine-south", "pine", { q: 11, r: 12 }, "obj-tree-pine", 2.9, true, true, 1),
    worldObject("pond-west", "pond", { q: 7, r: 6 }, "terrain-pond-1", 4.4, true, false, 1),
    worldObject("pond-east", "pond", { q: 19, r: 4 }, "terrain-pond-2", 4.0, true, false, 1),
    worldObject("rocks-ne", "rock", { q: 26, r: 3 }, "terrain-rock-2", 2.6, true, true, 0),
    worldObject("rocks-se", "rock", { q: 24, r: 11 }, "terrain-rock-1", 3.1, true, true, 1),
    worldObject("flowers-n", "flowers", { q: 11, r: 2 }, "terrain-flowers-1", 2.8, false, false, 1),
    worldObject("flowers-ne", "flowers", { q: 23, r: 3 }, "terrain-flowers-2", 2.55, false, false, 1),
    worldObject("flowers-s", "flowers", { q: 21, r: 12 }, "terrain-flowers-1", 2.7, false, false, 1),
    worldObject("shrub-left", "shrub", { q: 1, r: 7 }, "terrain-shrub-2", 2.0, false, true),
    worldObject("shrub-right", "shrub", { q: 28, r: 11 }, "terrain-shrub-1", 1.9, false, true),
    worldObject("log-west", "log", { q: 7, r: 11 }, undefined, 1.7, false, true, 0, -.18),
    worldObject("sign-house", "sign", { q: 18, r: 8 }, undefined, 1, false, true),
    worldObject("ruin-north", "ruin", { q: 15, r: 2 }, undefined, 1.8, true, true),
    worldObject("fence-house", "fence", { q: 13, r: 8 }, undefined, 2.2, false, true),
  ];

  for (const object of objects) {
    if (object.kind === "pond") for (const hex of object.footprint) {
      const cell = cells.get(hexKey(hex));
      if (cell) cell.surface = "water";
    }
  }
  for (const hex of HOUSE_FOOTPRINT) {
    const cell = cells.get(hexKey(hex));
    if (cell) cell.surface = "house";
  }
  return { seed, cells, objects, road };
}

export function cellAt(world: HexWorld, hex: HexCoord) { return world.cells.get(hexKey(hex)); }
export function objectAt(world: HexWorld, hex: HexCoord, collisionOnly = false) {
  return world.objects.find((object) => (!collisionOnly || object.collision) && object.footprint.some((cell) => sameHex(cell, hex)));
}
export function plantAt(state: GameState, hex: HexCoord) { return state.plants.find((plant) => plant.q === hex.q && plant.r === hex.r); }
export function nodeAt(state: GameState, hex: HexCoord) { return state.nodes.find((node) => node.footprint.some((cell) => sameHex(cell, hex))); }
export function ruinAt(state: GameState, hex: HexCoord) { return state.ruins.find((ruin) => ruin.footprint.some((cell) => sameHex(cell, hex)) && cellAt(state.world, hex)?.surface === "rubble"); }

function nextId(state: GameState) { const id = state.nextId; state.nextId += 1; return id; }
export function facilityStage(node: DataNode) { return Math.min(3, Math.floor(node.buildProgress / (node.boss ? 3 : 2))); }
export function facilityOperational(node: DataNode) { return node.hp > node.maxHp * .2; }

export function createFacilityFootprint(anchor: HexCoord, boss: boolean) {
  return hexDisk(anchor, boss ? 2 : 1);
}

function facilityOutlet(anchor: HexCoord, footprint: HexCoord[]) {
  const footprintKeys = new Set(footprint.map(hexKey));
  const candidates = footprint.flatMap(hexNeighbors).filter((hex, index, list) => !footprintKeys.has(hexKey(hex)) && list.findIndex((entry) => sameHex(entry, hex)) === index);
  return candidates.sort((left, right) => hexDistance(left, HOUSE_CENTER) - hexDistance(right, HOUSE_CENTER))[0] ?? anchor;
}

function createNode(state: GameState, anchor: HexCoord, boss = false) {
  const id = nextId(state);
  const footprint = createFacilityFootprint(anchor, boss);
  for (const hex of footprint) {
    const cell = cellAt(state.world, hex);
    if (!cell) continue;
    cell.surface = "foundation";
    cell.corruption = 0;
    cell.source = id;
  }
  state.nodes.push({
    id, anchor, hp: boss ? 800 : 150, maxHp: boss ? 800 : 150,
    spreadTimer: 1.4, spawnTimer: boss ? 3 : 5, boss, buildProgress: 0,
    footprint, outlet: facilityOutlet(anchor, footprint),
  });
  if (state.elapsed > 0) state.effects.push({ kind: "construction", position: hexCenter(anchor), life: .8, maxLife: .8, seed: id });
}

export function createGameState(best: number, difficulty: Difficulty, status: GameStatus = "playing"): GameState {
  const config = DIFFICULTIES[difficulty];
  const state: GameState = {
    status, world: createHexWorld(), plants: [], enemies: [], nodes: [], ruins: [], beams: [], effects: [], ecosystemTimer: 1.2,
    sunlight: config.sunlightStart, houseHp: config.houseHp, wave: 1, nextWave: 24 * config.waveTime, elapsed: 0, score: 0,
    selected: "vinewhip", cursor: { q: 13, r: 5 }, message: "AI slop detected. Grow weapons.", messageUntil: 3,
    bossSpawned: false, nextId: 1, best, difficulty, reviewState: null,
  };
  createNode(state, BORDER_SPAWNS[1]);
  createNode(state, { q: 22, r: 5 });
  return state;
}

function setMessage(state: GameState, message: string, seconds = 2.6) {
  state.message = message;
  state.messageUntil = state.elapsed + seconds;
}

function isWorldObstacle(state: GameState, hex: HexCoord) {
  const cell = cellAt(state.world, hex);
  if (!cell || cell.surface === "water" || cell.surface === "foundation") return true;
  return Boolean(objectAt(state.world, hex, true)?.kind !== "house" && objectAt(state.world, hex, true));
}

export function findPath(state: GameState, start: HexCoord) {
  const startKey = hexKey(start);
  const houseKeys = new Set(HOUSE_FOOTPRINT.map(hexKey));
  const queue: { hex: HexCoord; cost: number }[] = [{ hex: start, cost: 0 }];
  const previous = new Map<string, string | null>([[startKey, null]]);
  const costs = new Map<string, number>([[startKey, 0]]);
  let target: string | null = null;
  while (queue.length) {
    queue.sort((left, right) => left.cost - right.cost);
    const current = queue.shift()!.hex;
    const currentKey = hexKey(current);
    if (houseKeys.has(currentKey)) { target = currentKey; break; }
    for (const neighbor of hexNeighbors(current)) {
      const key = hexKey(neighbor);
      if (!houseKeys.has(key) && isWorldObstacle(state, neighbor)) continue;
      const cell = cellAt(state.world, neighbor);
      const stepCost = cell?.surface === "road" ? .18 : 1;
      const nextCost = (costs.get(currentKey) ?? 0) + stepCost;
      if (nextCost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(key, nextCost);
      previous.set(key, currentKey);
      queue.push({ hex: neighbor, cost: nextCost });
    }
  }
  if (!target) return [];
  const path: HexCoord[] = [];
  for (let cursor: string | null = target; cursor && cursor !== startKey; cursor = previous.get(cursor) ?? null) {
    const [q, r] = cursor.split(",").map(Number);
    path.unshift({ q, r });
  }
  return path;
}

function targetHex(target: EnemyEntity | DataNode) { return "kind" in target ? target.hex : target.anchor; }
function targetPosition(target: EnemyEntity | DataNode) { return "kind" in target ? target.position : hexCenter(target.anchor); }
function addBeam(state: GameState, from: PixelPoint, to: PixelPoint, color: string) { state.beams.push({ from, to, color, life: .34, maxLife: .34 }); }
function damageTarget(state: GameState, plant: PlantEntity, target: EnemyEntity | DataNode, damage: number, color: string) {
  target.hp -= damage;
  addBeam(state, hexCenter(plant), targetPosition(target), color);
  plant.attackTarget = targetHex(target);
  plant.attackUntil = state.elapsed + .26;
  if (!("kind" in target)) state.effects.push({ kind: "impact", position: targetPosition(target), life: .34, maxLife: .34, seed: plant.id + target.id + Math.round(state.elapsed * 10) });
}

function combatTargets(state: GameState, plant: PlantEntity, radius: number) {
  return [...state.enemies, ...state.nodes].filter((target) => target.hp > 0 && hexDistance(plant, targetHex(target)) <= radius);
}

function nearbyObject(state: GameState, hex: HexCoord, kinds: WorldObjectKind[], radius: number) {
  return state.world.objects.find((object) => kinds.includes(object.kind) && hexDistance(hex, object.anchor) <= radius);
}

function rootRange(state: GameState, plant: PlantEntity) {
  return nearbyObject(state, plant, ["tree", "pine"], 3) ? 4 : 3;
}

function reclaimNear(state: GameState, plant: PlantEntity) {
  const candidates = [...state.world.cells.values()].filter((cell) => cell.corruption > 0 && !nodeAt(state, cell.hex) && hexDistance(plant, cell.hex) <= rootRange(state, plant))
    .sort((left, right) => hexDistance(plant, left.hex) - hexDistance(plant, right.hex) || left.corruption - right.corruption);
  const target = candidates[0];
  if (!target) return;
  plant.reclaimTarget = target.hex;
  plant.reclaimUntil = state.elapsed + .7;
  target.corruption = Math.max(0, target.corruption - 1) as CorruptionLevel;
  if (target.corruption === 0) {
    target.source = null;
    if (target.surface === "rubble") target.surface = "meadow";
    state.ruins = state.ruins.filter((ruin) => ruin.footprint.some((hex) => cellAt(state.world, hex)?.surface === "rubble"));
  }
  state.score += 6;
  addBeam(state, hexCenter(plant), hexCenter(target.hex), "#a9e37d");
  state.effects.push({ kind: "reclaim", position: hexCenter(target.hex), life: .7, maxLife: .7, seed: plant.id + target.seed });
}

function updatePlants(state: GameState, dt: number) {
  for (const plant of state.plants) {
    plant.age += dt;
    plant.cooldown -= dt;
    if (plant.disabledUntil > state.elapsed) continue;
    if (plant.kind === "rootreclaimer") {
      plant.reclaimTimer -= dt;
      if (plant.reclaimTimer <= 0) { reclaimNear(state, plant); plant.reclaimTimer = nearbyObject(state, plant, ["tree", "pine"], 3) ? 2.5 : 3.7; }
      continue;
    }
    if (plant.cooldown > 0 || plant.kind === "sunbloom") continue;
    if (plant.kind === "thornbramble") {
      for (const target of combatTargets(state, plant, 1)) damageTarget(state, plant, target, 4, "#a9d45c");
      plant.cooldown = 1;
    } else if (plant.kind === "sporecap") {
      for (const target of combatTargets(state, plant, 2)) damageTarget(state, plant, target, 15, "#d7a8ec");
      plant.cooldown = 2;
    } else if (plant.kind === "vinewhip") {
      const target = combatTargets(state, plant, 4)[0];
      if (target) {
        damageTarget(state, plant, target, 8, "#77bd4a");
        if ("kind" in target) target.slowUntil = state.elapsed + 2;
      }
      plant.cooldown = .9;
    } else if (plant.kind === "elderoak" && plant.age >= 15) {
      for (const target of combatTargets(state, plant, 3)) damageTarget(state, plant, target, 25, "#d8ba68");
      plant.cooldown = 1.5;
    }
  }
}

function updateEcosystem(state: GameState, dt: number) {
  state.ecosystemTimer -= dt;
  if (state.ecosystemTimer > 0) return;
  state.ecosystemTimer = 1.2;
  for (const pond of state.world.objects.filter((object) => object.kind === "pond")) {
    const candidates = [...state.world.cells.values()].filter((cell) => cell.corruption > 0 && cell.surface !== "rubble" && pond.footprint.some((pondCell) => hexDistance(pondCell, cell.hex) <= 2))
      .sort((left, right) => right.corruption - left.corruption);
    const target = candidates[0];
    if (target) {
      target.corruption = Math.max(0, target.corruption - 1) as CorruptionLevel;
      if (target.corruption === 0) target.source = null;
    }
  }
}

function spawnEnemy(state: GameState, node: DataNode, kind: EnemyKind, offset = 0) {
  if (state.enemies.length >= 70) return;
  const config = ENEMIES[kind];
  const mult = DIFFICULTIES[state.difficulty];
  const position = hexCenter(node.outlet);
  const hp = config.hp * mult.enemyHp;
  state.enemies.push({
    id: nextId(state), kind, position: { x: position.x + offset * 4, y: position.y + offset * 3 }, hex: node.outlet,
    hp, maxHp: hp, speed: config.speed * mult.enemySpeed, damage: config.damage * mult.enemyDamage,
    cooldown: .4, pathTimer: 0, path: [], slowUntil: 0, breached: false,
  });
}

function spreadCorruption(state: GameState, node: DataNode) {
  const outlet = cellAt(state.world, node.outlet);
  if (outlet && outlet.surface !== "water" && outlet.surface !== "house") {
    outlet.source = node.id;
    outlet.corruption = Math.max(outlet.corruption, facilityStage(node) === 2 ? 1 : 2) as CorruptionLevel;
  }
  const sourceCells = [...state.world.cells.values()].filter((cell) => cell.source === node.id && cell.corruption > 0);
  const candidates = sourceCells.flatMap((source) => hexNeighbors(source.hex)).map((hex) => cellAt(state.world, hex)).filter((cell): cell is HexCell => Boolean(cell))
    .filter((cell) => cell.surface !== "foundation" && cell.surface !== "house" && cell.surface !== "water")
    .filter((cell, index, list) => list.findIndex((entry) => sameHex(entry.hex, cell.hex)) === index)
    .sort((left, right) => {
      const leftScore = (left.corruption === 0 ? 18 : -left.corruption * 3) + (left.surface === "road" ? 6 : 0) + (hashInt(left.hex.q, left.hex.r, state.wave + node.id) % 7);
      const rightScore = (right.corruption === 0 ? 18 : -right.corruption * 3) + (right.surface === "road" ? 6 : 0) + (hashInt(right.hex.q, right.hex.r, state.wave + node.id) % 7);
      return rightScore - leftScore;
    });
  const target = candidates[0];
  if (!target) return;
  target.source = node.id;
  target.corruption = Math.min(4, target.corruption + (facilityStage(node) === 3 ? 3 : 1)) as CorruptionLevel;
}

function updateNodes(state: GameState, dt: number) {
  for (const node of state.nodes) {
    node.buildProgress += dt;
    node.spreadTimer -= dt;
    node.spawnTimer -= dt;
    const stage = facilityStage(node);
    if (!facilityOperational(node)) continue;
    if (stage >= 2 && node.spreadTimer <= 0) {
      spreadCorruption(state, node);
      node.spreadTimer = stage === 3 ? 1.05 : 2.1;
    }
    if (stage === 3 && node.spawnTimer <= 0) {
      spawnEnemy(state, node, node.boss ? "deepfake" : state.wave >= 3 ? "popup" : "clickbait");
      if (node.boss) spawnEnemy(state, node, "fragment", 1);
      node.spawnTimer = node.boss ? 3.5 : Math.max(3.2, 7 - state.wave * .5);
    }
  }
}

function attackPlantOrHouse(state: GameState, enemy: EnemyEntity, target: HexCoord) {
  const plant = plantAt(state, target);
  if (plant) {
    if (enemy.cooldown <= 0) { plant.hp -= enemy.damage; enemy.cooldown = .8; }
    return true;
  }
  if (HOUSE_FOOTPRINT.some((hex) => sameHex(hex, target))) {
    if (enemy.cooldown <= 0) {
      state.houseHp -= enemy.damage;
      enemy.breached = true;
      enemy.hp = 0;
      setMessage(state, `${ENEMIES[enemy.kind].name} breached the garden.`, 1.4);
    }
    return true;
  }
  return false;
}

function updateEnemies(state: GameState, dt: number) {
  for (const enemy of state.enemies) {
    enemy.cooldown -= dt;
    enemy.pathTimer -= dt;
    if (enemy.pathTimer <= 0 || !enemy.path.length) {
      enemy.path = findPath(state, enemy.hex);
      enemy.pathTimer = 1.1;
    }
    const next = enemy.path[0];
    if (!next) continue;
    if (attackPlantOrHouse(state, enemy, next)) continue;
    const target = hexCenter(next);
    const dx = target.x - enemy.position.x;
    const dy = target.y - enemy.position.y;
    const distance = Math.hypot(dx, dy);
    const slow = enemy.slowUntil > state.elapsed ? .48 : 1;
    const roadBoost = cellAt(state.world, enemy.hex)?.surface === "road" ? 1.28 : 1;
    const travel = enemy.speed * HEX_SIZE * slow * roadBoost * dt;
    if (distance <= travel || distance < 1) {
      enemy.position = target;
      enemy.hex = next;
      enemy.path.shift();
      attackPlantOrHouse(state, enemy, next);
    } else {
      enemy.position.x += dx / distance * travel;
      enemy.position.y += dy / distance * travel;
    }
  }
}

function canBuildFacility(state: GameState, anchor: HexCoord, boss: boolean) {
  const footprint = createFacilityFootprint(anchor, boss);
  return footprint.length >= (boss ? 12 : 6) && footprint.every((hex) => {
    const cell = cellAt(state.world, hex);
    return cell && (cell.surface === "meadow" || cell.surface === "road" || cell.surface === "rubble") && !objectAt(state.world, hex, true) && !nodeAt(state, hex) && !ruinAt(state, hex) && !plantAt(state, hex);
  });
}

function beginWave(state: GameState) {
  state.wave += 1;
  const boss = state.wave === 5;
  const available = BORDER_SPAWNS.filter((spawn) => canBuildFacility(state, spawn, boss));
  if (available.length) createNode(state, available[(state.wave * 3) % available.length], boss);
  if (boss) { state.bossSpawned = true; setMessage(state, "The Mainframe is excavating an edge of the living world.", 4); }
  else setMessage(state, `Wave ${state.wave}: new infrastructure is cutting into the field.`, 3.4);
}

function resolveDeaths(state: GameState) {
  const deadPlants = state.plants.filter((plant) => plant.hp <= 0);
  if (deadPlants.length) state.plants = state.plants.filter((plant) => plant.hp > 0);
  const deadEnemies = state.enemies.filter((enemy) => enemy.hp <= 0);
  for (const enemy of deadEnemies) {
    if (!enemy.breached) state.score += Math.round(enemy.maxHp * 2);
    if (enemy.kind === "deepfake" && !enemy.breached) {
      const dummyNode: DataNode = { id: -1, anchor: enemy.hex, hp: 1, maxHp: 1, spreadTimer: 0, spawnTimer: 0, boss: false, buildProgress: 6, footprint: [enemy.hex], outlet: enemy.hex };
      spawnEnemy(state, dummyNode, "fragment", -1);
      spawnEnemy(state, dummyNode, "fragment", 1);
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  const deadNodes = state.nodes.filter((node) => node.hp <= 0);
  for (const node of deadNodes) {
    for (const hex of node.footprint) {
      const cell = cellAt(state.world, hex);
      if (cell) { cell.surface = "rubble"; cell.corruption = Math.max(2, cell.corruption) as CorruptionLevel; }
    }
    state.ruins.push({ id: node.id, anchor: node.anchor, footprint: node.footprint, outlet: node.outlet, boss: node.boss, collapsedAt: state.elapsed });
    state.effects.push({ kind: "shutdown", position: hexCenter(node.anchor), life: .9, maxLife: .9, seed: node.id });
    state.effects.push({ kind: "collapse", position: hexCenter(node.anchor), life: 1.25, maxLife: 1.25, seed: node.id + 19 });
    state.score += node.boss ? 1600 : 190;
    setMessage(state, node.boss ? "Mainframe demolished. Reclaim the contaminated ground." : "AI slop server destroyed. Roots can now reclaim its rubble.", 4);
  }
  state.nodes = state.nodes.filter((node) => node.hp > 0);
}

export function corruptionPercent(state: GameState) {
  const field = [...state.world.cells.values()].filter((cell) => cell.surface !== "water" && cell.surface !== "house" && cell.surface !== "foundation");
  const corrupted = field.filter((cell) => cell.corruption >= 3);
  return field.length ? Math.round(corrupted.length / field.length * 100) : 0;
}

export function updateGame(state: GameState, dt: number) {
  if (state.status !== "playing" || state.reviewState || dt <= 0) return;
  state.elapsed += dt;
  state.nextWave -= dt;
  state.sunlight += (2 + state.plants.filter((plant) => plant.kind === "sunbloom").length * 2) * dt;
  updateNodes(state, dt);
  updateEcosystem(state, dt);
  updatePlants(state, dt);
  updateEnemies(state, dt);
  for (const beam of state.beams) beam.life -= dt;
  state.beams = state.beams.filter((beam) => beam.life > 0);
  for (const effect of state.effects) effect.life -= dt;
  state.effects = state.effects.filter((effect) => effect.life > 0);
  resolveDeaths(state);
  if (state.nextWave <= 0 && state.wave < 5) {
    beginWave(state);
    state.nextWave = 24 * DIFFICULTIES[state.difficulty].waveTime;
  }
  if (state.houseHp <= 0) {
    state.houseHp = 0;
    state.status = "lost";
    state.message = "The feed consumed the last human house.";
  } else if (state.bossSpawned && state.nodes.length === 0 && state.ruins.length === 0 && state.enemies.length === 0 && ![...state.world.cells.values()].some((cell) => cell.corruption > 0)) {
    state.status = "won";
    state.message = "The field is living soil again. AI slop erased.";
  } else if (state.elapsed > state.messageUntil) state.message = "Build through relationships: soil, roots, roads, water, and corruption all affect one another.";
  state.best = Math.max(state.best, state.score);
}

export function placePlant(state: GameState, hex: HexCoord) {
  if (state.status !== "playing") return false;
  const config = PLANTS[state.selected];
  const cell = cellAt(state.world, hex);
  if (!cell || plantAt(state, hex) || nodeAt(state, hex) || objectAt(state.world, hex, true)) {
    setMessage(state, "That hex is physically occupied.");
    return false;
  }
  const canGrow = state.selected === "rootreclaimer" ? cell.corruption > 0 : cell.surface === "meadow" && cell.corruption === 0;
  if (!canGrow) {
    setMessage(state, state.selected === "rootreclaimer" ? "Rootreclaimers need contaminated soil." : "Healthy meadow is required here.");
    return false;
  }
  if (state.sunlight < config.cost) { setMessage(state, "Not enough sunlight."); return false; }
  state.sunlight -= config.cost;
  state.plants.push({ id: nextId(state), kind: state.selected, q: hex.q, r: hex.r, hp: config.maxHp, cooldown: .2, age: 0, reclaimTimer: .8, disabledUntil: 0, reclaimTarget: null, reclaimUntil: 0, attackTarget: null, attackUntil: 0 });
  setMessage(state, `${config.name} rooted into the field.`);
  return true;
}

export function moveCursor(state: GameState, direction: number) {
  const cube = offsetToCube(state.cursor);
  const vector = CUBE_DIRECTIONS[((direction % 6) + 6) % 6];
  const next = cubeToOffset({ x: cube.x + vector.x, y: cube.y + vector.y, z: cube.z + vector.z });
  if (inHexBounds(next)) state.cursor = next;
}

export function objectCorruption(state: GameState, object: WorldObject) {
  return object.footprint.reduce<number>((highest, hex) => Math.max(highest, cellAt(state.world, hex)?.corruption ?? 0), 0) as CorruptionLevel;
}

const OBJECT_NAMES: Record<WorldObjectKind, string> = { house: "Last human house", tree: "Deciduous tree", pine: "Pine tree", pond: "Pond", rock: "Rock outcrop", flowers: "Wildflowers", shrub: "Shrub", log: "Fallen log", fence: "Fence", sign: "Road sign", ruin: "Old ruin" };

export function inspectHex(state: GameState, hex: HexCoord): EcosystemInspection {
  const cell = cellAt(state.world, hex);
  const object = objectAt(state.world, hex);
  const plant = plantAt(state, hex);
  const node = nodeAt(state, hex);
  const ruin = ruinAt(state, hex);
  if (!cell) return { title: "Outside the field", subtitle: "No ecosystem cell", details: ["Move the cursor back into the living field."], valid: false, score: null };
  if (node) return { title: node.boss ? "AI slop Mainframe" : "AI slop datacenter", subtitle: facilityOperational(node) ? "Operational source" : "Systems offline", details: [`${Math.max(0, Math.round(node.hp / node.maxHp * 100))}% structural integrity`, facilityOperational(node) ? "Manufactures enemies and spreads corruption." : "Broken cable; drain no longer pollutes."], valid: false, score: null };
  if (ruin) return { title: "Collapsed datacenter", subtitle: "Persistent occupied rubble", details: ["Blocks construction and vegetation.", "Rootreclaimers must clear every contaminated cell."], valid: state.selected === "rootreclaimer" && cell.corruption > 0, score: null };
  if (plant) return { title: PLANTS[plant.kind].name, subtitle: PLANTS[plant.kind].role, details: [PLANTS[plant.kind].detail, plant.kind === "rootreclaimer" && nearbyObject(state, plant, ["tree", "pine"], 3) ? "Tree network: +1 range and faster reclamation." : `${Math.max(0, Math.round(plant.hp / PLANTS[plant.kind].maxHp * 100))}% health`], valid: false, score: null };
  if (object?.collision) {
    const corruption = objectCorruption(state, object);
    const relationships: Partial<Record<WorldObjectKind, string[]>> = {
      house: [state.houseHp / DIFFICULTIES[state.difficulty].houseHp > .7 ? "Secure: exterior and garden intact." : state.houseHp / DIFFICULTIES[state.difficulty].houseHp > .35 ? "Damaged: attacks have reached the structure." : "Critical: the last house is close to collapse."],
      pond: ["Dilutes one nearby corruption level every 1.2 seconds.", corruption ? `Shoreline contamination level ${corruption}.` : "Water is currently clean."],
      tree: ["Extends nearby Rootreclaimers to range 4 and shortens their cycle.", corruption ? `Canopy is stressed at level ${corruption}.` : "Healthy root network."],
      pine: ["Extends nearby Rootreclaimers to range 4 and shortens their cycle.", corruption ? `Needles are stressed at level ${corruption}.` : "Healthy root network."],
      rock: ["Hard obstacle: redirects AI slop and constrains placement."],
    };
    return { title: OBJECT_NAMES[object.kind], subtitle: corruption ? "Environment under stress" : "Freestanding world object", details: relationships[object.kind] ?? [object.collision ? "Occupies and blocks this ground." : "Visual habitat; ground remains traversable."], valid: false, score: null };
  }
  const nearbyTree = nearbyObject(state, hex, ["tree", "pine"], 3);
  const nearRoad = state.world.road.cells.some((roadHex) => hexDistance(hex, roadHex) <= 1);
  const nearbyPond = nearbyObject(state, hex, ["pond"], 3);
  const nearbyTargets = [...state.nodes, ...state.enemies].filter((target) => hexDistance(hex, targetHex(target)) <= (state.selected === "vinewhip" ? 4 : state.selected === "sporecap" ? 2 : 1)).length;
  const canGrow = state.selected === "rootreclaimer" ? cell.corruption > 0 : cell.surface === "meadow" && cell.corruption === 0;
  const details = [cell.surface === "road" ? "Road: enemies move 28% faster and path toward it." : cell.corruption ? `Corruption level ${cell.corruption}: only roots can grow here.` : "Healthy meadow."];
  if (object && !object.collision) details.push(`${OBJECT_NAMES[object.kind]} shares this ground without blocking it.`);
  let score = canGrow ? 1 : 0;
  if (nearbyTargets) { details.push(`${nearbyTargets} hostile target${nearbyTargets === 1 ? "" : "s"} in attack range.`); score += nearbyTargets * 2; }
  if (nearbyTree && state.selected === "rootreclaimer") { details.push("Tree network: +1 reclaim range and faster cycle."); score += 3; }
  if (nearRoad) { details.push("Road edge: intercepts fast enemy traffic."); score += state.selected === "thornbramble" || state.selected === "sporecap" ? 2 : 1; }
  if (nearbyPond) details.push("Pond influence: nearby corruption is diluted.");
  return { title: canGrow ? `${PLANTS[state.selected].name} placement` : "Blocked placement", subtitle: canGrow ? score >= 5 ? "Strong relationship" : score >= 3 ? "Useful relationship" : "Valid ground" : "Cannot grow here", details, valid: canGrow && !plant && !node && !object, score: canGrow ? score : null };
}

export function createReviewGameState(best: number, stateName: RewildReviewState): GameState {
  const state = createGameState(best, "easy");
  state.reviewState = stateName;
  state.nextWave = 99;
  state.enemies = [];
  for (const node of state.nodes) node.buildProgress = 7;
  const subject = state.nodes[0];
  const pollutedCells = hexDisk(subject.outlet, 2).filter((hex) => {
    const cell = cellAt(state.world, hex);
    return cell && cell.surface !== "water" && cell.surface !== "house" && cell.surface !== "foundation";
  });
  for (let index = 0; index < pollutedCells.length; index += 1) {
    const cell = cellAt(state.world, pollutedCells[index]);
    if (cell) { cell.source = subject.id; cell.corruption = (index % 3 ? 3 : 4) as CorruptionLevel; }
  }
  if (stateName === "ecosystem") {
    state.wave = 2;
    state.selected = "rootreclaimer";
    const tree = state.world.objects.find((object) => object.id === "tree-nw")!;
    const relationshipCells = hexDisk({ q: 5, r: 4 }, 2).filter((hex) => {
      const cell = cellAt(state.world, hex);
      return cell && cell.surface !== "water" && cell.surface !== "house" && !objectAt(state.world, hex, true) && !nodeAt(state, hex);
    });
    for (let index = 0; index < relationshipCells.length; index += 1) {
      const cell = cellAt(state.world, relationshipCells[index]);
      if (cell) { cell.source = subject.id; cell.corruption = (index % 3 === 0 ? 3 : 2) as CorruptionLevel; }
    }
    const rootHex = relationshipCells.find((hex) => hexDistance(hex, tree.anchor) <= 3 && cellAt(state.world, hex)?.surface !== "road") ?? relationshipCells[0];
    const target = relationshipCells.find((hex) => !sameHex(hex, rootHex) && hexDistance(hex, rootHex) <= 4) ?? rootHex;
    state.plants.push({ id: nextId(state), kind: "rootreclaimer", q: rootHex.q, r: rootHex.r, hp: PLANTS.rootreclaimer.maxHp, cooldown: 0, age: 5, reclaimTimer: 2, disabledUntil: 0, reclaimTarget: target, reclaimUntil: 99, attackTarget: null, attackUntil: 0 });
    state.cursor = rootHex;
    state.message = "Inspect the field: trees amplify roots, ponds dilute pollution, and roads concentrate fast enemy traffic.";
    return state;
  }
  if (stateName === "damage") {
    subject.hp = subject.maxHp * .34;
    state.message = "Facility systems are failing module by module.";
    return state;
  }
  subject.hp = 0;
  resolveDeaths(state);
  state.effects = [];
  if (stateName === "collapse") {
    state.message = "The source is offline. Broken cables and contaminated rubble remain.";
    return state;
  }
  for (const cell of state.world.cells.values()) if (cell.source === subject.id && cell.corruption > 0) cell.corruption = Math.min(cell.corruption, 1) as CorruptionLevel;
  for (const hex of subject.footprint.slice(0, Math.max(1, subject.footprint.length - 2))) {
    const cell = cellAt(state.world, hex);
    if (cell) { cell.surface = "meadow"; cell.corruption = 0; cell.source = null; }
  }
  const rootHex = pollutedCells.find((hex) => cellAt(state.world, hex)?.surface !== "road") ?? subject.outlet;
  const remainingRubble = subject.footprint.find((hex) => cellAt(state.world, hex)?.surface === "rubble") ?? subject.anchor;
  state.plants.push({ id: nextId(state), kind: "rootreclaimer", q: rootHex.q, r: rootHex.r, hp: PLANTS.rootreclaimer.maxHp, cooldown: 0, age: 5, reclaimTimer: 2, disabledUntil: 0, reclaimTarget: remainingRubble, reclaimUntil: 99, attackTarget: null, attackUntil: 0 });
  state.message = "Roots reconnect broken ground; regrowth follows the repaired path.";
  return state;
}

export function toUi(state: GameState): UiSnapshot {
  return {
    status: state.status, sunlight: Math.floor(state.sunlight), houseHp: Math.max(0, Math.round(state.houseHp)), houseIntegrity: Math.max(0, Math.round(state.houseHp / DIFFICULTIES[state.difficulty].houseHp * 100)), corruption: corruptionPercent(state),
    wave: state.wave, nextWave: Math.max(0, Math.ceil(state.nextWave)), elapsed: state.elapsed, score: state.score, selected: state.selected,
    message: state.message, best: state.best, difficulty: state.difficulty, plants: state.plants.length, enemies: state.enemies.length, nodes: state.nodes.length,
    reviewState: state.reviewState, inspection: inspectHex(state, state.cursor),
  };
}
