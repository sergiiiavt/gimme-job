import {
  hexCenterFor,
  hexPolygonFor,
  type HexCoord,
  type HexLayout,
  type PixelPoint,
} from "./rewild-hex-grid";
import type {
  TacticalCellState,
  TacticalEdgeState,
  TacticalEntity,
  TacticalWorldState,
} from "./rewild-tactical-world";

export interface TacticalRenderPalette {
  meadow: readonly [string, string, string, string];
  forest: readonly [string, string, string, string];
  water: readonly [string, string, string, string];
  industry: readonly [string, string, string, string];
  contested: readonly [string, string, string, string];
  gridNature: string;
  gridIndustry: string;
}

const PALETTE: TacticalRenderPalette = {
  meadow: ["#72983c", "#789e3e", "#6b9137", "#81a544"],
  forest: ["#214a29", "#28552a", "#183f25", "#32622e"],
  water: ["#174b61", "#19556c", "#123e55", "#206074"],
  industry: ["#1b2024", "#22262b", "#171c21", "#282d31"],
  contested: ["#384331", "#313b30", "#414934", "#2d3830"],
  gridNature: "rgba(28,64,33,.34)",
  gridIndustry: "rgba(132,142,140,.25)",
};

const ENTITY_COLORS: Record<string, readonly [string, string, string]> = {
  rootreclaimer: ["#5f8f32", "#9ecb52", "#493722"],
  sunbloom: ["#a96725", "#e4b737", "#50351f"],
  thornbramble: ["#274b2c", "#853943", "#172e22"],
  "deepfake-sludge": ["#24456f", "#6261ad", "#d55caf"],
  "popup-parasite": ["#202229", "#a13d88", "#e4a142"],
  "slop-swarm": ["#566127", "#b4bf39", "#202622"],
  fragment: ["#664d82", "#a25294", "#d0b8d0"],
};

function hash(seed: number, salt = 0) {
  let value = (seed ^ Math.imul(salt + 17, 0x45d9f3b)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: PixelPoint[]) {
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(Math.round(point.x), Math.round(point.y)) : ctx.moveTo(Math.round(point.x), Math.round(point.y)));
  ctx.closePath();
}

function cellFill(cell: TacticalCellState) {
  const variant = cell.variantSeed & 3;
  if (cell.ground === "water") return PALETTE.water[variant];
  if (cell.ground === "industrial" || cell.ground === "rubble") return PALETTE.industry[variant];
  if (cell.territory === "contested") return PALETTE.contested[variant];
  if (cell.habitat === "forest") return PALETTE.forest[variant];
  return PALETTE.meadow[variant];
}

function cellAlpha(cell: TacticalCellState) {
  return cell.corruption > 66 ? .58 : cell.corruption > 20 ? .76 : 1;
}

