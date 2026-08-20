import {
  hexCenterFor,
  hexDirectionBetween,
  hexDistanceBetween,
  hexHeight,
  hexLineBetween,
  hexNeighborFor,
  hexNeighborsFor,
  hexPolygonFor,
  hexWidth,
  hexXStep,
  inHexLayout,
  pixelToHexFor,
  straightHexLineBetween,
  type HexCoord,
  type HexLayout,
  type PixelPoint,
} from "./rewild-hex-grid.ts";

export type { HexCoord, PixelPoint } from "./rewild-hex-grid.ts";

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 675;
export const HEX_COLS = 37;
export const HEX_ROWS = 15;
export const HEX_SIZE = 21;
export const FIELD_LEFT = 12;
export const FIELD_TOP = 55;
export const MAP_SEED = 0x5e7a11;
export const REWILD_HEX_LAYOUT: HexLayout = {
  cols: HEX_COLS,
  rows: HEX_ROWS,
  size: HEX_SIZE,
  origin: { x: FIELD_LEFT, y: FIELD_TOP },
};
export const HEX_WIDTH = hexWidth(REWILD_HEX_LAYOUT);
export const HEX_HEIGHT = hexHeight(REWILD_HEX_LAYOUT);
export const HEX_X_STEP = hexXStep(REWILD_HEX_LAYOUT);

