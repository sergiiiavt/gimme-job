import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  HEX_HEIGHT,
  HEX_SIZE,
  HOUSE_FOOTPRINT,
  PLANTS,
  biomeAt,
  cellAt,
  hexCenter,
  hexDistance,
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

export interface RewildCamera {
  x: number;
  y: number;
  zoom: number;
}

const PALETTE = {
  outside: "#17201d",
  meadowLight: "#7ea347",
  meadow: "#6f963e",
  meadowDark: "#557d36",
  forest: "#315d32",
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
  mesh: "rgba(25,44,33,.13)",
  meshIndustrial: "rgba(145,155,151,.20)",
  shore: "#94a65d",
  roadEdge: "#5e4b32",
  road: "#9d7b4c",
  roadMark: "#c4a867",
  cable: "#d4a038",
  cableDark: "#72582b",
  placement: "#f1e78b",
  placementBad: "#dd6d61",
};

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

function materialForCell(state: GameState, cell: HexCell) {
  if (cell.surface === "water") return PALETTE.water;
  if (cell.surface === "house") return PALETTE.soil;
  if (cell.surface === "foundation") return cell.corruption >= 3 ? PALETTE.corruption4 : PALETTE.industrial;
  if (cell.surface === "rubble") return PALETTE.industrialDark;
  if (cell.corruption === 4) return PALETTE.corruption4;
  if (cell.corruption === 3) return PALETTE.corruption3;
  if (cell.corruption === 2) return PALETTE.corruption2;
  if (cell.corruption === 1) return PALETTE.corruption1;
  const biome = biomeAt(state.world, cell.hex)?.kind;
  if (biome === "forest") return PALETTE.forest;
  if (biome === "rock") return PALETTE.stone;
  if (biome === "flowers") return PALETTE.meadowLight;
  if (industrialInfluence(state, cell.hex)) return PALETTE.industrial;
  const value = cellRandom(cell, 2);
  return value > .74 ? PALETTE.meadowLight : value < .18 ? PALETTE.meadowDark : PALETTE.meadow;
}

function drawGround(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = PALETTE.outside;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (const cell of state.world.cells.values()) {
    tracePolygon(ctx, hexPolygon(cell.hex, 1.018));
    ctx.fillStyle = materialForCell(state, cell);
    ctx.fill();

    if (cell.surface === "meadow" && cell.corruption === 0 && cell.readability < .5 && cell.detail > .55 && !biomeAt(state.world, cell.hex)) {
      const center = hexCenter(cell.hex);
      drawRewildSprite(ctx, cellRandom(cell, 19) > .78 ? "flower-cluster" : "grass-tuft", center.x, center.y, {
        scale: cellRandom(cell, 20) > .65 ? .35 : .28,
        alpha: .72,
        flipX: cellRandom(cell, 21) > .5,
      });
    }
  }
}

