import {
  HOUSE_CENTER,
  REWILD_HEX_LAYOUT,
  cellAt,
  hexCenter,
  hexDistance,
  hexKey,
  hexNeighbors,
  hexPolygon,
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
import type { RewildCamera } from "./rewild-production-renderer";
import type { RenderSnapshot } from "./rewild-render-snapshot";

function random(cell: HexCell, salt: number) {
  let value = (cell.seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) / 0xffffffff;
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

function drawMeadowTexture(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  kinds: ReadonlyMap<string, string>,
  blocked: ReadonlySet<string>,
) {
  for (const cell of snapshot.state.world.cells.values()) {
    const key = hexKey(cell.hex);
    const kind = kinds.get(key);
    if (blocked.has(key) || cell.surface !== "meadow" || cell.corruption !== 0 || kind === "forest" || kind === "water") continue;
    if (random(cell, 300) > .67) continue;
    const variant: RewildTerrainTileId = random(cell, 301) < .35 ? "grass-b" : random(cell, 302) < .55 ? "grass-c" : "grass-a";
    textureCell(ctx, cell, variant, .1 + random(cell, 303) * .08);
  }
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
    if (hexDistance(cell.hex, HOUSE_CENTER) <= 2) continue;
    const roll = random(cell, 320);
    if (roll < .57) continue;
    const center = hexCenter(cell.hex);
    const x = center.x + Math.round((random(cell, 321) - .5) * 18);
    const y = center.y + Math.round((random(cell, 322) - .5) * 12);
    let sprite: RewildPixelSpriteId;
    let scale: number;
    if (roll > .94) {
      sprite = "rock";
      scale = .26 + random(cell, 323) * .12;
    } else if (roll > .84) {
      sprite = "shrub";
      scale = .28 + random(cell, 324) * .1;
    } else if (roll > .69) {
      sprite = "flower-cluster";
      scale = .2 + random(cell, 325) * .08;
    } else {
      sprite = "grass-tuft";
      scale = .2 + random(cell, 326) * .08;
    }
    drawRewildSprite(ctx, sprite, x, y, { scale, alpha: .72 + random(cell, 327) * .2, flipX: random(cell, 328) > .5 });
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
    if (forestNeighbors < 3 || random(cell, 340) < .32) continue;
    const center = hexCenter(cell.hex);
    const count = forestNeighbors >= 5 && random(cell, 341) > .3 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const sprite: RewildPixelSpriteId = random(cell, 342 + index) > .76 ? "tree-pine" : "tree-broadleaf";
      drawRewildSprite(ctx, sprite, center.x + Math.round((random(cell, 344 + index) - .5) * 26), center.y + Math.round((random(cell, 346 + index) - .5) * 17), {
        scale: .31 + random(cell, 348 + index) * .12,
        alpha: cell.corruption >= 3 ? .5 : .8,
        flipX: random(cell, 350 + index) > .5,
      });
    }
  }
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
    const neighbors = hexNeighbors(cell.hex);
    const boundary = neighbors.some((neighbor) => kinds.get(hexKey(neighbor)) !== "water");
    const center = hexCenter(cell.hex);
    if (!boundary) {
      if (random(cell, 360) > .76) textureCell(ctx, cell, "water-deep", .12);
      continue;
    }
    if (random(cell, 361) > .45) {
      drawRewildSprite(ctx, "reed-clump", center.x + Math.round((random(cell, 362) - .5) * 18), center.y + Math.round((random(cell, 363) - .5) * 12), {
        scale: .22 + random(cell, 364) * .08,
        alpha: .82,
        flipX: random(cell, 365) > .5,
      });
    }
    if (random(cell, 366) > .82) drawRewildSprite(ctx, "water-lilies", center.x, center.y, { scale: .22, alpha: .82 });
  }
}

function industrialInfluence(state: GameState, hex: HexCoord) {
  return state.nodes.some((node) => hexDistance(node.anchor, hex) <= (node.boss ? 5 : 4));
}

function drawIndustrialComplex(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  blocked: ReadonlySet<string>,
) {
  const state = snapshot.state;
  for (const cell of state.world.cells.values()) {
    const key = hexKey(cell.hex);
    if (blocked.has(key) || cell.surface === "road" || cell.surface === "water" || !industrialInfluence(state, cell.hex)) continue;
    const center = hexCenter(cell.hex);
    textureCell(ctx, cell, random(cell, 380) > .46 ? "industrial-a" : "industrial-b", .14);
    const roll = random(cell, 381);
    if (roll < .48) continue;
    let sprite: RewildPixelSpriteId;
    let scale = .28;
    if (roll > .9) {
      sprite = "industrial-power";
      scale = .34;
    } else if (roll > .76) {
      sprite = "industrial-fan";
      scale = .3;
    } else if (roll > .61) {
      sprite = "industrial-relay";
      scale = .27;
    } else {
      sprite = "industrial-rubble";
      scale = .25;
    }
    drawRewildSprite(ctx, sprite, center.x + Math.round((random(cell, 382) - .5) * 14), center.y + Math.round((random(cell, 383) - .5) * 10), {
      scale: scale + random(cell, 384) * .06,
      alpha: .88,
      flipX: random(cell, 385) > .5,
    });
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
    if (cell.corruption < 3 || random(cell, 400) < .64) continue;
    const center = hexCenter(cell.hex);
    drawRewildSprite(ctx, "corruption-spike", center.x + Math.round((random(cell, 401) - .5) * 14), center.y + Math.round((random(cell, 402) - .5) * 10), {
      scale: .21 + random(cell, 403) * .08,
      alpha: .75 + cell.corruption * .05,
      flipX: random(cell, 404) > .5,
    });
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

  drawMeadowTexture(ctx, snapshot, kinds, blocked);
  drawMeadowLife(ctx, snapshot, kinds, blocked);
  drawForestDensity(ctx, snapshot, kinds, blocked);
  drawWaterEdges(ctx, snapshot, kinds, blocked);
  drawIndustrialComplex(ctx, snapshot, blocked);
  drawCorruptionDetail(ctx, snapshot, blocked);

  ctx.restore();
}
