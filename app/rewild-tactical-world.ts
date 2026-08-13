import {
  hexCenterFor,
  hexDirectionBetween,
  hexDistanceBetween,
  hexLineBetween,
  hexNeighborFor,
  hexNeighborsFor,
  inHexLayout,
  pixelToHexFor,
  type HexCoord,
  type HexLayout,
  type PixelPoint,
} from "./rewild-hex-grid.ts";

export type { HexCoord, PixelPoint } from "./rewild-hex-grid.ts";

export const TACTICAL_COLS = 37;
export const TACTICAL_ROWS = 15;
export const TACTICAL_SIZE = 21;
export const TACTICAL_CANVAS_WIDTH = 1200;
export const TACTICAL_CANVAS_HEIGHT = 560;
export const TACTICAL_BENCHMARK_SEED = 0x52455749;
export const TACTICAL_LAYOUT: HexLayout = {
  cols: TACTICAL_COLS,
  rows: TACTICAL_ROWS,
  size: TACTICAL_SIZE,
  origin: { x: 12, y: 0 },
};

export type TacticalGround = "soil" | "water" | "stone" | "industrial" | "rubble";
export type TacticalHabitat = "grass" | "flowers" | "forest" | null;
export type TacticalTerritory = "nature" | "industry" | "contested";
export type TacticalConnectionKind = "road" | "cable" | "root" | "drain" | "wall";
export type TacticalComponentKind = "forest" | "lake";
export type TacticalSide = "ally" | "enemy";
export type TacticalFacing = 0 | 1 | 2 | 3 | 4 | 5;
export type TacticalPhase = "player" | "enemy" | "resolve";
export type TacticalActionMode = "move" | "attack" | "restore" | null;

export interface TacticalCellState {
  hex: HexCoord;
  ground: TacticalGround;
  habitat: TacticalHabitat;
  territory: TacticalTerritory;
  corruption: number;
  recovery: number;
  structureId: string | null;
  occupantId: string | null;
  variantSeed: number;
}

export type TacticalCell = TacticalCellState;

export interface TacticalEdgeConnections {
  road: boolean;
  cable: boolean;
  root: boolean;
  drain: boolean;
  wall: boolean;
}

/** One undirected shared border. `direction` points from `a` to `b`. */
export interface TacticalEdgeState extends TacticalEdgeConnections {
  key: string;
  a: HexCoord;
  b: HexCoord;
  direction: TacticalFacing;
}

export type TacticalEdge = TacticalEdgeState;

export interface TacticalComponentBoundary {
  cell: HexCoord;
  direction: TacticalFacing;
  neighbor: HexCoord | null;
}

export interface TacticalComponent {
  id: string;
  kind: TacticalComponentKind;
  cells: HexCoord[];
  boundary: TacticalComponentBoundary[];
  variantSeed: number;
}

export type TacticalStructureKind = "data-core" | "server-block" | "cooling-array" | "relay";

export interface TacticalStructure {
  id: string;
  kind: TacticalStructureKind;
  anchor: HexCoord;
  footprint: HexCoord[];
  hp: number;
  maxHp: number;
  buildProgress: number;
}

export type TacticalAllyKind = "rootreclaimer" | "sunbloom" | "vinewhip" | "elderoak";
export type TacticalEnemyKind = "slop-swarm" | "deepfake-sludge" | "popup-parasite" | "fragment";

export interface TacticalEntity {
  id: string;
  name: string;
  side: TacticalSide;
  kind: TacticalAllyKind | TacticalEnemyKind;
  hex: HexCoord;
  facing: TacticalFacing;
  actionPoints: number;
  maxActionPoints: number;
  hp: number;
  maxHp: number;
}

export interface TacticalTurnState {
  number: number;
  phase: TacticalPhase;
  selectedEntityId: string | null;
  selectedAction: TacticalActionMode;
}

export interface TacticalPreviewState {
  hex: HexCoord;
  action: TacticalActionMode;
  valid: boolean;
  reason: string;
  edge: TacticalEdgeState | null;
}

export interface TacticalComponentIndex {
  forests: TacticalComponent[];
  lakes: TacticalComponent[];
  all: TacticalComponent[];
}