export type SurfaceKind = "meadow" | "road" | "water" | "house" | "foundation" | "rubble";
export type BiomeKind = "forest" | "water" | "rock" | "flowers";
export type CorruptionLevel = 0 | 1 | 2 | 3 | 4;
export type PlantKind = "sunbloom" | "thornbramble" | "sporecap" | "vinewhip" | "rootreclaimer" | "elderoak";
export type EnemyKind = "clickbait" | "deepfake" | "popup" | "fragment";
export type GameStatus = "menu" | "playing" | "paused" | "won" | "lost";
export type Difficulty = "easy" | "normal" | "hard";
export type RewildReviewState = "damage" | "collapse" | "reclamation" | "ecosystem" | "response";
export type WorldEffectKind = "construction" | "impact" | "shutdown" | "collapse" | "reclaim" | "dilution";
export type EnvironmentVisualState = "healthy" | "stressed" | "corrupted" | "dead" | "recovering";

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
export interface BiomeRegion { id: string; kind: BiomeKind; cells: HexCoord[]; seed: number }
export interface HexWorld {
  seed: number;
  cells: Map<string, HexCell>;
  objects: WorldObject[];
  road: RoadNetwork;
  biomes: BiomeRegion[];
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
  rootreclaimer: { name: "Rootreclaimer", shortName: "Root", cost: 45, role: "Reclaim", detail: "Automatically clears nearby corruption", unlockWave: 2, color: "#79b57b", maxHp: 65 },
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
  easy: { name: "Easy", description: "The same frozen rules with a calmer label.", sunlightStart: 120, houseHp: 100, enemyHp: 1, enemySpeed: 1, enemyDamage: 1, waveTime: 1 },
  normal: { name: "Normal", description: "The original real-time Rewild rules.", sunlightStart: 120, houseHp: 100, enemyHp: 1, enemySpeed: 1, enemyDamage: 1, waveTime: 1 },
  hard: { name: "Hard", description: "The same frozen rules with a harsher label.", sunlightStart: 120, houseHp: 100, enemyHp: 1, enemySpeed: 1, enemyDamage: 1, waveTime: 1 },
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
export interface EnvironmentResponse { stress: CorruptionLevel; recoveringUntil: number }
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
  pondCueTimer: number;
  environmentResponses: Map<string, EnvironmentResponse>;
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
export interface EcosystemInspection { title: string; subtitle: string; details: string[]; valid: boolean; score: number | null }
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

export const HOUSE_CENTER: HexCoord = { q: 10, r: 7 };
export const HOUSE_FOOTPRINT: HexCoord[] = [{ q: 10, r: 7 }, { q: 9, r: 7 }, { q: 10, r: 8 }];
export const INITIAL_NODE_ANCHORS: HexCoord[] = [{ q: 29, r: 4 }, { q: 33, r: 9 }];
export const BORDER_SPAWNS: HexCoord[] = [
  { q: 21, r: 1 }, { q: 27, r: 1 }, { q: 33, r: 1 }, { q: 35, r: 3 }, { q: 35, r: 7 },
  { q: 35, r: 11 }, { q: 32, r: 13 }, { q: 26, r: 13 }, { q: 20, r: 13 }, { q: 14, r: 13 },
  { q: 7, r: 13 }, { q: 1, r: 11 }, { q: 1, r: 7 }, { q: 1, r: 3 }, { q: 8, r: 1 },
];

export function hexKey(hex: HexCoord) { return `${hex.q},${hex.r}`; }
export function sameHex(left: HexCoord, right: HexCoord) { return left.q === right.q && left.r === right.r; }
export function inHexBounds(hex: HexCoord) { return inHexLayout(REWILD_HEX_LAYOUT, hex); }
export function hexNeighbors(hex: HexCoord) { return hexNeighborsFor(REWILD_HEX_LAYOUT, hex); }
export function hexDistance(left: HexCoord, right: HexCoord) { return hexDistanceBetween(left, right); }
export function hexDirection(start: HexCoord, end: HexCoord) { return hexDirectionBetween(start, end); }
export function hexCenter(hex: HexCoord): PixelPoint { return hexCenterFor(REWILD_HEX_LAYOUT, hex); }
export function pixelToHex(x: number, y: number) { return pixelToHexFor(REWILD_HEX_LAYOUT, x, y); }
export function hexPolygon(hex: HexCoord, scale = 1) { return hexPolygonFor(REWILD_HEX_LAYOUT, hex, scale); }
export function hexLine(start: HexCoord, end: HexCoord) { return hexLineBetween(REWILD_HEX_LAYOUT, start, end); }
export function straightHexLine(start: HexCoord, end: HexCoord) { return straightHexLineBetween(REWILD_HEX_LAYOUT, start, end); }
export function hexDisk(center: HexCoord, radius: number) {
  const result: HexCoord[] = [];
  for (let q = 0; q < HEX_COLS; q += 1) for (let r = 0; r < HEX_ROWS; r += 1) {
    const candidate = { q, r };
    if (hexDistance(center, candidate) <= radius) result.push(candidate);
  }
  return result;
}

export function hashInt(a: number, b: number, salt: number) {
  let value = (Math.imul(a + 101, 374761393) ^ Math.imul(b + 43, 668265263) ^ Math.imul(salt + 1, 1597334677)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function mergeHexPatches(...patches: HexCoord[][]) {
  const result = new Map<string, HexCoord>();
  for (const hex of patches.flat()) if (inHexBounds(hex)) result.set(hexKey(hex), hex);
  return [...result.values()];
}

const ROAD_WAYPOINTS: HexCoord[] = [
  { q: 0, r: 10 }, { q: 6, r: 10 }, { q: 11, r: 9 }, { q: 17, r: 10 },
  { q: 23, r: 9 }, { q: 29, r: 10 }, { q: 36, r: 10 },
];

function createRoadNetwork(): RoadNetwork {
  const cells: HexCoord[] = [];
  for (let index = 1; index < ROAD_WAYPOINTS.length; index += 1) {
    for (const hex of hexLine(ROAD_WAYPOINTS[index - 1], ROAD_WAYPOINTS[index])) if (!cells.some((entry) => sameHex(entry, hex))) cells.push(hex);
  }
  return { id: "road-main", cells, points: ROAD_WAYPOINTS };
}

function object(id: string, kind: WorldObjectKind, anchor: HexCoord, footprint: HexCoord[] = [anchor], collision = false): WorldObject {
  return { id, kind, anchor, footprint, width: 1, collision, shadow: false };
}

export function createHexWorld(seed = MAP_SEED): HexWorld {
  const road = createRoadNetwork();
  const roadKeys = new Set(road.cells.map(hexKey));
  const cells = new Map<string, HexCell>();
  for (let q = 0; q < HEX_COLS; q += 1) for (let r = 0; r < HEX_ROWS; r += 1) {
    const hex = { q, r };
    const distanceToHouse = hexDistance(hex, HOUSE_CENTER);
    const distanceToRoad = road.cells.reduce((best, roadHex) => Math.min(best, hexDistance(hex, roadHex)), 99);
    const seedValue = hashInt(q, r, seed);
    const moisture = ((seedValue >>> 8) & 255) / 255;
    const detail = ((seedValue >>> 16) & 255) / 255;
    const readability = Math.max(0, Math.min(1, Math.max(1 - distanceToHouse / 4, 1 - distanceToRoad / 2.5)));
    cells.set(hexKey(hex), {
      hex,
      surface: roadKeys.has(hexKey(hex)) ? "road" : "meadow",
      corruption: 0,
      source: null,
      seed: seedValue,
      moisture,
      detail: detail * (1 - readability * .72),
      readability,
    });
  }

  const biomes: BiomeRegion[] = [
    { id: "forest-west", kind: "forest", cells: mergeHexPatches(hexDisk({ q: 4, r: 3 }, 2), hexDisk({ q: 7, r: 3 }, 2), hexDisk({ q: 8, r: 5 }, 1)), seed: seed ^ 0x4101 },
    { id: "lake-west", kind: "water", cells: mergeHexPatches(hexDisk({ q: 5, r: 8 }, 1), [{ q: 4, r: 7 }, { q: 6, r: 9 }, { q: 7, r: 8 }]), seed: seed ^ 0x4201 },
    { id: "lake-mid", kind: "water", cells: mergeHexPatches(hexDisk({ q: 17, r: 4 }, 1), [{ q: 18, r: 4 }, { q: 17, r: 5 }]), seed: seed ^ 0x4202 },
    { id: "rocks-northeast", kind: "rock", cells: mergeHexPatches(hexDisk({ q: 32, r: 3 }, 1), [{ q: 31, r: 2 }]), seed: seed ^ 0x4301 },
    { id: "flowers-house", kind: "flowers", cells: mergeHexPatches(hexDisk({ q: 12, r: 5 }, 1), [{ q: 13, r: 6 }]), seed: seed ^ 0x4401 },
    { id: "flowers-south", kind: "flowers", cells: mergeHexPatches(hexDisk({ q: 22, r: 12 }, 1), [{ q: 23, r: 11 }]), seed: seed ^ 0x4402 },
  ];

  for (const region of biomes.filter((entry) => entry.kind === "water")) for (const hex of region.cells) {
    const cell = cells.get(hexKey(hex));
    if (cell) cell.surface = "water";
  }
  for (const hex of HOUSE_FOOTPRINT) {
    const cell = cells.get(hexKey(hex));
    if (cell) cell.surface = "house";
  }

  const forest = biomes.find((entry) => entry.id === "forest-west")!;
  const lake = biomes.find((entry) => entry.id === "lake-west")!;
  const objects: WorldObject[] = [
    object("house", "house", HOUSE_CENTER, HOUSE_FOOTPRINT, true),
    object("tree-west-a", "tree", { q: 3, r: 3 }, hexDisk({ q: 3, r: 3 }, 1), true),
    object("tree-west-b", "tree", { q: 6, r: 2 }, [{ q: 6, r: 2 }], true),
    object("pine-west", "pine", { q: 8, r: 4 }, [{ q: 8, r: 4 }], true),
    object("pond-west", "pond", { q: 5, r: 8 }, lake.cells, true),
    object("rocks-ne", "rock", { q: 32, r: 3 }, [{ q: 32, r: 3 }], true),
    object("shrub-house", "shrub", { q: 8, r: 7 }),
    object("log-southwest", "log", { q: 4, r: 12 }),
    object("fence-house", "fence", { q: 11, r: 9 }),
    object("sign-road", "sign", { q: 14, r: 9 }),
    object("ruin-mid", "ruin", { q: 19, r: 7 }, [{ q: 19, r: 7 }], true),
    object("flowers-house", "flowers", { q: 12, r: 5 }, biomes.find((entry) => entry.id === "flowers-house")!.cells),
  ];
  void forest;
  return { seed, cells, objects, road, biomes };
}

export function cellAt(world: HexWorld, hex: HexCoord) { return world.cells.get(hexKey(hex)); }
export function biomeAt(world: HexWorld, hex: HexCoord) { return world.biomes.find((region) => region.cells.some((cell) => sameHex(cell, hex))); }
export function objectAt(world: HexWorld, hex: HexCoord, collisionOnly = false) {
  return world.objects.find((entry) => (!collisionOnly || entry.collision) && entry.footprint.some((cell) => sameHex(cell, hex)));
}
export function plantAt(state: GameState, hex: HexCoord) { return state.plants.find((plant) => sameHex(plant, hex)); }
export function nodeAt(state: GameState, hex: HexCoord) { return state.nodes.find((node) => node.footprint.some((cell) => sameHex(cell, hex))); }
export function ruinAt(state: GameState, hex: HexCoord) { return state.ruins.find((ruin) => ruin.footprint.some((cell) => sameHex(cell, hex))); }
export function createFacilityFootprint(anchor: HexCoord, boss: boolean) { return hexDisk(anchor, boss ? 2 : 1); }
export function facilityStage(node: DataNode) { return Math.min(3, Math.floor(node.buildProgress / (node.boss ? 3 : 2))); }
export function facilityOperational(node: DataNode) { return node.hp > 0; }

function facilityOutlet(anchor: HexCoord, footprint: HexCoord[]) {
  const footprintKeys = new Set(footprint.map(hexKey));
  const candidates = footprint.flatMap(hexNeighbors)
    .filter((hex, index, list) => !footprintKeys.has(hexKey(hex)) && list.findIndex((entry) => sameHex(entry, hex)) === index)
    .sort((left, right) => hexDistance(left, HOUSE_CENTER) - hexDistance(right, HOUSE_CENTER));
  return candidates[0] ?? anchor;
}

function addInitialNode(state: GameState, anchor: HexCoord) {
  const id = state.nextId++;
  const footprint = createFacilityFootprint(anchor, false);
  for (const hex of footprint) {
    const cell = cellAt(state.world, hex);
    if (!cell) continue;
    cell.surface = "foundation";
    cell.corruption = sameHex(hex, anchor) ? 4 : 0;
    cell.source = sameHex(hex, anchor) ? id : null;
  }
  state.nodes.push({ id, anchor, hp: 150, maxHp: 150, spreadTimer: 13, spawnTimer: 11, boss: false, buildProgress: 0, footprint, outlet: facilityOutlet(anchor, footprint) });
}

export function createGameState(best: number, difficulty: Difficulty = "normal", status: GameStatus = "playing"): GameState {
  const config = DIFFICULTIES[difficulty];
  const state: GameState = {
    status,
    world: createHexWorld(),
    plants: [], enemies: [], nodes: [], ruins: [], beams: [], effects: [],
    ecosystemTimer: 0, pondCueTimer: 0, environmentResponses: new Map(),
    sunlight: config.sunlightStart, houseHp: config.houseHp, wave: 1, nextWave: 24, elapsed: 0, score: 0,
    selected: "vinewhip", cursor: { q: 12, r: 7 }, message: "AI slop detected. Grow weapons.", messageUntil: 3,
    bossSpawned: false, nextId: 1, best, difficulty, reviewState: null,
  };
  for (const anchor of INITIAL_NODE_ANCHORS) addInitialNode(state, anchor);
  for (const entry of state.world.objects.filter((item) => item.kind === "tree" || item.kind === "pine" || item.kind === "pond")) {
    state.environmentResponses.set(entry.id, { stress: 0, recoveringUntil: 0 });
  }
  return state;
}

export function objectCorruption(state: GameState, target: WorldObject) {
  return target.footprint.reduce<number>((highest, hex) => Math.max(highest, cellAt(state.world, hex)?.corruption ?? 0), 0) as CorruptionLevel;
}
export function environmentVisualState(state: GameState, target: WorldObject): EnvironmentVisualState {
  const stress = objectCorruption(state, target);
  const response = state.environmentResponses.get(target.id);
  if (response && response.recoveringUntil > state.elapsed && stress <= 1) return "recovering";
  if (stress === 0) return "healthy";
  if (stress === 1) return "stressed";
  if (stress >= 4) return "dead";
  return "corrupted";
}

function isInspectionBuildable(state: GameState, hex: HexCoord) {
  const cell = cellAt(state.world, hex);
  if (!cell || objectAt(state.world, hex, true) || nodeAt(state, hex) || plantAt(state, hex) || HOUSE_FOOTPRINT.some((house) => sameHex(house, hex))) return false;
  const biome = biomeAt(state.world, hex)?.kind;
  if (biome === "forest" || biome === "water" || biome === "rock" || biome === "flowers") return false;
  if (state.selected === "rootreclaimer") return cell.corruption > 0;
  return (cell.surface === "meadow" || cell.surface === "road") && cell.corruption === 0;
}

export function inspectHex(state: GameState, hex: HexCoord): EcosystemInspection {
  const cell = cellAt(state.world, hex);
  if (!cell) return { title: "Outside field", subtitle: "No cell", details: [], valid: false, score: null };
  const plant = plantAt(state, hex);
  const node = nodeAt(state, hex);
  const worldObject = objectAt(state.world, hex);
  const biome = biomeAt(state.world, hex);
  if (plant) return { title: PLANTS[plant.kind].name, subtitle: "Defender", details: [`${Math.max(0, Math.round(plant.hp))} HP`, "Stationary", "Attacks automatically"], valid: false, score: null };
  if (node) return { title: node.boss ? "Mainframe Core" : "AI slop datacenter", subtitle: "Industrial source", details: [`${Math.max(0, Math.round(node.hp))} HP`, "Spreads corruption", "Spawns enemies"], valid: false, score: null };
  if (worldObject) return { title: worldObject.kind === "house" ? "Last human house" : worldObject.kind, subtitle: "Occupied cell", details: [biome?.kind ?? cell.surface, `Corruption ${cell.corruption}/4`], valid: false, score: null };
  const valid = isInspectionBuildable(state, hex);
  return { title: biome?.kind ?? (cell.surface === "road" ? "Road" : "Meadow"), subtitle: valid ? "Buildable" : "Terrain", details: [`Corruption ${cell.corruption}/4`, `Hex ${hex.q},${hex.r}`], valid, score: valid ? 1 : null };
}

export function toUi(state: GameState): UiSnapshot {
  return {
    status: state.status,
    sunlight: Math.floor(state.sunlight),
    houseHp: Math.max(0, Math.round(state.houseHp)),
    houseIntegrity: Math.max(0, Math.min(100, Math.round(state.houseHp))),
    corruption: 0,
    wave: state.wave,
    nextWave: Math.max(0, Math.ceil(state.nextWave)),
    elapsed: state.elapsed,
    score: Math.round(state.score),
    selected: state.selected,
    message: state.message,
    best: state.best,
    difficulty: state.difficulty,
    plants: state.plants.length,
    enemies: state.enemies.length,
    nodes: state.nodes.length,
    reviewState: state.reviewState,
    inspection: inspectHex(state, state.cursor),
  };
}

export function moveCursor(state: GameState, direction: number) {
  const next = hexNeighborFor(REWILD_HEX_LAYOUT, state.cursor, direction);
  if (!next) return false;
  state.cursor = next;
  return true;
}

function reviewEnemy(state: GameState, kind: EnemyKind, hex: HexCoord, id: number): EnemyEntity {
  const config = ENEMIES[kind];
  return { id, kind, position: hexCenter(hex), hex, hp: config.hp, maxHp: config.hp, speed: config.speed, damage: config.damage, cooldown: 0, pathTimer: 0, path: [], slowUntil: 0, breached: false };
}

export function createReviewGameState(best: number, reviewState: RewildReviewState): GameState {
  const state = createGameState(best, "normal", "playing");
  state.reviewState = reviewState;
  state.wave = 4;
  state.sunlight = 88;
  state.score = 1240;
  state.elapsed = 42;
  state.nextWave = 11;
  state.plants.push(
    { id: state.nextId++, kind: "sunbloom", q: 12, r: 6, hp: 45, cooldown: 0, age: 8, reclaimTimer: 0, disabledUntil: 0, reclaimTarget: null, reclaimUntil: 0, attackTarget: null, attackUntil: 0 },
    { id: state.nextId++, kind: "vinewhip", q: 15, r: 8, hp: 55, cooldown: 0, age: 8, reclaimTimer: 0, disabledUntil: 0, reclaimTarget: { q: 21, r: 8 }, reclaimUntil: 0, attackTarget: { q: 22, r: 8 }, attackUntil: 43 },
    { id: state.nextId++, kind: "rootreclaimer", q: 18, r: 11, hp: 65, cooldown: 0, age: 8, reclaimTimer: 1, disabledUntil: 0, reclaimTarget: { q: 21, r: 10 }, reclaimUntil: 43, attackTarget: null, attackUntil: 0 },
  );
  state.enemies.push(reviewEnemy(state, "clickbait", { q: 23, r: 8 }, state.nextId++), reviewEnemy(state, "deepfake", { q: 26, r: 8 }, state.nextId++), reviewEnemy(state, "popup", { q: 28, r: 7 }, state.nextId++));
  const stressed = [{ q: 23, r: 6 }, { q: 24, r: 6 }, { q: 24, r: 7 }, { q: 25, r: 7 }, { q: 26, r: 7 }];
  for (const hex of stressed) {
    const cell = cellAt(state.world, hex);
    if (cell && cell.surface !== "water" && cell.surface !== "house") cell.corruption = reviewState === "reclamation" ? 2 : 4;
  }
  if (reviewState === "damage" && state.nodes[0]) state.nodes[0].hp = 45;
  if (reviewState === "collapse" && state.nodes[0]) state.nodes[0].hp = 8;
  if (reviewState === "response") state.houseHp = 62;
  return state;
}