function drawBaseCells(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  ctx.fillStyle = "#111a17";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const cell of state.cells.values()) {
    const polygon = hexPolygonFor(layout, cell.hex, 1.018);
    tracePolygon(ctx, polygon);
    ctx.globalAlpha = cellAlpha(cell);
    ctx.fillStyle = cellFill(cell);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPixelGrass(ctx: CanvasRenderingContext2D, cell: TacticalCellState, center: PixelPoint) {
  const count = cell.habitat === "flowers" ? 4 : cell.habitat === "grass" ? 2 : 0;
  for (let index = 0; index < count; index += 1) {
    const value = hash(cell.variantSeed, index);
    const x = Math.round(center.x - 13 + value % 27);
    const y = Math.round(center.y - 8 + (value >>> 8) % 17);
    ctx.fillStyle = cell.habitat === "flowers" && index > 1 ? (value & 1 ? "#d6b439" : "#bf6b8e") : "#385f2b";
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = "#82a945";
    ctx.fillRect(x + 1, y - 2, 1, 2);
  }
}

function drawForestCell(ctx: CanvasRenderingContext2D, cell: TacticalCellState, center: PixelPoint) {
  if (cell.habitat !== "forest") return;
  const value = hash(cell.variantSeed, 91);
  const clusters = 3 + (value & 1);
  for (let index = 0; index < clusters; index += 1) {
    const angle = index * Math.PI * 2 / clusters + (value % 19) * .03;
    const x = Math.round(center.x + Math.cos(angle) * 9);
    const y = Math.round(center.y + Math.sin(angle) * 6);
    ctx.fillStyle = index & 1 ? "#1c3c23" : "#315f29";
    ctx.fillRect(x - 6, y - 5, 12, 10);
    ctx.fillStyle = index & 1 ? "#356b2c" : "#467832";
    ctx.fillRect(x - 3, y - 7, 7, 5);
  }
}

function drawWaterDetail(ctx: CanvasRenderingContext2D, cell: TacticalCellState, center: PixelPoint) {
  if (cell.ground !== "water") return;
  const value = hash(cell.variantSeed, 37);
  ctx.fillStyle = value & 1 ? "#39798a" : "#2b6c7d";
  ctx.fillRect(Math.round(center.x - 10), Math.round(center.y - 5 + value % 9), 12, 2);
  if ((value >>> 3) % 3 === 0) {
    ctx.fillStyle = "#6c9241";
    ctx.fillRect(Math.round(center.x + 5), Math.round(center.y + 3), 5, 3);
    ctx.fillStyle = "#adc852";
    ctx.fillRect(Math.round(center.x + 7), Math.round(center.y + 2), 2, 1);
  }
}

function drawIndustrialDetail(ctx: CanvasRenderingContext2D, cell: TacticalCellState, center: PixelPoint) {
  if (cell.ground !== "industrial" && cell.ground !== "rubble") return;
  const value = hash(cell.variantSeed, 73);
  ctx.fillStyle = "#343b3f";
  ctx.fillRect(Math.round(center.x - 12), Math.round(center.y - 1), 24, 2);
  ctx.fillStyle = "#11171b";
  ctx.fillRect(Math.round(center.x + ((value >>> 4) % 15) - 7), Math.round(center.y - 8), 2, 16);
  if ((value & 7) === 0) {
    ctx.fillStyle = "#b48b2e";
    ctx.fillRect(Math.round(center.x - 6), Math.round(center.y + 6), 4, 2);
  }
}

function drawCellDetails(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  for (const cell of state.cells.values()) {
    const center = hexCenterFor(layout, cell.hex);
    drawPixelGrass(ctx, cell, center);
    drawForestCell(ctx, cell, center);
    drawWaterDetail(ctx, cell, center);
    drawIndustrialDetail(ctx, cell, center);
  }
}

function directionBetween(layout: HexLayout, from: HexCoord, to: HexCoord) {
  const a = hexCenterFor(layout, from);
  const b = hexCenterFor(layout, to);
  return { a, b };
}

function edgeKinds(edge: TacticalEdgeState) {
  return (["road", "cable", "root", "drain", "wall"] as const).filter((kind) => Boolean(edge[kind]));
}

function drawEdges(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  for (const edge of state.edges.values()) {
    const kinds = edgeKinds(edge);
    if (!kinds.length) continue;
    const { a, b } = directionBetween(layout, edge.a, edge.b);
    const middle = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    for (let index = 0; index < kinds.length; index += 1) {
      const kind = kinds[index];
      const color = kind === "road" ? "#9d7f4a" : kind === "root" ? "#779d3d" : kind === "cable" ? "#b18a31" : kind === "drain" ? "#426978" : "#6c7474";
      const offset = (index - (kinds.length - 1) / 2) * 3;
      ctx.strokeStyle = "#151d1b";
      ctx.lineWidth = kind === "road" ? 8 : 5;
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x + nx * offset), Math.round(a.y + ny * offset));
      ctx.lineTo(Math.round(b.x + nx * offset), Math.round(b.y + ny * offset));
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = kind === "road" ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x + nx * offset), Math.round(a.y + ny * offset));
      ctx.lineTo(Math.round(b.x + nx * offset), Math.round(b.y + ny * offset));
      ctx.stroke();
      if (kind === "cable" || kind === "root") {
        ctx.fillStyle = kind === "root" ? "#a6c954" : "#d4a93f";
        ctx.fillRect(middle.x - 1, middle.y - 1, 3, 3);
      }
    }
  }
}

function drawStructure(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  for (const structure of state.structures) {
    const center = hexCenterFor(layout, structure.anchor);
    if (structure.kind === "cooling-array") {
      ctx.fillStyle = "#0f1519";
      ctx.fillRect(Math.round(center.x - 14), Math.round(center.y - 12), 28, 24);
      for (const x of [-8, 7]) for (const y of [-6, 5]) {
        ctx.fillStyle = "#596166";
        ctx.fillRect(Math.round(center.x + x - 4), Math.round(center.y + y - 4), 8, 8);
        ctx.fillStyle = "#20272b";
        ctx.fillRect(Math.round(center.x + x - 2), Math.round(center.y + y - 2), 4, 4);
      }
    } else {
      ctx.fillStyle = "#11171b";
      ctx.fillRect(Math.round(center.x - 15), Math.round(center.y - 13), 30, 26);
      ctx.fillStyle = structure.kind === "data-core" ? "#78436f" : "#626a6c";
      ctx.fillRect(Math.round(center.x - 11), Math.round(center.y - 9), 22, 18);
      ctx.fillStyle = structure.kind === "data-core" ? "#d865ad" : "#a78b3d";
      ctx.fillRect(Math.round(center.x - 7), Math.round(center.y - 5), 4, 3);
      ctx.fillRect(Math.round(center.x + 3), Math.round(center.y + 3), 5, 3);
    }
  }
}