export interface TacticalWorldState {
  seed: number;
  cells: Map<string, TacticalCellState>;
  edges: Map<string, TacticalEdgeState>;
  components: TacticalComponentIndex;
  structures: TacticalStructure[];
  entities: TacticalEntity[];
  turn: TacticalTurnState;
  preview: TacticalPreviewState | null;
}

export interface TacticalCellInspection {
  cell: TacticalCellState | null;
  entity: TacticalEntity | null;
  structure: TacticalStructure | null;
  components: TacticalComponent[];
  edges: TacticalEdgeState[];
}

export interface TacticalUiSnapshot {
  turnNumber: number;
  phase: TacticalPhase;
  selectedAction: TacticalActionMode;
  selectedEntityId: string | null;
  selectedEntity: TacticalEntity | null;
  preview: TacticalPreviewState | null;
  allyCount: number;
  enemyCount: number;
  natureCells: number;
  industryCells: number;
  contestedCells: number;
  averageCorruption: number;
}

export type TacticalWorldAction =
  | { type: "select-entity"; entityId: string }
  | { type: "choose-action"; action: TacticalActionMode }
  | { type: "move"; to: HexCoord }
  | { type: "end-turn" };

const EMPTY_CONNECTIONS: TacticalEdgeConnections = {
  road: false,
  cable: false,
  root: false,
  drain: false,
  wall: false,
};

// The authored frontier deliberately shifts from row to row. It is map state,
// not a renderer mask, so industry can actually replace nature cell by cell.
const FRONTIER_BY_ROW = [24, 23, 24, 22, 23, 24, 23, 22, 23, 21, 22, 24, 23, 24, 23] as const;

export function tacticalCellKey(hex: HexCoord) {
  return `${hex.q},${hex.r}`;
}

function compareHex(left: HexCoord, right: HexCoord) {
  return left.q - right.q || left.r - right.r;
}

export function tacticalEdgeKey(left: HexCoord, right: HexCoord) {
  const [a, b] = compareHex(left, right) <= 0 ? [left, right] : [right, left];
  return `${tacticalCellKey(a)}|${tacticalCellKey(b)}`;
}

export function tacticalCellAt(state: TacticalWorldState, hex: HexCoord) {
  return state.cells.get(tacticalCellKey(hex));
}

export function tacticalEntityAt(state: TacticalWorldState, hex: HexCoord) {
  const occupantId = tacticalCellAt(state, hex)?.occupantId;
  return occupantId ? state.entities.find((entity) => entity.id === occupantId) : undefined;
}

export function tacticalEdgeAt(state: TacticalWorldState, left: HexCoord, right: HexCoord) {
  return state.edges.get(tacticalEdgeKey(left, right));
}

export function tacticalNeighbors(hex: HexCoord) {
  return hexNeighborsFor(TACTICAL_LAYOUT, hex);
}

export function tacticalNeighbor(hex: HexCoord, direction: number) {
  return hexNeighborFor(TACTICAL_LAYOUT, hex, direction);
}

export function tacticalCenter(hex: HexCoord): PixelPoint {
  return hexCenterFor(TACTICAL_LAYOUT, hex);
}

export function tacticalPixelToHex(x: number, y: number) {
  return pixelToHexFor(TACTICAL_LAYOUT, x, y);
}

export function tacticalEdgesForCell(state: TacticalWorldState, hex: HexCoord) {
  return tacticalNeighbors(hex)
    .map((neighbor) => tacticalEdgeAt(state, hex, neighbor))
    .filter((edge): edge is TacticalEdgeState => Boolean(edge));
}

