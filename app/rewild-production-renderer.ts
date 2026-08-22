import { hexNeighborFor } from "./rewild-hex-grid";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  HEX_HEIGHT,
  HEX_SIZE,
  HOUSE_CENTER,
  HOUSE_FOOTPRINT,
  PLANTS,
  REWILD_HEX_LAYOUT,
  cellAt,
  hexCenter,
  hexDistance,
  hexKey,
  hexLine,
  hexNeighbors,
  hexPolygon,
  inspectHex,
  type BiomeRegion,
  type DataNode,
  type EnemyEntity,
  type GameState,
  type HexCell,
  type HexCoord,
  type PixelPoint,
  type PlantEntity,
  type WorldEffect,
  type WorldObject,
} from "./rewild-hex-world";
import {
  drawRewildSprite,
  fillRewildTerrainPattern,
  spriteForEnemy,
  spriteForPlant,
  type RewildPixelSpriteId,
  type RewildTerrainTileId,
} from "./rewild-pixel-atlas";
import type { RenderEdge, RenderSnapshot } from "./rewild-render-snapshot";
import { drawMeadowLife } from "./rewild-authored-overlay";

export interface RewildCamera {
  x: number;
  y: number;
  zoom: number;
}

interface PixelSegment {
  from: PixelPoint;
  to: PixelPoint;
}

const PALETTE = {
  outside: "#141d1a",
  meadowLight: "#86a956",
  meadow: "#719447",
  meadowDark: "#4d7439",
  forest: "#2f5d35",
  forestDeep: "#23482c",
  forestEdge: "#1e4028",
  water: "#2b6477",
  waterDeep: "#174658",
  waterShallow: "#3c7b8b",
  waterLight: "#6c9fa4",
  stone: "#66716a",
  soil: "#896944",
  industrial: "#303635",
  industrialDark: "#1c2425",
  industrialLight: "#596364",
  industrialRust: "#76523b",
  corruption1: "#696047",
  corruption2: "#594f4a",
  corruption3: "#413b43",
  corruption4: "#29272f",
  meshIndustrial: "rgba(145,155,151,.035)",
  meshPlacement: "rgba(235,225,145,.12)",
  shore: "#8fa563",
  roadDirt: "#65543a",
  roadEdge: "#594a35",
  road: "#917249",
  roadMark: "#b49a63",
  cable: "#d0a143",
  cableDark: "#6f562b",
  placement: "#f1e78b",
  placementBad: "#dd6d61",
};

const CORRUPTION_PALETTE: Record<1 | 2 | 3 | 4, string> = {
  1: PALETTE.corruption1,
  2: PALETTE.corruption2,
  3: PALETTE.corruption3,
  4: PALETTE.corruption4,
};

const GRASS_VARIANTS: readonly RewildTerrainTileId[] = ["grass-a", "grass-b", "grass-c", "grass-d"];

const DIRECTION_TO_POLYGON_EDGE = [0, 5, 4, 3, 2, 1] as const;

function tracePolygon(ctx: CanvasRenderingContext2D, points: PixelPoint[]) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(Math.round(points[index].x), Math.round(points[index].y));
  ctx.closePath();
}

function hexPath(hex: HexCoord, scale: number): Path2D {
  const points = hexPolygon(hex, scale);
  const path = new Path2D();
  if (!points.length) return path;
  path.moveTo(Math.round(points[0].x), Math.round(points[0].y));
  for (let index = 1; index < points.length; index += 1) path.lineTo(Math.round(points[index].x), Math.round(points[index].y));
  path.closePath();
  return path;
}

function hash(seed: number, salt: number) {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) / 0xffffffff;
}

function cellRandom(cell: HexCell, salt: number) {
  return hash(cell.seed, salt);
}

function pixelLine(ctx: CanvasRenderingContext2D, from: PixelPoint, to: PixelPoint, color: string, width = 2, step = 2) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  const size = Math.max(1, Math.round(width));
  ctx.fillStyle = color;
  for (let distance = 0; distance <= length; distance += step) {
    const t = length ? distance / length : 0;
    ctx.fillRect(Math.round(from.x + dx * t - size / 2), Math.round(from.y + dy * t - size / 2), size, size);
  }
}

