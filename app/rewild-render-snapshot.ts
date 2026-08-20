import {
  HOUSE_FOOTPRINT,
  hexDistance,
  hexKey,
  hexLine,
  hexNeighbors,
  type GameState,
  type HexCoord,
  type HexWorld,
} from "./rewild-hex-world";

export interface RenderEdge {
  from: HexCoord;
  to: HexCoord;
}

export interface RenderSnapshot {
  state: GameState;
  regionNeighborMasks: ReadonlyMap<string, ReadonlyMap<string, number>>;
  occupiedHexes: ReadonlySet<string>;
  roadEdges: readonly RenderEdge[];
  cableEdges: readonly RenderEdge[];
  enemyRouteEdges: readonly RenderEdge[];
}

function cloneHex(hex: HexCoord): HexCoord {
  return { q: hex.q, r: hex.r };
}

function cloneWorld(world: HexWorld): HexWorld {
  return {
    seed: world.seed,
    cells: new Map([...world.cells].map(([key, cell]) => [key, { ...cell, hex: cloneHex(cell.hex) }])),
    objects: world.objects.map((object) => ({
      ...object,
      anchor: cloneHex(object.anchor),
      footprint: object.footprint.map(cloneHex),
    })),
    road: {
      ...world.road,
      cells: world.road.cells.map(cloneHex),
      points: world.road.points.map(cloneHex),
    },
    biomes: world.biomes.map((region) => ({
      ...region,
      cells: region.cells.map(cloneHex),
    })),
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    world: cloneWorld(state.world),
    plants: state.plants.map((plant) => ({
      ...plant,
      reclaimTarget: plant.reclaimTarget ? cloneHex(plant.reclaimTarget) : null,
      attackTarget: plant.attackTarget ? cloneHex(plant.attackTarget) : null,
    })),
    enemies: state.enemies.map((enemy) => ({
      ...enemy,
      position: { ...enemy.position },
      hex: cloneHex(enemy.hex),
      path: enemy.path.map(cloneHex),
    })),
    nodes: state.nodes.map((node) => ({
      ...node,
      anchor: cloneHex(node.anchor),
      footprint: node.footprint.map(cloneHex),
      outlet: cloneHex(node.outlet),
    })),
    ruins: state.ruins.map((ruin) => ({
      ...ruin,
      anchor: cloneHex(ruin.anchor),
      footprint: ruin.footprint.map(cloneHex),
      outlet: cloneHex(ruin.outlet),
    })),
    beams: state.beams.map((beam) => ({ ...beam, from: { ...beam.from }, to: { ...beam.to } })),
    effects: state.effects.map((effect) => ({ ...effect, position: { ...effect.position } })),
    environmentResponses: new Map([...state.environmentResponses].map(([key, value]) => [key, { ...value }])),
    cursor: cloneHex(state.cursor),
  };
}

function regionMasks(state: GameState) {
  const result = new Map<string, ReadonlyMap<string, number>>();
  for (const region of state.world.biomes) {
    const keys = new Set(region.cells.map(hexKey));
    const masks = new Map<string, number>();
    for (const cell of region.cells) {
      let mask = 0;
      hexNeighbors(cell).forEach((neighbor, index) => {
        if (keys.has(hexKey(neighbor))) mask |= 1 << index;
      });
      masks.set(hexKey(cell), mask);
    }
    result.set(region.id, masks);
  }
  return result;
}

function occupiedHexes(state: GameState) {
  const occupied = new Set(HOUSE_FOOTPRINT.map(hexKey));
  for (const plant of state.plants) occupied.add(hexKey(plant));
  for (const node of state.nodes) for (const hex of node.footprint) occupied.add(hexKey(hex));
  for (const ruin of state.ruins) for (const hex of ruin.footprint) occupied.add(hexKey(hex));
  for (const object of state.world.objects) if (object.collision) for (const hex of object.footprint) occupied.add(hexKey(hex));
  return occupied;
}

function adjacentEdges(cells: readonly HexCoord[]) {
  const edges: RenderEdge[] = [];
  for (let index = 1; index < cells.length; index += 1) {
    const from = cells[index - 1];
    const to = cells[index];
    if (hexDistance(from, to) === 1) edges.push({ from: cloneHex(from), to: cloneHex(to) });
  }
  return edges;
}

function cableEdges(state: GameState) {
  return state.nodes.flatMap((node) => adjacentEdges(hexLine(node.anchor, node.outlet)));
}

function enemyRouteEdges(state: GameState) {
  return state.enemies.flatMap((enemy) => adjacentEdges([enemy.hex, ...enemy.path]));
}

export function createRenderSnapshot(source: GameState): RenderSnapshot {
  const state = cloneState(source);
  return {
    state,
    regionNeighborMasks: regionMasks(state),
    occupiedHexes: occupiedHexes(state),
    roadEdges: adjacentEdges(state.world.road.cells),
    cableEdges: cableEdges(state),
    enemyRouteEdges: enemyRouteEdges(state),
  };
}