function cellHash(seed: number, hex: HexCoord, salt = 0) {
  let value = seed ^ Math.imul(hex.q + 0x9e37, 0x85ebca6b) ^ Math.imul(hex.r + 0x7f4a, 0xc2b2ae35) ^ salt;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

function cellsInDisk(center: HexCoord, radius: number) {
  const result: HexCoord[] = [];
  for (let q = 0; q < TACTICAL_COLS; q += 1) {
    for (let r = 0; r < TACTICAL_ROWS; r += 1) {
      const hex = { q, r };
      if (hexDistanceBetween(center, hex) <= radius) result.push(hex);
    }
  }
  return result;
}

function cellSet(disks: Array<{ center: HexCoord; radius: number }>, remove: HexCoord[] = []) {
  const result = new Set<string>();
  for (const disk of disks) for (const hex of cellsInDisk(disk.center, disk.radius)) result.add(tacticalCellKey(hex));
  for (const hex of remove) result.delete(tacticalCellKey(hex));
  return result;
}

function createCells(seed: number) {
  const cells = new Map<string, TacticalCellState>();
  for (let q = 0; q < TACTICAL_COLS; q += 1) {
    for (let r = 0; r < TACTICAL_ROWS; r += 1) {
      const hex = { q, r };
      const frontier = FRONTIER_BY_ROW[r];
      const variantSeed = cellHash(seed, hex);
      const frontierOffset = q - frontier;
      const territory: TacticalTerritory = frontierOffset <= -2 ? "nature" : frontierOffset >= 1 ? "industry" : "contested";
      const industrial = territory === "industry" || (territory === "contested" && frontierOffset === 0 && (variantSeed & 1) === 0);
      const rubble = territory === "contested" && variantSeed % 7 === 0;
      cells.set(tacticalCellKey(hex), {
        hex,
        ground: rubble ? "rubble" : industrial ? "industrial" : "soil",
        habitat: industrial || rubble ? null : "grass",
        territory,
        corruption: territory === "nature" ? variantSeed % 7 : territory === "contested" ? 38 + variantSeed % 31 : 76 + variantSeed % 21,
        recovery: territory === "nature" ? 64 + variantSeed % 31 : territory === "contested" ? variantSeed % 22 : 0,
        structureId: null,
        occupantId: null,
        variantSeed,
      });
    }
  }

  const lakeCells = cellSet([
    { center: { q: 7, r: 5 }, radius: 2 },
    { center: { q: 10, r: 5 }, radius: 1 },
    { center: { q: 15, r: 10 }, radius: 2 },
    { center: { q: 17, r: 11 }, radius: 1 },
  ], [{ q: 5, r: 4 }, { q: 9, r: 6 }, { q: 13, r: 9 }]);

  const forestCells = cellSet([
    { center: { q: 2, r: 2 }, radius: 3 },
    { center: { q: 6, r: 2 }, radius: 2 },
    { center: { q: 5, r: 12 }, radius: 3 },
    { center: { q: 9, r: 13 }, radius: 2 },
    { center: { q: 15, r: 2 }, radius: 2 },
  ], [{ q: 4, r: 3 }, { q: 7, r: 1 }, { q: 4, r: 11 }, { q: 14, r: 3 }]);

  const flowerCells = cellSet([
    { center: { q: 12, r: 6 }, radius: 1 },
    { center: { q: 18, r: 3 }, radius: 1 },
    { center: { q: 11, r: 12 }, radius: 1 },
  ]);

  const stoneCells = new Set([
    "4,7", "5,7", "9,9", "12,2", "13,2", "18,12", "19,12", "20,11",
  ]);

  for (const [key, cell] of cells) {
    if (cell.territory === "industry") continue;
    if (lakeCells.has(key)) {
      cell.ground = "water";
      cell.habitat = null;
      cell.corruption = Math.min(cell.corruption, 12);
      cell.recovery = Math.max(cell.recovery, 72);
    } else if (stoneCells.has(key)) {
      cell.ground = "stone";
      cell.habitat = null;
    } else if (forestCells.has(key)) {
      cell.ground = "soil";
      cell.habitat = "forest";
      cell.recovery = Math.max(cell.recovery, 82);
    } else if (flowerCells.has(key)) {
      cell.ground = "soil";
      cell.habitat = "flowers";
      cell.recovery = Math.max(cell.recovery, 76);
    }
  }
  return cells;
}

function createEdges() {
  const edges = new Map<string, TacticalEdgeState>();
  for (let q = 0; q < TACTICAL_COLS; q += 1) {
    for (let r = 0; r < TACTICAL_ROWS; r += 1) {
      const hex = { q, r };
      for (const neighbor of tacticalNeighbors(hex)) {
        const key = tacticalEdgeKey(hex, neighbor);
        if (edges.has(key)) continue;
        const [a, b] = compareHex(hex, neighbor) <= 0 ? [hex, neighbor] : [neighbor, hex];
        const direction = hexDirectionBetween(a, b);
        if (direction === null) continue;
        edges.set(key, { key, a, b, direction: direction as TacticalFacing, ...EMPTY_CONNECTIONS });
      }
    }
  }
  return edges;
}

function setPathConnection(edges: Map<string, TacticalEdgeState>, path: HexCoord[], connection: TacticalConnectionKind) {
  for (let index = 1; index < path.length; index += 1) {
    const edge = edges.get(tacticalEdgeKey(path[index - 1], path[index]));
    if (edge) edge[connection] = true;
  }
}

function connectLine(edges: Map<string, TacticalEdgeState>, start: HexCoord, end: HexCoord, connection: TacticalConnectionKind) {
  setPathConnection(edges, hexLineBetween(TACTICAL_LAYOUT, start, end), connection);
}

function createStructures(cells: Map<string, TacticalCellState>): TacticalStructure[] {
  const structures: TacticalStructure[] = [
    { id: "data-core-01", kind: "data-core", anchor: { q: 33, r: 7 }, footprint: cellsInDisk({ q: 33, r: 7 }, 1), hp: 240, maxHp: 240, buildProgress: 1 },
    { id: "server-north", kind: "server-block", anchor: { q: 28, r: 3 }, footprint: [{ q: 28, r: 3 }, { q: 29, r: 3 }, { q: 29, r: 2 }], hp: 120, maxHp: 120, buildProgress: 1 },
    { id: "server-south", kind: "server-block", anchor: { q: 29, r: 11 }, footprint: [{ q: 29, r: 11 }, { q: 30, r: 11 }, { q: 30, r: 10 }], hp: 120, maxHp: 120, buildProgress: 1 },
    { id: "cooling-01", kind: "cooling-array", anchor: { q: 34, r: 3 }, footprint: [{ q: 34, r: 3 }, { q: 35, r: 3 }, { q: 35, r: 2 }], hp: 90, maxHp: 90, buildProgress: 1 },
    { id: "relay-frontier", kind: "relay", anchor: { q: 25, r: 7 }, footprint: [{ q: 25, r: 7 }], hp: 55, maxHp: 55, buildProgress: .78 },
  ];
  for (const structure of structures) {
    for (const hex of structure.footprint) {
      const cell = cells.get(tacticalCellKey(hex));
      if (!cell) continue;
      cell.ground = "industrial";
      cell.habitat = null;
      cell.territory = "industry";
      cell.corruption = Math.max(cell.corruption, 84);
      cell.recovery = 0;
      cell.structureId = structure.id;
    }
  }
  return structures;
}

function createEntities(cells: Map<string, TacticalCellState>): TacticalEntity[] {
  const entities: TacticalEntity[] = [
    { id: "ally-rootreclaimer", name: "Rootreclaimer", side: "ally", kind: "rootreclaimer", hex: { q: 18, r: 7 }, facing: 0, actionPoints: 3, maxActionPoints: 3, hp: 65, maxHp: 65 },
    { id: "ally-sunbloom", name: "Sunbloom", side: "ally", kind: "sunbloom", hex: { q: 12, r: 4 }, facing: 0, actionPoints: 2, maxActionPoints: 2, hp: 45, maxHp: 45 },
    { id: "ally-vinewhip", name: "Vinewhip", side: "ally", kind: "vinewhip", hex: { q: 18, r: 10 }, facing: 1, actionPoints: 2, maxActionPoints: 2, hp: 55, maxHp: 55 },
    { id: "ally-elderoak", name: "Elder Oak", side: "ally", kind: "elderoak", hex: { q: 9, r: 11 }, facing: 0, actionPoints: 1, maxActionPoints: 1, hp: 300, maxHp: 300 },
    { id: "enemy-slop", name: "AI Slop Swarm", side: "enemy", kind: "slop-swarm", hex: { q: 23, r: 7 }, facing: 3, actionPoints: 2, maxActionPoints: 2, hp: 22, maxHp: 22 },
    { id: "enemy-sludge", name: "Deepfake Sludge", side: "enemy", kind: "deepfake-sludge", hex: { q: 27, r: 9 }, facing: 3, actionPoints: 1, maxActionPoints: 1, hp: 70, maxHp: 70 },
    { id: "enemy-popup", name: "Popup Parasite", side: "enemy", kind: "popup-parasite", hex: { q: 30, r: 5 }, facing: 4, actionPoints: 2, maxActionPoints: 2, hp: 34, maxHp: 34 },
    { id: "enemy-fragment", name: "AI Slop Fragment", side: "enemy", kind: "fragment", hex: { q: 25, r: 12 }, facing: 4, actionPoints: 2, maxActionPoints: 2, hp: 16, maxHp: 16 },
  ];
  for (const entity of entities) {
    const cell = cells.get(tacticalCellKey(entity.hex));
    if (!cell || cell.structureId || cell.occupantId) throw new Error(`Invalid authored entity position: ${entity.id}`);
    cell.occupantId = entity.id;
  }
  return entities;
}

function configureNetworks(edges: Map<string, TacticalEdgeState>) {
  connectLine(edges, { q: 19, r: 8 }, { q: 36, r: 8 }, "road");
  connectLine(edges, { q: 26, r: 8 }, { q: 28, r: 3 }, "road");
  connectLine(edges, { q: 27, r: 8 }, { q: 29, r: 11 }, "road");

  connectLine(edges, { q: 25, r: 7 }, { q: 33, r: 7 }, "cable");
  connectLine(edges, { q: 28, r: 3 }, { q: 33, r: 7 }, "cable");
  connectLine(edges, { q: 29, r: 11 }, { q: 33, r: 7 }, "cable");
  connectLine(edges, { q: 34, r: 3 }, { q: 33, r: 7 }, "drain");

  connectLine(edges, { q: 18, r: 7 }, { q: 23, r: 7 }, "root");
  connectLine(edges, { q: 18, r: 7 }, { q: 15, r: 10 }, "root");

  for (let r = 2; r <= 12; r += 2) {
    const frontier = FRONTIER_BY_ROW[r];
    const left = { q: frontier, r };
    const right = tacticalNeighbor(left, 0);
    if (right) {
      const edge = edges.get(tacticalEdgeKey(left, right));
      if (edge) edge.wall = true;
    }
  }
}

function componentFor(
  id: string,
  kind: TacticalComponentKind,
  memberCells: HexCoord[],
  seed: number,
) {
  const members = new Set(memberCells.map(tacticalCellKey));
  const boundary: TacticalComponentBoundary[] = [];
  for (const cell of memberCells) {
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = tacticalNeighbor(cell, direction);
      if (!neighbor || !members.has(tacticalCellKey(neighbor))) {
        boundary.push({ cell, direction: direction as TacticalFacing, neighbor });
      }
    }
  }
  return { id, kind, cells: memberCells, boundary, variantSeed: cellHash(seed, memberCells[0], kind === "forest" ? 0xf0ae57 : 0x1a6e) };
}

