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
import type { RewildCamera } from "./rewild-production-renderer";
import type { RenderSnapshot } from "./rewild-render-snapshot";

const CLUSTER_OFFSETS = [
  { x: 0, y: 0 },
  { x: -9, y: 5 },
  { x: 10, y: 4 },
  { x: -5, y: -7 },
  { x: 7, y: -6 },
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

function meadowClusterSprite(cell: HexCell, clusterKind: number, index: number): RewildPixelSpriteId {
  if (clusterKind > .84) return index === 0 ? "rock" : random(cell, 324 + index) > .52 ? "grass-tuft" : "shrub";
  if (clusterKind > .54) return index === 0 || random(cell, 329 + index) > .55 ? "shrub" : "flower-cluster";
  return random(cell, 334 + index) > .38 ? "flower-cluster" : "grass-tuft";
}

function meadowClusterScale(sprite: RewildPixelSpriteId, cell: HexCell, salt: number) {
  if (sprite === "rock") return .3 + random(cell, salt) * .12;
  if (sprite === "shrub") return .29 + random(cell, salt) * .11;
  return .2 + random(cell, salt) * .09;
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

    // Meso-detail is anchored by sparse deterministic cluster cells instead of
    // placing one unrelated decoration on a large percentage of meadow cells.
    if (random(cell, 320) < .84) continue;
    const center = hexCenter(cell.hex);
    const clusterKind = random(cell, 321);
    const count = 2 + Math.floor(random(cell, 322) * 3);

    for (let index = 0; index < count; index += 1) {
      const offset = CLUSTER_OFFSETS[index] ?? CLUSTER_OFFSETS[0];
      const sprite = meadowClusterSprite(cell, clusterKind, index);
      const jitterX = Math.round((random(cell, 340 + index) - .5) * 6);
      const jitterY = Math.round((random(cell, 350 + index) - .5) * 4);
      drawRewildSprite(ctx, sprite, center.x + offset.x + jitterX, center.y + offset.y + jitterY, {
        scale: meadowClusterScale(sprite, cell, 360 + index),
        alpha: .76 + random(cell, 370 + index) * .18,
        flipX: random(cell, 380 + index) > .5,
      });
    }
  }
}

function forestNeighborCount(cell: HexCell, kinds: ReadonlyMap<string, string>) {
  return hexNeighbors(cell.hex).filter((neighbor) => kinds.get(hexKey(neighbor)) === "forest").length;
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

    const neighbors = forestNeighborCount(cell, kinds);
    const interior = neighbors >= 4;
    const clearingChance = interior ? .09 : .17;
    if (random(cell, 400) < clearingChance) continue;

    // Interior crowns deliberately overlap across cell centers to read as one
    // canopy mass. Exterior cells stay lighter and expose understory/edge forms.
    const crownCount = interior ? (neighbors >= 5 ? 3 : 2) : 1;
    const center = hexCenter(cell.hex);
    for (let index = 0; index < crownCount; index += 1) {
      const offset = CLUSTER_OFFSETS[index] ?? CLUSTER_OFFSETS[0];
      const pine = random(cell, 410 + index) > (interior ? .82 : .72);
      const sprite: RewildPixelSpriteId = pine ? "tree-pine" : "tree-broadleaf";
      const baseScale = interior ? (pine ? .37 : .43) : (pine ? .34 : .39);
      drawRewildSprite(ctx, sprite, center.x + offset.x + Math.round((random(cell, 420 + index) - .5) * 6), center.y + offset.y + Math.round((random(cell, 430 + index) - .5) * 4), {
        scale: baseScale + random(cell, 440 + index) * .08,
        alpha: cell.corruption >= 3 ? .5 : .88,
        flipX: random(cell, 450 + index) > .5,
      });
    }

    if (!interior && random(cell, 460) > .48) {
      const edgeSprite: RewildPixelSpriteId = random(cell, 461) > .78 ? "log" : "shrub";
      drawRewildSprite(ctx, edgeSprite, center.x + Math.round((random(cell, 462) - .5) * 20), center.y + 8 + Math.round((random(cell, 463) - .5) * 7), {
        scale: edgeSprite === "log" ? .23 : .27,
        alpha: .82,
        flipX: random(cell, 464) > .5,
      });
    }
  }
}

function shorelinePoint(center: { x: number; y: number }, neighbor: { x: number; y: number }, distance = .42) {
  return {
    x: center.x + (neighbor.x - center.x) * distance,
    y: center.y + (neighbor.y - center.y) * distance,
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

    const center = hexCenter(cell.hex);
    const neighbors = hexNeighbors(cell.hex);
    const boundaryDirections = neighbors
      .map((neighbor, direction) => ({ neighbor, direction }))
      .filter(({ neighbor }) => kinds.get(hexKey(neighbor)) !== "water");

    if (!boundaryDirections.length) {
      if (random(cell, 500) > .7) textureCell(ctx, cell, "water-deep", .14);
      if (random(cell, 501) > .86) drawRewildSprite(ctx, "water-lilies", center.x, center.y, { scale: .2, alpha: .76 });
      continue;
    }

    // Shore details attach to actual exterior edges. One primary edge is always
    // eligible and a second edge appears only on more exposed shoreline cells.
    const primaryIndex = Math.floor(random(cell, 502) * boundaryDirections.length);
    const primary = boundaryDirections[primaryIndex];
    if (!primary) continue;
    const selected = [primary];
    if (boundaryDirections.length >= 3 && random(cell, 503) > .58) {
      const secondaryIndex = (primaryIndex + 1 + Math.floor(random(cell, 504) * (boundaryDirections.length - 1))) % boundaryDirections.length;
      const secondary = boundaryDirections[secondaryIndex];
      if (secondary) selected.push(secondary);
    }

    for (const { neighbor, direction } of selected) {
      if (random(cell, 510 + direction) < .3) continue;
      const edge = shorelinePoint(center, hexCenter(neighbor));
      drawRewildSprite(ctx, "reed-clump", edge.x + Math.round((random(cell, 520 + direction) - .5) * 5), edge.y + Math.round((random(cell, 530 + direction) - .5) * 4), {
        scale: .24 + random(cell, 540 + direction) * .08,
        alpha: .84,
        flipX: random(cell, 550 + direction) > .5,
      });
    }

    if (random(cell, 560) > .74) {
      drawRewildSprite(ctx, "water-lilies", center.x + Math.round((random(cell, 561) - .5) * 10), center.y + Math.round((random(cell, 562) - .5) * 7), {
        scale: .2 + random(cell, 563) * .05,
        alpha: .8,
      });
    }
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
    textureCell(ctx, cell, random(cell, 580) > .46 ? "industrial-a" : "industrial-b", .14);
    const roll = random(cell, 581);
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
    drawRewildSprite(ctx, sprite, center.x + Math.round((random(cell, 582) - .5) * 14), center.y + Math.round((random(cell, 583) - .5) * 10), {
      scale: scale + random(cell, 584) * .06,
      alpha: .88,
      flipX: random(cell, 585) > .5,
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
    if (cell.corruption < 3 || random(cell, 600) < .64) continue;
    const center = hexCenter(cell.hex);
    drawRewildSprite(ctx, "corruption-spike", center.x + Math.round((random(cell, 601) - .5) * 14), center.y + Math.round((random(cell, 602) - .5) * 10), {
      scale: .21 + random(cell, 603) * .08,
      alpha: .75 + cell.corruption * .05,
      flipX: random(cell, 604) > .5,
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