function drawPixelDisc(ctx: CanvasRenderingContext2D, center: PixelPoint, radius: number, color: string) {
  const integerRadius = Math.max(1, Math.round(radius));
  ctx.fillStyle = color;
  for (let y = -integerRadius; y <= integerRadius; y += 1) {
    const halfSpan = Math.floor(Math.sqrt(integerRadius * integerRadius - y * y));
    ctx.fillRect(Math.round(center.x - halfSpan), Math.round(center.y + y), halfSpan * 2 + 1, 1);
  }
}

function drawHealth(ctx: CanvasRenderingContext2D, center: PixelPoint, ratio: number, width = 30, yOffset = HEX_HEIGHT * .48) {
  const left = Math.round(center.x - width / 2);
  const top = Math.round(center.y - yOffset);
  ctx.fillStyle = "#141d1a";
  ctx.fillRect(left, top, width, 4);
  ctx.fillStyle = ratio > .55 ? "#79b25e" : ratio > .25 ? "#d3a548" : "#d15a50";
  ctx.fillRect(left + 1, top + 1, Math.max(0, Math.round((width - 2) * ratio)), 2);
}

function industrialInfluence(state: GameState, hex: HexCoord) {
  return state.nodes.some((node) => hexDistance(node.anchor, hex) <= (node.boss ? 4 : 3));
}

function fillHexes(ctx: CanvasRenderingContext2D, hexes: readonly HexCoord[], color: string, scale = 1.055) {
  ctx.fillStyle = color;
  for (const hex of hexes) {
    tracePolygon(ctx, hexPolygon(hex, scale));
    ctx.fill();
  }
}

function groupMasks(hexes: readonly HexCoord[]) {
  const keys = new Set(hexes.map(hexKey));
  const masks = new Map<string, number>();
  for (const hex of hexes) {
    let mask = 0;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = hexNeighborFor(REWILD_HEX_LAYOUT, hex, direction);
      if (neighbor && keys.has(hexKey(neighbor))) mask |= 1 << direction;
    }
    masks.set(hexKey(hex), mask);
  }
  return masks;
}

function boundarySegments(hexes: readonly HexCoord[], masks: ReadonlyMap<string, number>): PixelSegment[] {
  const segments: PixelSegment[] = [];
  for (const hex of hexes) {
    const mask = masks.get(hexKey(hex)) ?? 0;
    const polygon = hexPolygon(hex, 1.028);
    for (let direction = 0; direction < 6; direction += 1) {
      if (mask & (1 << direction)) continue;
      const edgeIndex = DIRECTION_TO_POLYGON_EDGE[direction];
      segments.push({ from: polygon[edgeIndex], to: polygon[(edgeIndex + 1) % polygon.length] });
    }
  }
  return segments;
}

export function regionBoundarySegments(snapshot: RenderSnapshot, region: BiomeRegion) {
  return boundarySegments(region.cells, snapshot.regionNeighborMasks.get(region.id) ?? new Map());
}

function drawConnectedBiomeGround(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  for (const region of snapshot.state.world.biomes) {
    const color = region.kind === "water"
      ? PALETTE.water
      : region.kind === "forest"
        ? PALETTE.forest
        : region.kind === "rock"
          ? PALETTE.stone
          : PALETTE.meadowLight;
    fillHexes(ctx, region.cells, color, 1.06);
  }
}

function drawCompositionWash(ctx: CanvasRenderingContext2D, state: GameState) {
  const house = hexCenter(HOUSE_CENTER);
  ctx.globalAlpha = .12;
  drawPixelDisc(ctx, house, 92, PALETTE.meadowLight);
  ctx.globalAlpha = .07;
  drawPixelDisc(ctx, { x: house.x + 85, y: house.y - 36 }, 72, PALETTE.meadowLight);
  ctx.globalAlpha = 1;

  for (const node of state.nodes) {
    const center = hexCenter(node.anchor);
    ctx.globalAlpha = node.boss ? .18 : .11;
    drawPixelDisc(ctx, center, node.boss ? 86 : 64, PALETTE.industrialDark);
  }
  ctx.globalAlpha = 1;
}

