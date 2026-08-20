import { hexNeighborFor } from "./rewild-hex-grid";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  HEX_HEIGHT,
  HEX_SIZE,
  HOUSE_FOOTPRINT,
  PLANTS,
  REWILD_HEX_LAYOUT,
  cellAt,
  hexCenter,
  hexDistance,
  hexKey,
  hexLine,
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
  spriteForEnemy,
  spriteForPlant,
  type RewildPixelSpriteId,
} from "./rewild-pixel-atlas";
import type { RenderEdge, RenderSnapshot } from "./rewild-render-snapshot";

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
  outside: "#17201d",
  meadowLight: "#7ea347",
  meadow: "#6f963e",
  meadowDark: "#557d36",
  forest: "#315d32",
  forestEdge: "#24492b",
  water: "#245f78",
  waterDark: "#173f57",
  waterLight: "#4d8c9b",
  stone: "#69736b",
  soil: "#8b6843",
  industrial: "#303739",
  industrialDark: "#1e2528",
  industrialLight: "#60696b",
  corruption1: "#6e6447",
  corruption2: "#5d504b",
  corruption3: "#433b44",
  corruption4: "#29262f",
  mesh: "rgba(25,44,33,.065)",
  meshIndustrial: "rgba(145,155,151,.09)",
  shore: "#94a65d",
  roadEdge: "#5e4b32",
  road: "#9d7b4c",
  roadMark: "#c4a867",
  cable: "#d4a038",
  cableDark: "#72582b",
  placement: "#f1e78b",
  placementBad: "#dd6d61",
};

const CORRUPTION_PALETTE: Record<1 | 2 | 3 | 4, string> = {
  1: PALETTE.corruption1,
  2: PALETTE.corruption2,
  3: PALETTE.corruption3,
  4: PALETTE.corruption4,
};

const DIRECTION_TO_POLYGON_EDGE = [0, 5, 4, 3, 2, 1] as const;

function tracePolygon(ctx: CanvasRenderingContext2D, points: PixelPoint[]) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(Math.round(points[index].x), Math.round(points[index].y));
  ctx.closePath();
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
  ctx.fillStyle = "#17201d";
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

function drawGround(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  const state = snapshot.state;
  ctx.fillStyle = PALETTE.outside;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  fillHexes(ctx, [...state.world.cells.values()].map((cell) => cell.hex), PALETTE.meadow, 1.04);
  drawConnectedBiomeGround(ctx, snapshot);

  const houseGround: HexCoord[] = [];
  for (const cell of state.world.cells.values()) {
    if (cell.surface === "house") houseGround.push(cell.hex);
    if (cell.surface !== "meadow" || cell.corruption !== 0 || cell.readability >= .5 || cell.detail <= .55) continue;
    if (snapshot.occupiedHexes.has(hexKey(cell.hex))) continue;
    const center = hexCenter(cell.hex);
    const light = cellRandom(cell, 2) > .57;
    ctx.fillStyle = light ? PALETTE.meadowLight : PALETTE.meadowDark;
    const x = Math.round(center.x - 8 + cellRandom(cell, 3) * 16);
    const y = Math.round(center.y - 5 + cellRandom(cell, 4) * 10);
    ctx.fillRect(x, y, light ? 3 : 2, 2);
  }
  fillHexes(ctx, houseGround, PALETTE.soil, 1.055);
}

