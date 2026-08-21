import {
  cellAt,
  hexCenter,
  hexDirection,
  hexDistance,
  hexKey,
  type HexCoord,
  type WorldObject,
} from "./rewild-hex-world";
import {
  drawRewildRoadV4,
  selectFenceV4,
  selectRoadV4,
} from "./rewild-road-atlas-v4";
import type { RewildCamera } from "./rewild-production-renderer";
import type { RenderEdge, RenderSnapshot } from "./rewild-render-snapshot";

function addDirection(mask: number, from: HexCoord, to: HexCoord) {
  const direction = hexDirection(from, to);
  return direction === null ? mask : mask | (1 << direction);
}

export function connectorMasksFromEdges(edges: readonly RenderEdge[]) {
  const masks = new Map<string, number>();
  for (const edge of edges) {
    masks.set(hexKey(edge.from), addDirection(masks.get(hexKey(edge.from)) ?? 0, edge.from, edge.to));
    masks.set(hexKey(edge.to), addDirection(masks.get(hexKey(edge.to)) ?? 0, edge.to, edge.from));
  }
  return masks;
}

function fenceMasks(objects: readonly WorldObject[]) {
  const fences = objects.filter((object) => object.kind === "fence");
  const masks = new Map<string, number>();
  for (const fence of fences) {
    let mask = 0;
    for (const other of fences) {
      if (other.id === fence.id || hexDistance(fence.anchor, other.anchor) !== 1) continue;
      mask = addDirection(mask, fence.anchor, other.anchor);
    }
    masks.set(hexKey(fence.anchor), mask);
  }
  return masks;
}

function firstDirection(mask: number) {
  for (let direction = 0; direction < 6; direction += 1) {
    if (mask & (1 << direction)) return direction;
  }
  return 0;
}

function straightMaskFrom(mask: number) {
  const direction = firstDirection(mask);
  return (1 << direction) | (1 << ((direction + 3) % 6));
}

function roadOverlayBlocked(snapshot: RenderSnapshot) {
  const blocked = new Set(snapshot.occupiedHexes);
  for (const enemy of snapshot.state.enemies) blocked.add(hexKey(enemy.hex));
  for (const object of snapshot.state.world.objects) {
    if (object.kind === "fence") continue;
    for (const hex of object.footprint) blocked.add(hexKey(hex));
  }
  return blocked;
}

function drawRoadTiles(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  roadMasks: ReadonlyMap<string, number>,
  blocked: ReadonlySet<string>,
) {
  for (const hex of snapshot.state.world.road.cells) {
    const key = hexKey(hex);
    if (blocked.has(key)) continue;
    const cell = cellAt(snapshot.state.world, hex);
    const selection = selectRoadV4(roadMasks.get(key) ?? 0, cell?.seed ?? 0);
    const center = hexCenter(hex);
    drawRewildRoadV4(ctx, selection.id, center.x, center.y, {
      scale: .72,
      alpha: .98,
      rotationSteps: selection.rotationSteps,
    });
  }
}

function drawFenceTiles(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  roadMasks: ReadonlyMap<string, number>,
  blocked: ReadonlySet<string>,
) {
  const masks = fenceMasks(snapshot.state.world.objects);
  for (const object of snapshot.state.world.objects) {
    if (object.kind !== "fence") continue;
    const key = hexKey(object.anchor);
    if (blocked.has(key)) continue;
    const cell = cellAt(snapshot.state.world, object.anchor);
    const roadMask = roadMasks.get(key) ?? 0;
    const connectedFenceMask = masks.get(key) ?? 0;
    const gate = object.id === "fence-house" || roadMask !== 0;
    const broken = (cell?.corruption ?? 0) >= 3;
    const mask = connectedFenceMask || (gate && roadMask ? straightMaskFrom(roadMask) : 0);
    const selection = selectFenceV4(mask, cell?.seed ?? object.id.length, gate, broken);
    const center = hexCenter(object.anchor);
    drawRewildRoadV4(ctx, selection.id, center.x, center.y, {
      scale: .72,
      alpha: .98,
      rotationSteps: selection.rotationSteps,
    });
  }
}

export function renderRewildRoadFenceOverlayV4(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot,
  camera: RewildCamera,
) {
  const roadMasks = connectorMasksFromEdges(snapshot.roadEdges);
  const blocked = roadOverlayBlocked(snapshot);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  drawRoadTiles(ctx, snapshot, roadMasks, blocked);
  drawFenceTiles(ctx, snapshot, roadMasks, blocked);

  ctx.restore();
}