function deriveComponentsOfKind(cells: Map<string, TacticalCellState>, kind: TacticalComponentKind, seed: number) {
  const qualifies = (cell: TacticalCellState) => kind === "forest" ? cell.habitat === "forest" : cell.ground === "water";
  const unseen = new Set(Array.from(cells.values()).filter(qualifies).map((cell) => tacticalCellKey(cell.hex)));
  const components: TacticalComponent[] = [];
  while (unseen.size) {
    const startKey = unseen.values().next().value as string;
    unseen.delete(startKey);
    const start = cells.get(startKey);
    if (!start) continue;
    const queue = [start.hex];
    const members: HexCoord[] = [];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      members.push(current);
      for (const neighbor of tacticalNeighbors(current)) {
        const key = tacticalCellKey(neighbor);
        if (!unseen.has(key)) continue;
        unseen.delete(key);
        queue.push(neighbor);
      }
    }
    members.sort(compareHex);
    components.push(componentFor(`${kind}-${components.length + 1}`, kind, members, seed));
  }
  return components;
}

export function deriveTacticalComponents(cells: Map<string, TacticalCellState>, seed = TACTICAL_BENCHMARK_SEED): TacticalComponentIndex {
  const forests = deriveComponentsOfKind(cells, "forest", seed);
  const lakes = deriveComponentsOfKind(cells, "lake", seed);
  return { forests, lakes, all: [...forests, ...lakes] };
}