function drawIndustrialGround(ctx: CanvasRenderingContext2D, state: GameState) {
  const territory = [...state.world.cells.values()]
    .filter((cell) => cell.surface !== "water" && industrialInfluence(state, cell.hex))
    .map((cell) => cell.hex);
  fillHexes(ctx, territory, PALETTE.industrial, 1.065);

  if (territory.length) {
    for (const edge of boundarySegments(territory, groupMasks(territory))) pixelLine(ctx, edge.from, edge.to, "rgba(96,105,107,.34)", 2, 1);
  }

  for (const node of state.nodes) {
    fillHexes(ctx, node.footprint, PALETTE.industrialDark, 1.035);
    for (const edge of boundarySegments(node.footprint, groupMasks(node.footprint))) pixelLine(ctx, edge.from, edge.to, PALETTE.industrialLight, 1, 1);
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

function drawWater(ctx: CanvasRenderingContext2D, region: BiomeRegion, snapshot: RenderSnapshot) {
  const state = snapshot.state;
  for (const hex of region.cells) {
    const cell = cellAt(state.world, hex);
    if (!cell) continue;
    const center = hexCenter(hex);
    if (cellRandom(cell, 30) > .38) {
      const y = Math.round(center.y + (cellRandom(cell, 31) - .5) * 10);
      pixelLine(ctx, { x: center.x - 8, y }, { x: center.x + 7, y }, PALETTE.waterLight, 1, 2);
    }
    if (cellRandom(cell, 32) > .84) drawRewildSprite(ctx, "water-lilies", center.x, center.y, { scale: .34, alpha: .8, flipX: cellRandom(cell, 33) > .5 });
  }
  for (const edge of regionBoundarySegments(snapshot, region)) {
    pixelLine(ctx, edge.from, edge.to, PALETTE.waterDark, 4, 1);
    pixelLine(ctx, edge.from, edge.to, PALETTE.shore, 2, 1);
  }
}

function drawForest(ctx: CanvasRenderingContext2D, region: BiomeRegion, snapshot: RenderSnapshot) {
  const state = snapshot.state;
  for (const hex of region.cells) {
    const cell = cellAt(state.world, hex);
    if (!cell || cellRandom(cell, 40) < .13) continue;
    const center = hexCenter(hex);
    const id: RewildPixelSpriteId = cellRandom(cell, 41) > .72 ? "tree-pine" : "tree-broadleaf";
    drawRewildSprite(ctx, id, center.x, center.y, {
      scale: .76 + cellRandom(cell, 42) * .2,
      alpha: cell.corruption >= 3 ? .58 : .96,
      flipX: cellRandom(cell, 43) > .5,
    });
  }
  for (const edge of regionBoundarySegments(snapshot, region)) pixelLine(ctx, edge.from, edge.to, PALETTE.forestEdge, 2, 1);
}

function drawRegionDetails(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  const state = snapshot.state;
  for (const region of state.world.biomes) {
    if (region.kind === "water") drawWater(ctx, region, snapshot);
    else if (region.kind === "forest") drawForest(ctx, region, snapshot);
    else if (region.kind === "rock") {
      for (const hex of region.cells) {
        const cell = cellAt(state.world, hex);
        if (!cell || cellRandom(cell, 50) < .34) continue;
        const center = hexCenter(hex);
        drawRewildSprite(ctx, "rock", center.x, center.y, { scale: .48 + cellRandom(cell, 51) * .12, flipX: cellRandom(cell, 52) > .5 });
      }
    } else if (region.kind === "flowers") {
      for (const hex of region.cells) {
        const cell = cellAt(state.world, hex);
        if (!cell || cellRandom(cell, 60) < .24) continue;
        const center = hexCenter(hex);
        drawRewildSprite(ctx, "flower-cluster", center.x, center.y, { scale: .4 + cellRandom(cell, 61) * .12, flipX: cellRandom(cell, 62) > .5 });
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
    pixelLine(ctx, from, to, PALETTE.roadEdge, 15, 1);
    pixelLine(ctx, from, to, PALETTE.road, 10, 1);
    if (index % 4 === 0) pixelLine(ctx, from, to, PALETTE.roadMark, 1, 6);
  });
  for (const hex of edgeJunctions(snapshot.roadEdges)) {
    const center = hexCenter(hex);
    drawPixelDisc(ctx, center, 7, PALETTE.roadEdge);
    drawPixelDisc(ctx, center, 5, PALETTE.road);
  }
}

function drawMesh(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.lineWidth = 1;
  for (const cell of state.world.cells.values()) {
    tracePolygon(ctx, hexPolygon(cell.hex, .995));
    ctx.strokeStyle = cell.surface === "foundation" || industrialInfluence(state, cell.hex) ? PALETTE.meshIndustrial : PALETTE.mesh;
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
  drawRewildSprite(ctx, node.boss ? "mainframe" : "datacenter", center.x, center.y, {
    scale: node.boss ? 1.42 : 1.12,
    alpha: ratio < .25 ? .72 : 1,
  });
  drawHealth(ctx, center, ratio, node.boss ? 52 : 38, node.boss ? 34 : 27);
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
  drawRewildSprite(ctx, ratio < .45 ? "house-damaged" : "house", center.x, center.y, { scale: 1.42 });
  drawHealth(ctx, center, ratio, 48, 31);
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
  if (object.kind === "tree" || object.kind === "pine") return .78;
  if (object.kind === "rock" || object.kind === "ruin") return .58;
  if (object.kind === "fence" || object.kind === "log") return .56;
  if (object.kind === "sign") return .5;
  return .52;
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
    ctx.fillStyle = "rgba(23,32,29,.28)";
    ctx.fillRect(Math.round(center.x - 5), Math.round(center.y + HEX_SIZE * .22), 10, 2);
  }
  drawRewildSprite(ctx, sprite, center.x, center.y, {
    scale: objectScale(object),
    alpha: corruption >= 3 ? .58 : .95,
    rotation: object.rotation,
    flipX: object.id.length % 2 === 0,
  });
  if (corruption >= 3) drawRewildSprite(ctx, "corruption-node", center.x + 7, center.y + 5, { scale: .27, alpha: .78 });
}

function drawPlant(ctx: CanvasRenderingContext2D, plant: PlantEntity, state: GameState) {
  const center = hexCenter(plant);
  const disabled = plant.disabledUntil > state.elapsed;
  const mature = plant.kind === "elderoak" && plant.age >= 15;
  ctx.fillStyle = "rgba(23,32,29,.25)";
  ctx.fillRect(Math.round(center.x - 4), Math.round(center.y + 7), 8, 2);
  drawRewildSprite(ctx, spriteForPlant(plant.kind, mature), center.x, center.y, {
    scale: mature ? .88 : .72,
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
  drawHealth(ctx, center, plant.hp / PLANTS[plant.kind].maxHp, 28, 22);
}

function enemyScale(enemy: EnemyEntity) {
  if (enemy.kind === "deepfake") return .72;
  if (enemy.kind === "popup") return .66;
  if (enemy.kind === "fragment") return .48;
  return .58;
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity, state: GameState) {
  const center = enemy.position;
  drawRewildSprite(ctx, spriteForEnemy(enemy.kind), center.x, center.y, {
    scale: enemyScale(enemy),
    flipX: enemy.id % 2 === 0,
  });
  drawHealth(ctx, center, enemy.hp / enemy.maxHp, 25, 21);
  if (enemy.slowUntil > state.elapsed) {
    ctx.strokeStyle = "#77a7ba";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(center.x - 12), Math.round(center.y - 12), 24, 24);
  }
}

function drawRouteFeedback(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot) {
  for (const edge of snapshot.enemyRouteEdges) {
    pixelLine(ctx, hexCenter(edge.from), hexCenter(edge.to), "rgba(138,45,53,.065)", 2, 5);
  }
  for (const enemy of snapshot.state.enemies) {
    const next = enemy.path[0];
    if (next) pixelLine(ctx, enemy.position, hexCenter(next), "rgba(138,45,53,.11)", 2, 5);
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
    if (strength >= 4 && cellRandom(cell, 90) > .45) {
      drawRewildSprite(ctx, "corruption-node", center.x, center.y, { scale: .28 + cellRandom(cell, 91) * .08, alpha: .72 });
    } else {
      ctx.fillStyle = strength >= 3 ? "#725178" : "#716957";
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
  ctx.fillStyle = valid ? "rgba(242,232,137,.08)" : "rgba(223,89,79,.08)";
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
  drawRoad(ctx, snapshot);
  drawRegionDetails(ctx, snapshot);
  drawCorruptionMarks(ctx, state);
  drawMesh(ctx, state);

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