function biomeKindByCell(state: GameState) {
  const kinds = new Map<string, string>();
  for (const region of state.world.biomes) {
    for (const hex of region.cells) kinds.set(hexKey(hex), region.kind);
  }
  return kinds;
}

function drawGround(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  const state = snapshot.state;
  ctx.fillStyle = PALETTE.outside;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  fillHexes(ctx, [...state.world.cells.values()].map((cell) => cell.hex), PALETTE.meadow, 1.04);
  drawCompositionWash(ctx, state);
  drawConnectedBiomeGround(ctx, snapshot);

  // Authored ground tiles are the actual ground here, drawn before any entity in the render
  // order (see renderOverheadGame) — units, plants, and enemies naturally paint on top of this
  // with no per-frame occupied/enemy exclusion needed, unlike the earlier overlay-pass attempt.
  const kinds = biomeKindByCell(state);
  const houseGround: HexCoord[] = [];
  for (const cell of state.world.cells.values()) {
    if (cell.surface === "house") houseGround.push(cell.hex);
    if (cell.surface === "water") {
      const exterior = hexNeighbors(cell.hex).filter((neighbor) => kinds.get(hexKey(neighbor)) !== "water").length;
      fillRewildTerrainPattern(ctx, exterior === 0 ? "water-deep" : "water-shallow", hexPath(cell.hex, 1.04), PALETTE.water, 1);
      continue;
    }
    if (cell.surface !== "meadow" || cell.corruption !== 0) continue;
    const kind = kinds.get(hexKey(cell.hex));
    if (kind === "forest") {
      fillRewildTerrainPattern(ctx, "forest-floor", hexPath(cell.hex, 1.04), PALETTE.forest, 1);
      continue;
    }
    const variant = GRASS_VARIANTS[Math.min(GRASS_VARIANTS.length - 1, Math.floor(cellRandom(cell, 301) * GRASS_VARIANTS.length))];
    fillRewildTerrainPattern(ctx, variant, hexPath(cell.hex, 1.04), PALETTE.meadow, 1);
  }
  fillHexes(ctx, houseGround, PALETTE.soil, 1.055);
}

function industrialTerritory(state: GameState) {
  return [...state.world.cells.values()]
    .filter((cell) => cell.surface !== "water" && industrialInfluence(state, cell.hex))
    .map((cell) => cell.hex);
}

function drawIndustrialGround(ctx: CanvasRenderingContext2D, state: GameState) {
  const territory = industrialTerritory(state);
  fillHexes(ctx, territory, PALETTE.industrial, 1.065);

  if (territory.length) {
    for (const edge of boundarySegments(territory, groupMasks(territory))) pixelLine(ctx, edge.from, edge.to, "rgba(90,99,100,.27)", 2, 1);
  }

  for (const hex of territory) {
    const cell = cellAt(state.world, hex);
    if (!cell) continue;
    const center = hexCenter(hex);
    if (cellRandom(cell, 170) > .72) {
      const y = Math.round(center.y - 7 + cellRandom(cell, 171) * 14);
      pixelLine(ctx, { x: center.x - 6, y }, { x: center.x + 6, y }, cellRandom(cell, 172) > .5 ? PALETTE.industrialLight : PALETTE.industrialRust, 1, 2);
    }
    if (cellRandom(cell, 173) > .86) {
      ctx.fillStyle = PALETTE.industrialRust;
      ctx.fillRect(Math.round(center.x - 7 + cellRandom(cell, 174) * 14), Math.round(center.y - 6 + cellRandom(cell, 175) * 12), 3, 2);
    }
  }

  for (const node of state.nodes) {
    fillHexes(ctx, node.footprint, PALETTE.industrialDark, 1.04);
    boundarySegments(node.footprint, groupMasks(node.footprint)).forEach((edge, index) => {
      pixelLine(ctx, edge.from, edge.to, index % 3 === 0 ? PALETTE.industrialRust : PALETTE.industrialLight, 1, 1);
    });
  }
}

