import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ENEMIES,
  HEX_HEIGHT,
  HEX_SIZE,
  HOUSE_CENTER,
  HOUSE_FOOTPRINT,
  PLANTS,
  biomeAt,
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
  type PlantKind,
  type WorldEffect,
  type WorldObject,
} from "./rewild-hex-world";

export interface RewildCamera {
  x: number;
  y: number;
  zoom: number;
}

const PALETTE = {
  outside: "#18231f",
  meadowLight: "#7fa543",
  meadow: "#6f963c",
  meadowDark: "#557d35",
  forest: "#315d31",
  forestDark: "#1b422d",
  forestLight: "#4f7d36",
  water: "#225d77",
  waterDark: "#163f5c",
  waterLight: "#3f8090",
  stone: "#667066",
  soil: "#8a633d",
  soilDark: "#5d432f",
  industrial: "#30383b",
  industrialDark: "#1d2428",
  industrialLight: "#566066",
  corruption1: "#68643d",
  corruption2: "#5a4b3d",
  corruption3: "#3b3539",
  corruption4: "#25242b",
  mesh: "rgba(26,48,35,.28)",
  meshIndustrial: "rgba(119,132,132,.22)",
  shore: "#8b9f54",
  roadEdge: "#5f4b31",
  road: "#9b7745",
  roadMark: "#c5a561",
  cable: "#d49a2e",
  cableDark: "#6d5525",
  danger: "#df594f",
  placement: "#f2e889",
  placementBad: "#df6d61",
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

function pixelDisc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  const integerRadius = Math.max(1, Math.round(radius));
  for (let row = -integerRadius; row <= integerRadius; row += 2) {
    const half = Math.floor(Math.sqrt(Math.max(0, integerRadius * integerRadius - row * row)));
    ctx.fillRect(Math.round(x - half), Math.round(y + row), half * 2 + 1, 2);
  }
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

function drawHealth(ctx: CanvasRenderingContext2D, center: PixelPoint, ratio: number, width = 30) {
  const left = Math.round(center.x - width / 2);
  const top = Math.round(center.y - HEX_HEIGHT * .48);
  ctx.fillStyle = "#17201d";
  ctx.fillRect(left, top, width, 4);
  ctx.fillStyle = ratio > .55 ? "#7cb65f" : ratio > .25 ? "#d2a547" : "#d05b4f";
  ctx.fillRect(left + 1, top + 1, Math.max(0, Math.round((width - 2) * ratio)), 2);
}

function industrialInfluence(state: GameState, hex: HexCoord) {
  return state.nodes.some((node) => hexDistance(node.anchor, hex) <= (node.boss ? 4 : 3))
    || state.ruins.some((ruin) => hexDistance(ruin.anchor, hex) <= (ruin.boss ? 4 : 3));
}

function materialForCell(state: GameState, cell: HexCell) {
  if (cell.surface === "water") return PALETTE.water;
  if (cell.surface === "house") return PALETTE.soil;
  if (cell.surface === "foundation") return cell.corruption >= 3 ? PALETTE.corruption4 : PALETTE.industrial;
  if (cell.surface === "rubble") return cell.corruption >= 3 ? PALETTE.corruption4 : PALETTE.industrialDark;
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
  return value > .72 ? PALETTE.meadowLight : value < .2 ? PALETTE.meadowDark : PALETTE.meadow;
}

function drawGround(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = PALETTE.outside;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (const cell of state.world.cells.values()) {
    tracePolygon(ctx, hexPolygon(cell.hex, 1.015));
    ctx.fillStyle = materialForCell(state, cell);
    ctx.fill();

    if (cell.surface !== "water" && cell.surface !== "foundation" && cell.surface !== "rubble" && cell.corruption < 2 && cell.readability < .58 && cell.detail > .35) {
      const center = hexCenter(cell.hex);
      const x = Math.round(center.x + (cellRandom(cell, 12) - .5) * HEX_SIZE * .9);
      const y = Math.round(center.y + (cellRandom(cell, 13) - .5) * HEX_HEIGHT * .55);
      ctx.fillStyle = cellRandom(cell, 14) > .5 ? "#486e31" : "#91aa48";
      ctx.fillRect(x, y, 2, 2);
      if (cell.detail > .72) ctx.fillRect(x + 4, y - 3, 1, 2);
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
    const polygon = hexPolygon(hex, 1.015);
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
    if (cellRandom(cell, 30) > .44) {
      const y = Math.round(center.y + (cellRandom(cell, 31) - .5) * 11);
      pixelLine(ctx, { x: center.x - 8, y }, { x: center.x + 7, y }, PALETTE.waterLight, 1, 2);
    }
  }
  for (const edge of boundaryEdges(region)) pixelLine(ctx, edge.from, edge.to, PALETTE.shore, 4, 1);
}

function drawForest(ctx: CanvasRenderingContext2D, region: BiomeRegion, state: GameState) {
  for (const hex of region.cells) {
    const cell = cellAt(state.world, hex);
    if (!cell) continue;
    const center = hexCenter(hex);
    const size = 12 + Math.round(cellRandom(cell, 40) * 5);
    pixelDisc(ctx, center.x - 7 + cellRandom(cell, 41) * 5, center.y + 2, size, PALETTE.forestDark);
    pixelDisc(ctx, center.x + 7, center.y - 3 - cellRandom(cell, 42) * 3, size - 2, PALETTE.forestLight);
    if (cellRandom(cell, 43) > .42) pixelDisc(ctx, center.x, center.y - 7, size - 4, "#3b7034");
  }
  for (const edge of boundaryEdges(region)) pixelLine(ctx, edge.from, edge.to, "#23492b", 2, 1);
}

function drawRegionDetails(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const region of state.world.biomes) {
    if (region.kind === "water") drawWater(ctx, region, state);
    else if (region.kind === "forest") drawForest(ctx, region, state);
    else if (region.kind === "rock") {
      for (const hex of region.cells) {
        const cell = cellAt(state.world, hex);
        if (!cell || cellRandom(cell, 50) < .38) continue;
        const center = hexCenter(hex);
        ctx.fillStyle = "#4a514c";
        ctx.fillRect(Math.round(center.x - 8), Math.round(center.y - 5), 15, 10);
        ctx.fillStyle = "#8a8f78";
        ctx.fillRect(Math.round(center.x - 5), Math.round(center.y - 7), 9, 5);
      }
    } else if (region.kind === "flowers") {
      for (const hex of region.cells) {
        const cell = cellAt(state.world, hex);
        if (!cell) continue;
        const center = hexCenter(hex);
        for (let dot = 0; dot < 4; dot += 1) {
          const x = Math.round(center.x - 13 + cellRandom(cell, 60 + dot) * 26);
          const y = Math.round(center.y - 9 + cellRandom(cell, 70 + dot) * 18);
          ctx.fillStyle = dot % 2 ? "#e3c94f" : "#d9d7a0";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, state: GameState) {
  const cells = state.world.road.cells;
  for (let index = 1; index < cells.length; index += 1) {
    const from = hexCenter(cells[index - 1]);
    const to = hexCenter(cells[index]);
    if (hexDistance(cells[index - 1], cells[index]) !== 1) continue;
    pixelLine(ctx, from, to, PALETTE.roadEdge, 16, 1);
    pixelLine(ctx, from, to, PALETTE.road, 11, 1);
    if (index % 3 === 0) pixelLine(ctx, from, to, PALETTE.roadMark, 2, 6);
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
  for (const ruin of state.ruins) {
    for (const hex of ruin.footprint) {
      const cell = cellAt(state.world, hex);
      if (!cell || cell.surface !== "rubble") continue;
      const center = hexCenter(hex);
      ctx.fillStyle = "#343231";
      ctx.fillRect(Math.round(center.x - 11), Math.round(center.y - 7), 9, 5);
      ctx.fillStyle = "#6d6257";
      ctx.fillRect(Math.round(center.x + 2), Math.round(center.y + 2), 8, 4);
    }
  }
}

function drawMesh(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.lineWidth = 1;
  for (const cell of state.world.cells.values()) {
    tracePolygon(ctx, hexPolygon(cell.hex, .985));
    ctx.strokeStyle = cell.surface === "foundation" || industrialInfluence(state, cell.hex) ? PALETTE.meshIndustrial : PALETTE.mesh;
    ctx.stroke();
  }
}

function drawCablePath(ctx: CanvasRenderingContext2D, state: GameState, node: DataNode) {
  const route = hexLine(node.anchor, node.outlet);
  for (let index = 1; index < route.length; index += 1) {
    const from = hexCenter(route[index - 1]);
    const to = hexCenter(route[index]);
    pixelLine(ctx, from, to, PALETTE.cableDark, 5, 1);
    pixelLine(ctx, from, to, PALETTE.cable, 2, 1);
  }
  const outlet = hexCenter(node.outlet);
  pixelDisc(ctx, outlet.x, outlet.y, 4, PALETTE.cable);
}

function drawDatacenter(ctx: CanvasRenderingContext2D, node: DataNode) {
  const center = hexCenter(node.anchor);
  const scale = node.boss ? 1.3 : 1;
  const damage = Math.max(0, Math.min(1, node.hp / node.maxHp));
  const body = damage < .35 ? "#292c2d" : "#434b4f";

  ctx.fillStyle = "#151a1d";
  ctx.fillRect(Math.round(center.x - 29 * scale), Math.round(center.y - 20 * scale), Math.round(58 * scale), Math.round(40 * scale));
  ctx.fillStyle = body;
  ctx.fillRect(Math.round(center.x - 25 * scale), Math.round(center.y - 17 * scale), Math.round(31 * scale), Math.round(31 * scale));
  ctx.fillStyle = "#687177";
  for (let rack = 0; rack < 3; rack += 1) ctx.fillRect(Math.round(center.x - 21 * scale + rack * 9 * scale), Math.round(center.y - 13 * scale), Math.max(3, Math.round(5 * scale)), Math.round(23 * scale));

  ctx.fillStyle = "#2b3236";
  ctx.fillRect(Math.round(center.x + 8 * scale), Math.round(center.y - 17 * scale), Math.round(16 * scale), Math.round(31 * scale));
  for (let fan = 0; fan < 2; fan += 1) {
    pixelDisc(ctx, center.x + 16 * scale, center.y - 9 * scale + fan * 17 * scale, 6 * scale, "#171c1f");
    pixelDisc(ctx, center.x + 16 * scale, center.y - 9 * scale + fan * 17 * scale, 2 * scale, "#737b7e");
  }

  ctx.fillStyle = damage < .35 ? "#6c4d28" : "#d49a2e";
  ctx.fillRect(Math.round(center.x - 23 * scale), Math.round(center.y + 10 * scale), Math.round(45 * scale), Math.max(2, Math.round(3 * scale)));
  if (node.boss) {
    ctx.fillStyle = "#22282b";
    ctx.fillRect(Math.round(center.x - 18 * scale), Math.round(center.y - 29 * scale), Math.round(36 * scale), Math.round(8 * scale));
  }
  drawHealth(ctx, { x: center.x, y: center.y - 4 * scale }, damage, node.boss ? 48 : 36);
}

function drawHouse(ctx: CanvasRenderingContext2D, state: GameState) {
  const centers = HOUSE_FOOTPRINT.map(hexCenter);
  const center = {
    x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
    y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
  };
  const ratio = Math.max(0, Math.min(1, state.houseHp / 100));
  ctx.fillStyle = PALETTE.soilDark;
  ctx.fillRect(Math.round(center.x - 31), Math.round(center.y - 23), 62, 46);
  ctx.fillStyle = ratio < .35 ? "#653a31" : "#8f4d37";
  ctx.fillRect(Math.round(center.x - 27), Math.round(center.y - 19), 54, 38);
  ctx.fillStyle = "#b56b42";
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 6; col += 1) if ((row + col) % 2 === 0) ctx.fillRect(Math.round(center.x - 24 + col * 8), Math.round(center.y - 16 + row * 8), 6, 5);
  ctx.fillStyle = "#252a29";
  ctx.fillRect(Math.round(center.x + 8), Math.round(center.y - 9), 10, 10);
  ctx.fillStyle = "#cbc29b";
  ctx.fillRect(Math.round(center.x + 10), Math.round(center.y - 7), 6, 6);
  drawHealth(ctx, { x: center.x, y: center.y - 6 }, ratio, 48);
}

function drawNatureObject(ctx: CanvasRenderingContext2D, object: WorldObject, state: GameState) {
  if (object.kind === "house" || object.kind === "pond" || object.kind === "flowers") return;
  if (state.nodes.some((node) => node.footprint.some((hex) => object.footprint.some((cell) => cell.q === hex.q && cell.r === hex.r)))) return;
  const center = hexCenter(object.anchor);
  const cell = cellAt(state.world, object.anchor);
  const stress = cell?.corruption ?? 0;
  if (object.kind === "tree" || object.kind === "pine") {
    const dark = stress >= 3 ? "#3b3831" : PALETTE.forestDark;
    const light = stress >= 2 ? "#68713a" : PALETTE.forestLight;
    pixelDisc(ctx, center.x - 7, center.y + 2, 14, dark);
    pixelDisc(ctx, center.x + 7, center.y, 13, light);
    pixelDisc(ctx, center.x, center.y - 7, 12, stress >= 3 ? "#55513c" : "#3e7134");
    ctx.fillStyle = stress >= 3 ? "#544638" : "#6f4f32";
    ctx.fillRect(Math.round(center.x - 2), Math.round(center.y + 7), 4, 8);
  } else if (object.kind === "rock" || object.kind === "ruin") {
    ctx.fillStyle = object.kind === "ruin" ? "#4b4844" : "#555f57";
    ctx.fillRect(Math.round(center.x - 11), Math.round(center.y - 7), 19, 12);
    ctx.fillStyle = "#858777";
    ctx.fillRect(Math.round(center.x - 7), Math.round(center.y - 9), 11, 5);
  } else if (object.kind === "shrub") {
    pixelDisc(ctx, center.x - 5, center.y, 7, "#2c5c30");
    pixelDisc(ctx, center.x + 5, center.y + 1, 6, "#4a7836");
  } else if (object.kind === "log") {
    pixelLine(ctx, { x: center.x - 12, y: center.y + 5 }, { x: center.x + 12, y: center.y - 5 }, "#62472f", 6, 1);
  } else if (object.kind === "fence") {
    pixelLine(ctx, { x: center.x - 15, y: center.y }, { x: center.x + 15, y: center.y }, "#715338", 3, 1);
    ctx.fillStyle = "#8b6742";
    ctx.fillRect(Math.round(center.x - 12), Math.round(center.y - 5), 3, 10);
    ctx.fillRect(Math.round(center.x + 9), Math.round(center.y - 5), 3, 10);
  } else if (object.kind === "sign") {
    ctx.fillStyle = "#76523a";
    ctx.fillRect(Math.round(center.x - 1), Math.round(center.y - 1), 3, 11);
    ctx.fillStyle = "#9a7049";
    ctx.fillRect(Math.round(center.x - 7), Math.round(center.y - 7), 14, 7);
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, plant: PlantEntity, state: GameState) {
  const center = hexCenter(plant);
  const disabled = plant.disabledUntil > state.elapsed;
  if (plant.kind === "sunbloom") {
    for (let petal = 0; petal < 8; petal += 1) {
      const angle = petal * Math.PI / 4;
      pixelDisc(ctx, center.x + Math.cos(angle) * 8, center.y + Math.sin(angle) * 8, 4, disabled ? "#817a4a" : petal % 2 ? "#e0a637" : "#f1c94a");
    }
    pixelDisc(ctx, center.x, center.y, 6, "#5d432c");
  } else if (plant.kind === "thornbramble") {
    pixelDisc(ctx, center.x, center.y, 14, disabled ? "#414940" : "#21462e");
    for (let arm = 0; arm < 6; arm += 1) {
      const angle = arm * Math.PI / 3;
      pixelLine(ctx, center, { x: center.x + Math.cos(angle) * 15, y: center.y + Math.sin(angle) * 12 }, "#5d7d36", 3, 1);
    }
  } else if (plant.kind === "sporecap") {
    pixelDisc(ctx, center.x - 6, center.y + 4, 7, disabled ? "#55505b" : "#704895");
    pixelDisc(ctx, center.x + 6, center.y + 3, 8, disabled ? "#5b5361" : "#9357b7");
    pixelDisc(ctx, center.x, center.y - 5, 9, disabled ? "#595360" : "#5e3b8b");
  } else if (plant.kind === "vinewhip") {
    for (let arm = 0; arm < 6; arm += 1) {
      const angle = arm * Math.PI / 3 + .18;
      pixelLine(ctx, center, { x: center.x + Math.cos(angle) * 17, y: center.y + Math.sin(angle) * 13 }, disabled ? "#4c5548" : "#5b9138", 3, 1);
      pixelDisc(ctx, center.x + Math.cos(angle) * 16, center.y + Math.sin(angle) * 12, 2, "#7dae46");
    }
    pixelDisc(ctx, center.x, center.y, 6, "#284c2d");
  } else if (plant.kind === "rootreclaimer") {
    for (let root = 0; root < 6; root += 1) {
      const angle = root * Math.PI / 3;
      pixelLine(ctx, center, { x: center.x + Math.cos(angle) * 17, y: center.y + Math.sin(angle) * 12 }, "#73583a", 2, 1);
    }
    pixelDisc(ctx, center.x, center.y, 8, disabled ? "#4f554d" : "#4f7b38");
    pixelDisc(ctx, center.x - 5, center.y - 5, 5, "#8ab64e");
  } else {
    pixelDisc(ctx, center.x, center.y, plant.age >= 15 ? 16 : 12, disabled ? "#4d544d" : "#285132");
    pixelDisc(ctx, center.x - 6, center.y - 4, plant.age >= 15 ? 11 : 8, "#4d7e38");
    pixelDisc(ctx, center.x + 6, center.y - 3, plant.age >= 15 ? 10 : 7, "#638f3d");
  }
  if (plant.attackTarget && plant.attackUntil > state.elapsed) pixelLine(ctx, center, hexCenter(plant.attackTarget), "#dce783", 2, 1);
  if (plant.reclaimTarget && plant.reclaimUntil > state.elapsed) {
    const route = hexLine(plant, plant.reclaimTarget);
    for (let index = 1; index < route.length; index += 1) pixelLine(ctx, hexCenter(route[index - 1]), hexCenter(route[index]), "#89b75c", 3, 1);
  }
  drawHealth(ctx, center, plant.hp / PLANTS[plant.kind].maxHp, 28);
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity, state: GameState) {
  const center = enemy.position;
  if (enemy.kind === "clickbait") {
    for (const [x, y] of [[-7, -5], [7, -4], [0, 7]]) pixelDisc(ctx, center.x + x, center.y + y, 5, "#a9bc3d");
  } else if (enemy.kind === "deepfake") {
    pixelDisc(ctx, center.x - 5, center.y + 2, 12, "#384a82");
    pixelDisc(ctx, center.x + 7, center.y + 4, 9, "#574d97");
    pixelDisc(ctx, center.x + 1, center.y - 6, 9, "#5965a6");
  } else if (enemy.kind === "popup") {
    ctx.fillStyle = "#1b2027";
    ctx.fillRect(Math.round(center.x - 11), Math.round(center.y - 11), 22, 22);
    ctx.fillStyle = "#cd4ba1";
    ctx.fillRect(Math.round(center.x - 9), Math.round(center.y - 9), 18, 3);
    ctx.fillStyle = "#8d3e9b";
    ctx.fillRect(Math.round(center.x - 6), Math.round(center.y), 12, 6);
  } else {
    ctx.fillStyle = "#765b91";
    ctx.fillRect(Math.round(center.x - 7), Math.round(center.y - 5), 9, 9);
    ctx.fillStyle = "#b163a4";
    ctx.fillRect(Math.round(center.x + 2), Math.round(center.y + 1), 7, 7);
  }
  if (enemy.path.length > 0) {
    const next = hexCenter(enemy.path[0]);
    pixelLine(ctx, center, next, "rgba(223,89,79,.34)", 1, 3);
  }
  drawHealth(ctx, { x: center.x, y: center.y }, enemy.hp / enemy.maxHp, 25);
  if (enemy.slowUntil > state.elapsed) {
    ctx.strokeStyle = "#78a7bd";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(center.x - 13), Math.round(center.y - 13), 26, 26);
  }
}

function drawRouteFeedback(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const enemy of state.enemies) {
    if (!enemy.path.length) continue;
    let previous = enemy.position;
    for (let index = 0; index < Math.min(enemy.path.length, 7); index += 1) {
      const next = hexCenter(enemy.path[index]);
      pixelLine(ctx, previous, next, "rgba(143,37,44,.18)", 2, 5);
      previous = next;
    }
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const beam of state.beams) pixelLine(ctx, beam.from, beam.to, beam.color, 2, 1);
  for (const effect of state.effects) drawEffect(ctx, effect);
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: WorldEffect) {
  const progress = 1 - effect.life / effect.maxLife;
  const radius = 5 + progress * (effect.kind === "collapse" ? 24 : 15);
  const color = effect.kind === "reclaim" || effect.kind === "dilution" ? "#8ec66b" : effect.kind === "impact" ? "#e0bc55" : "#8c7056";
  for (let index = 0; index < 5; index += 1) {
    const angle = index * 1.256 + effect.seed * .13;
    const x = effect.position.x + Math.cos(angle) * radius;
    const y = effect.position.y + Math.sin(angle) * radius;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, state: GameState) {
  const valid = inspectHex(state, state.cursor).valid;
  tracePolygon(ctx, hexPolygon(state.cursor, .86));
  ctx.fillStyle = valid ? "rgba(242,232,137,.10)" : "rgba(223,89,79,.10)";
  ctx.fill();
  ctx.strokeStyle = valid ? PALETTE.placement : PALETTE.placementBad;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCorruptionMarks(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const cell of state.world.cells.values()) {
    if (cell.corruption < 2 || cell.surface === "foundation") continue;
    const center = hexCenter(cell.hex);
    const strength = cell.corruption;
    ctx.fillStyle = strength >= 4 ? "#6d4c79" : "#6b6253";
    for (let mark = 0; mark < strength; mark += 1) {
      const x = Math.round(center.x - 11 + cellRandom(cell, 90 + mark) * 22);
      const y = Math.round(center.y - 7 + cellRandom(cell, 100 + mark) * 14);
      ctx.fillRect(x, y, strength >= 4 ? 4 : 3, 2);
    }
  }
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

  for (const node of state.nodes) drawCablePath(ctx, state, node);
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