function edgeKey(from: PixelPoint, to: PixelPoint) {
  const a = `${Math.round(from.x * 10)},${Math.round(from.y * 10)}`;
  const b = `${Math.round(to.x * 10)},${Math.round(to.y * 10)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function boundaryEdges(region: BiomeRegion) {
  const edges = new Map<string, { from: PixelPoint; to: PixelPoint; count: number }>();
  for (const hex of region.cells) {
    const polygon = hexPolygon(hex, 1.018);
    for (let index = 0; index < polygon.length; index += 1) {
      const from = polygon[index];
      const to = polygon[(index + 1) % polygon.length];
      const key = edgeKey(from, to);
      const existing = edges.get(key);
      if (existing) existing.count += 1;
      else edges.set(key, { from, to, count: 1 });
    }
  }
  return [...edges.values()].filter((edge) => edge.count === 1);
}

function drawWater(ctx: CanvasRenderingContext2D, region: BiomeRegion, state: GameState) {
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
  for (const edge of boundaryEdges(region)) pixelLine(ctx, edge.from, edge.to, PALETTE.shore, 3, 1);
}

function drawForest(ctx: CanvasRenderingContext2D, region: BiomeRegion, state: GameState) {
  for (const hex of region.cells) {
    const cell = cellAt(state.world, hex);
    if (!cell || cellRandom(cell, 40) < .22) continue;
    const center = hexCenter(hex);
    const id: RewildPixelSpriteId = cellRandom(cell, 41) > .72 ? "tree-pine" : "tree-broadleaf";
    drawRewildSprite(ctx, id, center.x, center.y, {
      scale: .68 + cellRandom(cell, 42) * .18,
      alpha: cell.corruption >= 3 ? .58 : .96,
      flipX: cellRandom(cell, 43) > .5,
    });
  }
  for (const edge of boundaryEdges(region)) pixelLine(ctx, edge.from, edge.to, "rgba(28,65,38,.72)", 2, 1);
}

function drawRegionDetails(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const region of state.world.biomes) {
    if (region.kind === "water") drawWater(ctx, region, state);
    else if (region.kind === "forest") drawForest(ctx, region, state);
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

function drawRoad(ctx: CanvasRenderingContext2D, state: GameState) {
  const cells = state.world.road.cells;
  for (let index = 1; index < cells.length; index += 1) {
    if (hexDistance(cells[index - 1], cells[index]) !== 1) continue;
    const from = hexCenter(cells[index - 1]);
    const to = hexCenter(cells[index]);
    pixelLine(ctx, from, to, PALETTE.roadEdge, 15, 1);
    pixelLine(ctx, from, to, PALETTE.road, 10, 1);
    if (index % 4 === 0) pixelLine(ctx, from, to, PALETTE.roadMark, 1, 6);
  }
}

function drawIndustrialGround(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const node of state.nodes) {
    for (const hex of node.footprint) {
      tracePolygon(ctx, hexPolygon(hex, .95));
      ctx.fillStyle = PALETTE.industrialDark;
      ctx.fill();
      ctx.strokeStyle = PALETTE.industrialLight;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawMesh(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.lineWidth = 1;
  for (const cell of state.world.cells.values()) {
    tracePolygon(ctx, hexPolygon(cell.hex, .986));
    ctx.strokeStyle = cell.surface === "foundation" || industrialInfluence(state, cell.hex) ? PALETTE.meshIndustrial : PALETTE.mesh;
    ctx.stroke();
  }
}

function drawCablePath(ctx: CanvasRenderingContext2D, node: DataNode) {
  const route = hexLine(node.anchor, node.outlet);
  for (let index = 1; index < route.length; index += 1) {
    const from = hexCenter(route[index - 1]);
    const to = hexCenter(route[index]);
    pixelLine(ctx, from, to, PALETTE.cableDark, 5, 1);
    pixelLine(ctx, from, to, PALETTE.cable, 2, 1);
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
  const bob = Math.round(Math.sin((state.elapsed + enemy.id * .31) * 5) * 1.2);
  const center = { x: enemy.position.x, y: enemy.position.y + bob };
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

function drawRouteFeedback(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const enemy of state.enemies) {
    if (!enemy.path.length) continue;
    let previous = enemy.position;
    for (let index = 0; index < Math.min(enemy.path.length, 6); index += 1) {
      const next = hexCenter(enemy.path[index]);
      pixelLine(ctx, previous, next, "rgba(138,45,53,.13)", 2, 5);
      previous = next;
    }
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

export function renderOverheadGame(ctx: CanvasRenderingContext2D, state: GameState, camera: RewildCamera) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  drawGround(ctx, state);
  drawRoad(ctx, state);
  drawIndustrialGround(ctx, state);
  drawRegionDetails(ctx, state);
  drawCorruptionMarks(ctx, state);
  drawMesh(ctx, state);

  for (const node of state.nodes) drawCablePath(ctx, node);
  drawRouteFeedback(ctx, state);
  for (const object of state.world.objects) drawNatureObject(ctx, object, state);
  drawHouse(ctx, state);
  for (const node of state.nodes) drawDatacenter(ctx, node);
  for (const plant of state.plants) drawPlant(ctx, plant, state);
  for (const enemy of state.enemies) drawEnemy(ctx, enemy, state);
  drawEffects(ctx, state);
  if (state.status === "playing") drawCursor(ctx, state);

  ctx.restore();
}