function drawCorruptionGround(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const level of [1, 2, 3, 4] as const) {
    const cells = [...state.world.cells.values()].filter((cell) => cell.corruption === level && cell.surface !== "foundation").map((cell) => cell.hex);
    fillHexes(ctx, cells, CORRUPTION_PALETTE[level], 1.07);
  }
  const foundations = [...state.world.cells.values()].filter((cell) => cell.surface === "foundation").map((cell) => cell.hex);
  const rubble = [...state.world.cells.values()].filter((cell) => cell.surface === "rubble").map((cell) => cell.hex);
  fillHexes(ctx, foundations, PALETTE.industrialDark, 1.05);
  fillHexes(ctx, rubble, PALETTE.industrialDark, 1.06);
}

function drawCorruptionTransition(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const cell of state.world.cells.values()) {
    if (!cell.corruption || cell.surface === "foundation") continue;
    const color = CORRUPTION_PALETTE[cell.corruption];
    const center = hexCenter(cell.hex);
    ctx.globalAlpha = .42;
    for (let mark = 0; mark < 2; mark += 1) {
      const angle = cellRandom(cell, 180 + mark) * Math.PI * 2;
      const distance = 6 + cellRandom(cell, 184 + mark) * 10;
      drawPixelDisc(ctx, {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
      }, 3 + cellRandom(cell, 188 + mark) * 4, color);
    }
    ctx.globalAlpha = .58;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = hexNeighborFor(REWILD_HEX_LAYOUT, cell.hex, direction);
      if (!neighbor) continue;
      const neighborCell = cellAt(state.world, neighbor);
      if (!neighborCell || neighborCell.corruption >= cell.corruption) continue;
      const next = hexCenter(neighbor);
      drawPixelDisc(ctx, {
        x: center.x + (next.x - center.x) * .43,
        y: center.y + (next.y - center.y) * .43,
      }, 4 + cell.corruption, color);
    }
    ctx.globalAlpha = 1;
  }
}

// The water tile itself is drawn once, in drawGround, using real water-deep/water-shallow v4
// pixel art. This pass only draws the region's shoreline outline plus the overlay's own lily
// pads/reeds (drawWaterEdges in rewild-authored-overlay.ts) — it must not also place its own
// procedural fill or lily sprite, or the tile art gets buried under an old flat overlay.
function drawWater(ctx: CanvasRenderingContext2D, region: BiomeRegion, snapshot: RenderSnapshot) {
  regionBoundarySegments(snapshot, region).forEach((edge, index) => {
    pixelLine(ctx, edge.from, edge.to, PALETTE.waterDeep, 4, 1);
    if (index % 2 === 0) pixelLine(ctx, edge.from, edge.to, PALETTE.shore, 2, 2);
    const middle = { x: (edge.from.x + edge.to.x) / 2, y: (edge.from.y + edge.to.y) / 2 };
    if (index % 3 === 0) drawPixelDisc(ctx, middle, 2, PALETTE.shore);
  });
}

// Trees themselves are drawn once, by drawForestDensity in rewild-authored-overlay.ts (real v4
// art). This pass only draws the region's boundary outline — it must not also place tree
// sprites, or every forest cell gets two overlapping tree systems (the old v3 fallback showing
// through behind the new art).
function drawForest(ctx: CanvasRenderingContext2D, region: BiomeRegion, snapshot: RenderSnapshot) {
  regionBoundarySegments(snapshot, region).forEach((edge, index) => {
    if (index % 4 !== 1) pixelLine(ctx, edge.from, edge.to, PALETTE.forestEdge, 2, 2);
  });
}

function drawRegionDetails(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  const state = snapshot.state;
  for (const region of state.world.biomes) {
    if (region.kind === "water") drawWater(ctx, region, snapshot);
    else if (region.kind === "forest") drawForest(ctx, region, snapshot);
    else if (region.kind === "rock") {
      for (const hex of region.cells) {
        const cell = cellAt(state.world, hex);
        if (!cell || cellRandom(cell, 50) < .4) continue;
        const center = hexCenter(hex);
        drawRewildSprite(ctx, "rock", center.x, center.y, { scale: .5 + cellRandom(cell, 51) * .12, flipX: cellRandom(cell, 52) > .5 });
      }
    } else if (region.kind === "flowers") {
      for (const hex of region.cells) {
        const cell = cellAt(state.world, hex);
        if (!cell || cellRandom(cell, 60) < .34) continue;
        const center = hexCenter(hex);
        drawRewildSprite(ctx, "flower-cluster", center.x, center.y, { scale: .36 + cellRandom(cell, 61) * .1, alpha: .78, flipX: cellRandom(cell, 62) > .5 });
      }
    }
  }
}