function pixelDisc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  for (let row = -radius; row <= radius; row += 2) {
    const half = Math.floor(Math.sqrt(Math.max(0, radius * radius - row * row)));
    ctx.fillRect(Math.round(x - half), Math.round(y + row), half * 2 + 1, 2);
  }
}

function drawEntity(ctx: CanvasRenderingContext2D, entity: TacticalEntity, layout: HexLayout, selected: boolean) {
  const center = hexCenterFor(layout, entity.hex);
  if (selected) {
    tracePolygon(ctx, hexPolygonFor(layout, entity.hex, .86));
    ctx.strokeStyle = "#e6ec86";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const colors = ENTITY_COLORS[entity.kind] ?? ENTITY_COLORS["slop-swarm"];
  if (entity.side === "ally") {
    for (let arm = 0; arm < 6; arm += 1) {
      const angle = arm * Math.PI / 3 + .2;
      ctx.strokeStyle = colors[2];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.round(center.x), Math.round(center.y));
      ctx.lineTo(Math.round(center.x + Math.cos(angle) * 14), Math.round(center.y + Math.sin(angle) * 10));
      ctx.stroke();
    }
    pixelDisc(ctx, center.x, center.y, 9, colors[0]);
    pixelDisc(ctx, center.x - 5, center.y - 6, 5, colors[1]);
    pixelDisc(ctx, center.x + 5, center.y - 4, 4, colors[1]);
  } else if (entity.kind === "popup-parasite") {
    ctx.fillStyle = colors[0];
    ctx.fillRect(Math.round(center.x - 11), Math.round(center.y - 11), 22, 22);
    ctx.fillStyle = colors[1];
    ctx.fillRect(Math.round(center.x - 8), Math.round(center.y - 7), 16, 14);
    ctx.fillStyle = colors[2];
    ctx.fillRect(Math.round(center.x - 5), Math.round(center.y - 4), 10, 3);
  } else {
    pixelDisc(ctx, center.x - 5, center.y + 2, 10, colors[0]);
    pixelDisc(ctx, center.x + 6, center.y + 1, 8, colors[1]);
    ctx.fillStyle = colors[2];
    ctx.fillRect(Math.round(center.x - 3), Math.round(center.y - 5), 3, 3);
  }
  ctx.fillStyle = "#101714";
  ctx.fillRect(Math.round(center.x - 12), Math.round(center.y - 17), 24, 4);
  ctx.fillStyle = entity.side === "ally" ? "#80ad4b" : "#bb5a99";
  ctx.fillRect(Math.round(center.x - 11), Math.round(center.y - 16), Math.max(1, Math.round(22 * entity.hp / entity.maxHp)), 2);
}

function drawEntities(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  const entities = [...state.entities].sort((left, right) => hexCenterFor(layout, left.hex).y - hexCenterFor(layout, right.hex).y);
  for (const entity of entities) drawEntity(ctx, entity, layout, entity.id === state.turn.selectedEntityId);
}

function drawActionRoute(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  const selected = state.turn.selectedEntityId ? state.entities.find((entity) => entity.id === state.turn.selectedEntityId) : null;
  const previewPath = selected && state.preview ? [selected.hex, state.preview.hex] : [];
  if (!previewPath.length) return;
  const color = state.turn.selectedAction === "restore" ? "#85b43f" : state.turn.selectedAction === "attack" ? "#bd659c" : "#d3d95c";
  ctx.fillStyle = color;
  for (let index = 1; index < previewPath.length; index += 1) {
    const from = hexCenterFor(layout, previewPath[index - 1]);
    const to = hexCenterFor(layout, previewPath[index]);
    const steps = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 6));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      ctx.fillRect(Math.round(from.x + (to.x - from.x) * t) - 1, Math.round(from.y + (to.y - from.y) * t) - 1, 3, 3);
    }
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  if (!state.preview) return;
  tracePolygon(ctx, hexPolygonFor(layout, state.preview.hex, .88));
  ctx.fillStyle = state.preview.valid ? "rgba(218,225,78,.12)" : "rgba(190,71,105,.1)";
  ctx.fill();
  ctx.strokeStyle = state.preview.valid ? "#dfe65b" : "#c35476";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawMesh(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  ctx.lineWidth = 1;
  for (const cell of state.cells.values()) {
    tracePolygon(ctx, hexPolygonFor(layout, cell.hex, .985));
    ctx.strokeStyle = cell.territory === "industry" ? PALETTE.gridIndustry : PALETTE.gridNature;
    ctx.stroke();
  }
}

export function renderTacticalWorld(ctx: CanvasRenderingContext2D, state: TacticalWorldState, layout: HexLayout) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawBaseCells(ctx, state, layout);
  drawCellDetails(ctx, state, layout);
  drawEdges(ctx, state, layout);
  drawMesh(ctx, state, layout);
  drawStructure(ctx, state, layout);
  drawEntities(ctx, state, layout);
  drawActionRoute(ctx, state, layout);
  drawCursor(ctx, state, layout);
  ctx.restore();
}