export function createTacticalBenchmark(seed = TACTICAL_BENCHMARK_SEED): TacticalWorldState {
  const cells = createCells(seed);
  const edges = createEdges();
  const structures = createStructures(cells);
  const entities = createEntities(cells);
  configureNetworks(edges);
  return {
    seed,
    cells,
    edges,
    components: deriveTacticalComponents(cells, seed),
    structures,
    entities,
    turn: {
      number: 1,
      phase: "player",
      selectedEntityId: "ally-rootreclaimer",
      selectedAction: "move",
    },
    preview: null,
  };
}

function activeSideForPhase(phase: TacticalPhase): TacticalSide | null {
  if (phase === "player") return "ally";
  if (phase === "enemy") return "enemy";
  return null;
}

export function selectTacticalEntity(state: TacticalWorldState, entityId: string): TacticalWorldState {
  const entity = state.entities.find((candidate) => candidate.id === entityId);
  if (!entity || entity.side !== activeSideForPhase(state.turn.phase) || entity.hp <= 0) return state;
  return { ...state, turn: { ...state.turn, selectedEntityId: entity.id, selectedAction: null }, preview: null };
}

export function chooseTacticalAction(state: TacticalWorldState, action: TacticalActionMode): TacticalWorldState {
  if (!state.turn.selectedEntityId || state.turn.phase === "resolve") return state;
  return { ...state, turn: { ...state.turn, selectedAction: action }, preview: null };
}