function edgeJunctions(edges: readonly RenderEdge[]) {
  const points = new Map<string, HexCoord>();
  for (const edge of edges) {
    points.set(hexKey(edge.from), edge.from);
    points.set(hexKey(edge.to), edge.to);
  }
  return [...points.values()];
}

function drawRoad(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  snapshot.roadEdges.forEach((edge, index) => {
    const from = hexCenter(edge.from);
    const to = hexCenter(edge.to);
    pixelLine(ctx, from, to, PALETTE.roadDirt, 19, 1);
    pixelLine(ctx, from, to, PALETTE.roadEdge, 15, 1);
    pixelLine(ctx, from, to, PALETTE.road, 9, 1);
    if (index % 3 === 0) pixelLine(ctx, from, to, PALETTE.roadMark, 1, 6);
  });
  for (const hex of edgeJunctions(snapshot.roadEdges)) {
    const center = hexCenter(hex);
    drawPixelDisc(ctx, center, 9, PALETTE.roadDirt);
    drawPixelDisc(ctx, center, 7, PALETTE.roadEdge);
    drawPixelDisc(ctx, center, 4, PALETTE.road);
    const cell = cellAt(snapshot.state.world, hex);
    if (!cell) continue;
    if (hex.q < REWILD_HEX_LAYOUT.cols * .48 && cellRandom(cell, 200) > .76) {
      drawRewildSprite(ctx, "grass-tuft", center.x + (cellRandom(cell, 201) > .5 ? 8 : -8), center.y + 5, { scale: .19, alpha: .55 });
    } else if (hex.q > REWILD_HEX_LAYOUT.cols * .62 && cellRandom(cell, 202) > .8) {
      ctx.fillStyle = PALETTE.industrialRust;
      ctx.fillRect(Math.round(center.x + 7), Math.round(center.y - 5), 3, 2);
    }
  }
}

function drawMesh(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.lineWidth = 1;
  for (const cell of state.world.cells.values()) {
    const industrial = cell.surface === "foundation" || industrialInfluence(state, cell.hex);
    const placementNeighborhood = state.status === "playing" && hexDistance(cell.hex, state.cursor) <= 2;
    if (!industrial && !placementNeighborhood) continue;
    tracePolygon(ctx, hexPolygon(cell.hex, .995));
    ctx.strokeStyle = placementNeighborhood ? PALETTE.meshPlacement : PALETTE.meshIndustrial;
    ctx.stroke();
  }
}

function drawCableNetwork(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  for (const edge of snapshot.cableEdges) {
    const from = hexCenter(edge.from);
    const to = hexCenter(edge.to);
    pixelLine(ctx, from, to, PALETTE.cableDark, 5, 1);
    pixelLine(ctx, from, to, PALETTE.cable, 2, 1);
  }
  for (const hex of edgeJunctions(snapshot.cableEdges)) {
    const center = hexCenter(hex);
    drawPixelDisc(ctx, center, 3, PALETTE.cableDark);
    drawPixelDisc(ctx, center, 1, PALETTE.cable);
  }
}

function drawDatacenter(ctx: CanvasRenderingContext2D, node: DataNode) {
  const center = hexCenter(node.anchor);
  const ratio = Math.max(0, Math.min(1, node.hp / node.maxHp));
  ctx.globalAlpha = .36;
  drawPixelDisc(ctx, { x: center.x, y: center.y + 9 }, node.boss ? 25 : 19, PALETTE.industrialDark);
  ctx.globalAlpha = 1;
  drawRewildSprite(ctx, node.boss ? "mainframe" : "datacenter", center.x, center.y, {
    scale: 1.28,
    alpha: ratio < .25 ? .72 : 1,
  });
  drawHealth(ctx, center, ratio, node.boss ? 56 : 42, node.boss ? 37 : 30);
}

function houseCenter() {
  const centers = HOUSE_FOOTPRINT.map(hexCenter);
  return {
    x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
    y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
  };
}

