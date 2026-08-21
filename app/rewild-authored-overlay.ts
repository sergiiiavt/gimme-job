import {
  HOUSE_CENTER,
  hexCenter,
  hexDistance,
  hexKey,
  hexNeighbors,
  type GameState,
  type HexCell,
  type HexCoord,
} from "./rewild-hex-world";
import {
  drawRewildSprite,
  drawRewildTerrainStamp,
  type RewildPixelSpriteId,
  type RewildTerrainTileId,
} from "./rewild-pixel-atlas";
import {
  drawRewildDetailV4,
  type RewildDetailV4Id,
} from "./rewild-detail-atlas-v4";
import type { RewildCamera } from "./rewild-production-renderer";
import type { RenderSnapshot } from "./rewild-render-snapshot";

const CLUSTER_OFFSETS = [
  [0, 0],
  [8, -4],
  [-7, 4],
  [4, 7],
] as const;

function random(cell: HexCell, salt: number) {
  let value = (cell.seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) / 0x100000000;
}

function biomeKindByCell(state: GameState) {
  const kinds = new Map<string, string>();
  for (const region of state.world.biomes) {
    for (const hex of region.cells) kinds.set(hexKey(hex), region.kind);
  }
  return kinds;
}

function blockedHalo(snapshot: RenderSnapshot) {
  const blocked = new Set(snapshot.occupiedHexes);
  const addWithNeighbors = (hex: HexCoord) => {
    blocked.add(hexKey(hex));
    for (const neighbor of hexNeighbors(hex)) blocked.add(hexKey(neighbor));
  };
  for (const plant of snapshot.state.plants) addWithNeighbors(plant);
  for (const enemy of snapshot.state.enemies) addWithNeighbors(enemy.hex);
  for (const node of snapshot.state.nodes) for (const hex of node.footprint) addWithNeighbors(hex);
  addWithNeighbors(snapshot.state.cursor);
  return blocked;
}

function textureCell(
  ctx: CanvasRenderingContext2D,
  cell: HexCell,
  id: RewildTerrainTileId,
  alpha: number,
) {
  const center = hexCenter(cell.hex);
  drawRewildTerrainStamp(ctx, id, center.x, center.y, 43, 43, alpha);
}

function detailScale(id: RewildDetailV4Id) {
  if (id === "detail-lily-pads-a") return .42;
  if (id === "detail-log-a") return .29;
  if (id === "detail-rock-medium-a") return .31;
  if (id.startsWith("industrial-")) return .29;
  return .34;
}

function drawDetail(
  ctx: CanvasRenderingContext2D,
  id: RewildDetailV4Id,
  x: number,
  y: number,
  cell: HexCell,
  salt: number,
  scaleMultiplier = 1,
) {
  drawRewildDetailV4(ctx, id, x, y, {
    scale: detailScale(id) * scaleMultiplier,
    alpha: .78 + random(cell, salt) * .16,
    flipX: random(cell, salt + 1) > .5,
  });
}

function meadowClusterSprite(cell: HexCell, theme: number, index: number): RewildDetailV4Id {
  if (theme > .91) {
    if (index === 0) return random(cell, 330) > .58 ? "detail-rock-medium-a" : "detail-rock-small-a";
    return random(cell, 331 + index) > .52 ? "detail-pebbles" : "detail-grass-tuft-a";
  }
  if (theme > .76) {
    if (index === 0) return "detail-shrub-low-a";
    return random(cell, 334 + index) > .5 ? "detail-grass-tuft-b" : "detail-flower-yellow";
  }
  if (theme > .55) {
    const flowers: RewildDetailV4Id[] = ["detail-flower-yellow", "detail-flower-purple", "detail-wild-weeds", "detail-mushrooms"];
    return flowers[Math.floor(random(cell, 338 + index) * flowers.length)] ?? flowers[0];
  }
  if (theme > .24) {
    const grasses: RewildDetailV4Id[] = ["detail-grass-tuft-a", "detail-grass-tuft-b", "detail-grass-tuft-c", "detail-wild-weeds"];
    return grasses[Math.floor(random(cell, 342 + index) * grasses.length)] ?? grasses[0];
  }
  return index === 0 && random(cell, 346) > .82 ? "detail-stump-a" : random(cell, 347 + index) > .66 ? "detail-pebbles" : "detail-grass-tuft-c";
}