export const setTacticalAction = chooseTacticalAction;

function tacticalPreviewValidity(state: TacticalWorldState, hex: HexCoord) {
  const selected = state.entities.find((entity) => entity.id === state.turn.selectedEntityId);
  const cell = tacticalCellAt(state, hex);
  if (!selected || !cell || !state.turn.selectedAction) return { valid: false, reason: "Choose a unit and action." };
  if (selected.actionPoints < 1) return { valid: false, reason: "No action points remain." };
  if (hexDistanceBetween(selected.hex, hex) !== 1) return { valid: false, reason: "Actions cross one shared hex border." };
  if (state.turn.selectedAction === "move") {
    if (cell.ground === "water") return { valid: false, reason: "This unit cannot enter water." };
    if (cell.structureId) return { valid: false, reason: "A structure occupies this hex." };
    if (cell.occupantId) return { valid: false, reason: "Another unit occupies this hex." };
    return { valid: true, reason: "Move through this border." };
  }
  if (state.turn.selectedAction === "attack") {
    const target = tacticalEntityAt(state, hex);
    return target && target.side !== selected.side
      ? { valid: true, reason: "Attack the opposing unit." }
      : { valid: false, reason: "Attack requires an adjacent opposing unit." };
  }
  const restorable = cell.corruption > 0 || cell.ground === "rubble" || cell.territory !== "nature";
  return restorable
    ? { valid: true, reason: "Restore the adjacent environment." }
    : { valid: false, reason: "This hex is already healthy." };
}

export function setTacticalPreview(state: TacticalWorldState, hex: HexCoord | null): TacticalWorldState {
  if (!hex || !inHexLayout(TACTICAL_LAYOUT, hex)) return state.preview ? { ...state, preview: null } : state;
  const selected = state.entities.find((entity) => entity.id === state.turn.selectedEntityId);
  const validity = tacticalPreviewValidity(state, hex);
  const edge = selected && hexDistanceBetween(selected.hex, hex) === 1 ? tacticalEdgeAt(state, selected.hex, hex) ?? null : null;
  return {
    ...state,
    preview: { hex: { ...hex }, action: state.turn.selectedAction, valid: validity.valid, reason: validity.reason, edge },
  };
}

function cloneCellMapForMove(state: TacticalWorldState, from: HexCoord, to: HexCoord, entityId: string) {
  const cells = new Map(state.cells);
  const source = tacticalCellAt(state, from);
  const target = tacticalCellAt(state, to);
  if (!source || !target) return null;
  cells.set(tacticalCellKey(from), { ...source, occupantId: null });
  cells.set(tacticalCellKey(to), { ...target, occupantId: entityId });
  return cells;
}