function drawHouse(ctx: CanvasRenderingContext2D, state: GameState) {
  const center = houseCenter();
  const ratio = Math.max(0, Math.min(1, state.houseHp / 100));
  ctx.globalAlpha = .24;
  drawPixelDisc(ctx, { x: center.x, y: center.y + 11 }, 24, PALETTE.meadowDark);
  ctx.globalAlpha = 1;
  drawRewildSprite(ctx, ratio < .45 ? "house-damaged" : "house", center.x, center.y, { scale: .95 });
  drawHealth(ctx, center, ratio, 50, 34);
}

const OBJECT_SPRITES: Partial<Record<WorldObject["kind"], RewildPixelSpriteId>> = {
  tree: "tree-broadleaf",
  pine: "tree-pine",
  rock: "rock",
  shrub: "shrub",
  log: "log",
  fence: "fence",
  sign: "sign",
  ruin: "rock",
};

function objectScale(object: WorldObject) {
  if (object.kind === "tree" || object.kind === "pine") return .86;
  if (object.kind === "rock" || object.kind === "ruin") return .6;
  if (object.kind === "fence" || object.kind === "log") return .58;
  if (object.kind === "sign") return .52;
  return .54;
}

function overlapsNode(object: WorldObject, state: GameState) {
  return state.nodes.some((node) => node.footprint.some((hex) => object.footprint.some((cell) => cell.q === hex.q && cell.r === hex.r)));
}

function drawNatureObject(ctx: CanvasRenderingContext2D, object: WorldObject, state: GameState) {
  if (object.kind === "house" || object.kind === "pond" || object.kind === "flowers" || overlapsNode(object, state)) return;
  const sprite = OBJECT_SPRITES[object.kind];
  if (!sprite) return;
  const center = hexCenter(object.anchor);
  const corruption = cellAt(state.world, object.anchor)?.corruption ?? 0;
  if (object.shadow) {
    ctx.fillStyle = "rgba(20,29,26,.26)";
    ctx.fillRect(Math.round(center.x - 6), Math.round(center.y + HEX_SIZE * .22), 12, 2);
  }
  drawRewildSprite(ctx, sprite, center.x, center.y, {
    scale: objectScale(object),
    alpha: corruption >= 3 ? .56 : .96,
    rotation: object.rotation,
    flipX: object.id.length % 2 === 0,
  });
  if (corruption >= 3) drawRewildSprite(ctx, "corruption-node", center.x + 7, center.y + 5, { scale: .27, alpha: .72 });
}

function drawPlant(ctx: CanvasRenderingContext2D, plant: PlantEntity, state: GameState) {
  const center = hexCenter(plant);
  const disabled = plant.disabledUntil > state.elapsed;
  const mature = plant.kind === "elderoak" && plant.age >= 15;
  ctx.fillStyle = "rgba(20,29,26,.25)";
  ctx.fillRect(Math.round(center.x - 5), Math.round(center.y + 8), 10, 2);
  drawRewildSprite(ctx, spriteForPlant(plant.kind, mature), center.x, center.y, {
    scale: mature ? .98 : .82,
    alpha: disabled ? .48 : 1,
    flipX: plant.id % 2 === 0,
  });
  if (disabled) {
    ctx.strokeStyle = "rgba(229,123,190,.72)";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(center.x - 13), Math.round(center.y - 13), 26, 26);
  }
  if (plant.attackTarget && plant.attackUntil > state.elapsed) pixelLine(ctx, center, hexCenter(plant.attackTarget), "#e0e88b", 2, 1);
  if (plant.reclaimTarget && plant.reclaimUntil > state.elapsed) {
    const route = hexLine(plant, plant.reclaimTarget);
    for (let index = 1; index < route.length; index += 1) pixelLine(ctx, hexCenter(route[index - 1]), hexCenter(route[index]), "#89b75c", 3, 1);
  }
  drawHealth(ctx, center, plant.hp / PLANTS[plant.kind].maxHp, 30, 24);
}