function drawMeadowLife(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  kinds: ReadonlyMap<string, string>,
  blocked: ReadonlySet<string>,
) {
  for (const cell of snapshot.state.world.cells.values()) {
    const key = hexKey(cell.hex);
    const kind = kinds.get(key);
    if (blocked.has(key) || cell.surface !== "meadow" || cell.corruption !== 0 || kind === "forest" || kind === "water") continue;
    if (hexDistance(cell.hex, HOUSE_CENTER) <= 2 || random(cell, 320) < .84) continue;

    const center = hexCenter(cell.hex);
    const count = 2 + Math.floor(random(cell, 321) * 3);
    const theme = random(cell, 322);
    for (let index = 0; index < count; index += 1) {
      const [offsetX, offsetY] = CLUSTER_OFFSETS[index] ?? CLUSTER_OFFSETS[0];
      const sprite = meadowClusterSprite(cell, theme, index);
      drawDetail(
        ctx,
        sprite,
        center.x + offsetX + Math.round((random(cell, 350 + index) - .5) * 5),
        center.y + offsetY + Math.round((random(cell, 354 + index) - .5) * 4),
        cell,
        358 + index * 2,
        .88 + random(cell, 366 + index) * .22,
      );
    }

    if (random(cell, 372) > .975) drawDetail(ctx, "detail-log-a", center.x, center.y + 4, cell, 373, .94);
  }
}

function drawForestDensity(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  kinds: ReadonlyMap<string, string>,
  blocked: ReadonlySet<string>,
) {
  for (const cell of snapshot.state.world.cells.values()) {
    const key = hexKey(cell.hex);
    if (kinds.get(key) !== "forest" || blocked.has(key) || cell.surface === "road") continue;
    const forestNeighbors = hexNeighbors(cell.hex).filter((neighbor) => kinds.get(hexKey(neighbor)) === "forest").length;
    if (forestNeighbors < 3 || random(cell, 380) < .32) continue;
    const center = hexCenter(cell.hex);
    const count = forestNeighbors >= 5 && random(cell, 381) > .3 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const sprite: RewildPixelSpriteId = random(cell, 382 + index) > .76 ? "tree-pine" : "tree-broadleaf";
      drawRewildSprite(ctx, sprite, center.x + Math.round((random(cell, 384 + index) - .5) * 26), center.y + Math.round((random(cell, 386 + index) - .5) * 17), {
        scale: .31 + random(cell, 388 + index) * .12,
        alpha: cell.corruption >= 3 ? .5 : .8,
        flipX: random(cell, 390 + index) > .5,
      });
    }
  }
}

function shorelinePoint(cell: HexCoord, outside: HexCoord, factor = .42) {
  const center = hexCenter(cell);
  const target = hexCenter(outside);
  return {
    x: center.x + (target.x - center.x) * factor,
    y: center.y + (target.y - center.y) * factor,
  };
}