export function moveTacticalEntity(state: TacticalWorldState, to: HexCoord): TacticalWorldState {
  if (state.turn.selectedAction !== "move" || !state.turn.selectedEntityId || !inHexLayout(TACTICAL_LAYOUT, to)) return state;
  const entityIndex = state.entities.findIndex((candidate) => candidate.id === state.turn.selectedEntityId);
  if (entityIndex < 0) return state;
  const entity = state.entities[entityIndex];
  if (entity.side !== activeSideForPhase(state.turn.phase) || entity.actionPoints < 1 || hexDistanceBetween(entity.hex, to) !== 1) return state;
  const target = tacticalCellAt(state, to);
  if (!target || target.ground === "water" || target.structureId || target.occupantId) return state;
  const facing = hexDirectionBetween(entity.hex, to);
  const cells = cloneCellMapForMove(state, entity.hex, to, entity.id);
  if (facing === null || !cells) return state;
  const entities = state.entities.slice();
  entities[entityIndex] = { ...entity, hex: { ...to }, facing: facing as TacticalFacing, actionPoints: entity.actionPoints - 1 };
  return { ...state, cells, entities, preview: null };
}

function resetActionPoints(entities: TacticalEntity[], side: TacticalSide) {
  return entities.map((entity) => entity.side === side ? { ...entity, actionPoints: entity.maxActionPoints } : entity);
}

export function endTacticalTurn(state: TacticalWorldState): TacticalWorldState {
  if (state.turn.phase === "player") {
    return {
      ...state,
      entities: resetActionPoints(state.entities, "enemy"),
      turn: { ...state.turn, phase: "enemy", selectedEntityId: null, selectedAction: null },
      preview: null,
    };
  }
  if (state.turn.phase === "enemy") {
    return { ...state, turn: { ...state.turn, phase: "resolve", selectedEntityId: null, selectedAction: null }, preview: null };
  }
  return {
    ...state,
    entities: resetActionPoints(state.entities, "ally"),
    turn: { number: state.turn.number + 1, phase: "player", selectedEntityId: null, selectedAction: null },
    preview: null,
  };
}

export function inspectTacticalCell(state: TacticalWorldState, hex: HexCoord): TacticalCellInspection {
  const cell = tacticalCellAt(state, hex) ?? null;
  return {
    cell,
    entity: cell?.occupantId ? state.entities.find((entry) => entry.id === cell.occupantId) ?? null : null,
    structure: cell?.structureId ? state.structures.find((entry) => entry.id === cell.structureId) ?? null : null,
    components: state.components.all.filter((component) => component.cells.some((entry) => tacticalCellKey(entry) === tacticalCellKey(hex))),
    edges: cell ? tacticalEdgesForCell(state, hex) : [],
  };
}

export function tacticalUiSnapshot(state: TacticalWorldState): TacticalUiSnapshot {
  let natureCells = 0;
  let industryCells = 0;
  let contestedCells = 0;
  let corruption = 0;
  for (const cell of state.cells.values()) {
    if (cell.territory === "nature") natureCells += 1;
    else if (cell.territory === "industry") industryCells += 1;
    else contestedCells += 1;
    corruption += cell.corruption;
  }
  return {
    turnNumber: state.turn.number,
    phase: state.turn.phase,
    selectedAction: state.turn.selectedAction,
    selectedEntityId: state.turn.selectedEntityId,
    selectedEntity: state.entities.find((entity) => entity.id === state.turn.selectedEntityId) ?? null,
    preview: state.preview,
    allyCount: state.entities.filter((entity) => entity.side === "ally" && entity.hp > 0).length,
    enemyCount: state.entities.filter((entity) => entity.side === "enemy" && entity.hp > 0).length,
    natureCells,
    industryCells,
    contestedCells,
    averageCorruption: corruption / state.cells.size,
  };
}

export function reduceTacticalWorld(state: TacticalWorldState, action: TacticalWorldAction): TacticalWorldState {
  switch (action.type) {
    case "select-entity": return selectTacticalEntity(state, action.entityId);
    case "choose-action": return chooseTacticalAction(state, action.action);
    case "move": return moveTacticalEntity(state, action.to);
    case "end-turn": return endTacticalTurn(state);
  }
}