function enemyScale(enemy: EnemyEntity) {
  if (enemy.kind === "deepfake") return .78;
  if (enemy.kind === "popup") return .7;
  if (enemy.kind === "fragment") return .5;
  return .62;
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity, state: GameState) {
  const center = enemy.position;
  ctx.fillStyle = "rgba(20,29,26,.2)";
  ctx.fillRect(Math.round(center.x - 4), Math.round(center.y + 7), 8, 2);
  drawRewildSprite(ctx, spriteForEnemy(enemy.kind), center.x, center.y, {
    scale: enemyScale(enemy),
    flipX: enemy.id % 2 === 0,
  });
  drawHealth(ctx, center, enemy.hp / enemy.maxHp, 26, 22);
  if (enemy.slowUntil > state.elapsed) {
    ctx.strokeStyle = "#77a7ba";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(center.x - 12), Math.round(center.y - 12), 24, 24);
  }
}

function drawRouteFeedback(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  for (const edge of snapshot.enemyRouteEdges) {
    pixelLine(ctx, hexCenter(edge.from), hexCenter(edge.to), "rgba(138,45,53,.045)", 2, 5);
  }
  for (const enemy of snapshot.state.enemies) {
    const next = enemy.path[0];
    if (next) pixelLine(ctx, enemy.position, hexCenter(next), "rgba(138,45,53,.085)", 2, 5);
  }
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: WorldEffect) {
  const progress = 1 - effect.life / effect.maxLife;
  const radius = 5 + progress * (effect.kind === "collapse" ? 24 : 15);
  const color = effect.kind === "reclaim" || effect.kind === "dilution" ? "#8ec66b" : effect.kind === "impact" ? "#e0bc55" : "#8c7056";
  for (let index = 0; index < 5; index += 1) {
    const angle = index * 1.256 + effect.seed * .13;
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(effect.position.x + Math.cos(angle) * radius),
      Math.round(effect.position.y + Math.sin(angle) * radius),
      3,
      3,
    );
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const beam of state.beams) pixelLine(ctx, beam.from, beam.to, beam.color, 2, 1);
  for (const effect of state.effects) drawEffect(ctx, effect);
}

function drawCorruptionMarks(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const cell of state.world.cells.values()) {
    if (cell.corruption < 2 || cell.surface === "foundation") continue;
    const center = hexCenter(cell.hex);
    const strength = cell.corruption;
    if (strength >= 4 && cellRandom(cell, 90) > .52) {
      drawRewildSprite(ctx, "corruption-node", center.x, center.y, { scale: .26 + cellRandom(cell, 91) * .08, alpha: .66 });
    } else {
      ctx.fillStyle = strength >= 3 ? "#6d506f" : "#6c6657";
      for (let mark = 0; mark < strength; mark += 1) {
        const x = Math.round(center.x - 10 + cellRandom(cell, 100 + mark) * 20);
        const y = Math.round(center.y - 6 + cellRandom(cell, 110 + mark) * 12);
        ctx.fillRect(x, y, strength >= 3 ? 3 : 2, 2);
      }
    }
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, state: GameState) {
  const valid = inspectHex(state, state.cursor).valid;
  tracePolygon(ctx, hexPolygon(state.cursor, .86));
  ctx.fillStyle = valid ? "rgba(242,232,137,.07)" : "rgba(223,89,79,.07)";
  ctx.fill();
  ctx.strokeStyle = valid ? PALETTE.placement : PALETTE.placementBad;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function renderOverheadGame(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot, camera: RewildCamera) {
  const state = snapshot.state;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  drawGround(ctx, snapshot);
  drawIndustrialGround(ctx, state);
  drawCorruptionGround(ctx, state);
  drawCorruptionTransition(ctx, state);
  drawRegionDetails(ctx, snapshot);
  drawRoad(ctx, snapshot);
  drawCorruptionMarks(ctx, state);
  drawMesh(ctx, state);
  drawMeadowLife(ctx, snapshot, biomeKindByCell(state));

  drawCableNetwork(ctx, snapshot);
  drawRouteFeedback(ctx, snapshot);
  for (const object of state.world.objects) drawNatureObject(ctx, object, state);
  drawHouse(ctx, state);
  for (const node of state.nodes) drawDatacenter(ctx, node);
  for (const plant of state.plants) drawPlant(ctx, plant, state);
  for (const enemy of state.enemies) drawEnemy(ctx, enemy, state);
  drawEffects(ctx, state);
  if (state.status === "playing") drawCursor(ctx, state);

  ctx.restore();
}