function drawWaterEdges(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  kinds: ReadonlyMap<string, string>,
  blocked: ReadonlySet<string>,
) {
  for (const cell of snapshot.state.world.cells.values()) {
    const key = hexKey(cell.hex);
    if (kinds.get(key) !== "water" || blocked.has(key)) continue;
    const exterior = hexNeighbors(cell.hex).filter((neighbor) => kinds.get(hexKey(neighbor)) !== "water");
    const center = hexCenter(cell.hex);
    if (!exterior.length) {
      if (random(cell, 400) > .76) textureCell(ctx, cell, "water-deep", .12);
      if (random(cell, 401) > .88) drawDetail(ctx, "detail-lily-pads-a", center.x, center.y, cell, 402, .92);
      continue;
    }

    const primary = exterior[Math.floor(random(cell, 404) * exterior.length)] ?? exterior[0];
    const shore = shorelinePoint(cell.hex, primary);
    if (random(cell, 405) > .38) drawDetail(ctx, "detail-reeds-a", shore.x, shore.y, cell, 406, .94);
    if (exterior.length >= 3 && random(cell, 408) > .7) {
      const second = exterior[(exterior.indexOf(primary) + 1) % exterior.length] ?? primary;
      const secondShore = shorelinePoint(cell.hex, second, .39);
      drawDetail(ctx, "detail-reeds-a", secondShore.x, secondShore.y, cell, 409, .82);
    }
    if (random(cell, 411) > .78) drawDetail(ctx, "detail-lily-pads-a", center.x, center.y, cell, 412, .88);
  }
}

function industrialInfluence(state: GameState, hex: HexCoord) {
  return state.nodes.some((node) => hexDistance(node.anchor, hex) <= (node.boss ? 5 : 4));
}

function drawIndustrialComplex(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  kinds: ReadonlyMap<string, string>,
  blocked: ReadonlySet<string>,
) {
  const state = snapshot.state;
  for (const cell of state.world.cells.values()) {
    const key = hexKey(cell.hex);
    if (blocked.has(key) || cell.surface === "road" || cell.surface === "water" || !industrialInfluence(state, cell.hex)) continue;
    const center = hexCenter(cell.hex);
    textureCell(ctx, cell, random(cell, 430) > .46 ? "industrial-a" : "industrial-b", .14);

    const waterNeighbors = hexNeighbors(cell.hex).filter((neighbor) => kinds.get(hexKey(neighbor)) === "water");
    if (waterNeighbors.length && random(cell, 431) > .7) {
      const water = waterNeighbors[Math.floor(random(cell, 432) * waterNeighbors.length)] ?? waterNeighbors[0];
      const outlet = shorelinePoint(cell.hex, water, .3);
      drawDetail(ctx, "industrial-pipe-outlet-a", outlet.x, outlet.y, cell, 433, .88);
      continue;
    }

    const roll = random(cell, 435);
    if (roll < .58) continue;
    let sprite: RewildDetailV4Id;
    if (roll > .9) sprite = "industrial-relay-box-a";
    else if (roll > .78) sprite = "industrial-junction-box-a";
    else if (roll > .66) sprite = "industrial-vent-small-a";
    else sprite = "industrial-debris-small-a";
    drawDetail(
      ctx,
      sprite,
      center.x + Math.round((random(cell, 436) - .5) * 12),
      center.y + Math.round((random(cell, 437) - .5) * 8),
      cell,
      438,
      .86 + random(cell, 440) * .14,
    );
  }
}

function drawCorruptionDetail(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  blocked: ReadonlySet<string>,
) {
  for (const cell of snapshot.state.world.cells.values()) {
    if (!cell.corruption || cell.surface === "foundation") continue;
    const key = hexKey(cell.hex);
    if (blocked.has(key)) continue;
    textureCell(ctx, cell, `corruption-${cell.corruption}` as RewildTerrainTileId, .1 + cell.corruption * .025);
  }
}

export function renderAuthoredArtOverlay(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  camera: RewildCamera,
) {
  const state = snapshot.state;
  const kinds = biomeKindByCell(state);
  const blocked = blockedHalo(snapshot);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  drawMeadowLife(ctx, snapshot, kinds, blocked);
  drawForestDensity(ctx, snapshot, kinds, blocked);
  drawWaterEdges(ctx, snapshot, kinds, blocked);
  drawIndustrialComplex(ctx, snapshot, kinds, blocked);
  drawCorruptionDetail(ctx, snapshot, blocked);

  ctx.restore();
}
