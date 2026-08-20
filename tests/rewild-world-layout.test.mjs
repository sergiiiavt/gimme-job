import assert from "node:assert/strict";
import test from "node:test";

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIELD_LEFT,
  FIELD_TOP,
  HEX_COLS,
  HEX_ROWS,
  HEX_SIZE,
  HOUSE_CENTER,
  HOUSE_FOOTPRINT,
  INITIAL_NODE_ANCHORS,
  createGameState,
  createHexWorld,
  hexCenter,
  hexDistance,
  hexNeighbors,
  hexPolygon,
  pixelToHex,
} from "../app/rewild-hex-world.ts";

const key = (hex) => `${hex.q},${hex.r}`;

function assertConnected(region) {
  const remaining = new Set(region.cells.map(key));
  const queue = [region.cells[0]];
  while (queue.length) {
    const current = queue.shift();
    if (!remaining.delete(key(current))) continue;
    for (const neighbor of hexNeighbors(current)) if (remaining.has(key(neighbor))) queue.push(neighbor);
  }
  assert.equal(remaining.size, 0, `${region.id} must be connected through shared hex edges`);
}

test("shared Rewild geometry matches the approved benchmark density", () => {
  assert.equal(HEX_COLS, 37);
  assert.equal(HEX_ROWS, 15);
  assert.equal(HEX_SIZE, 21);
  assert.ok(FIELD_LEFT >= 0 && FIELD_TOP >= 0);

  const topLeft = hexPolygon({ q: 0, r: 0 });
  const bottomRight = hexPolygon({ q: HEX_COLS - 1, r: HEX_ROWS - 1 });
  const xs = [...topLeft, ...bottomRight].map((point) => point.x);
  const ys = [...topLeft, ...bottomRight].map((point) => point.y);
  assert.ok(Math.min(...xs) >= 0);
  assert.ok(Math.max(...xs) <= CANVAS_WIDTH);
  assert.ok(Math.min(...ys) >= 0);
  assert.ok(Math.max(...ys) <= CANVAS_HEIGHT);

  for (const hex of [{ q: 0, r: 0 }, HOUSE_CENTER, { q: 18, r: 7 }, { q: 36, r: 14 }]) {
    const center = hexCenter(hex);
    assert.deepEqual(pixelToHex(center.x, center.y), hex);
  }
});

test("authored benchmark composes nature left, objective left-center and industry right", () => {
  const state = createGameState(0, "normal", "playing", { seed: 31 });
  const world = state.world;
  const forest = world.biomes.find((region) => region.id === "forest-west");
  const lake = world.biomes.find((region) => region.id === "lake-west");

  assert.ok(forest && forest.cells.length >= 20);
  assert.ok(lake && lake.cells.length >= 7);
  assertConnected(forest);
  assertConnected(lake);
  assert.ok(forest.cells.every((hex) => hex.q < HOUSE_CENTER.q));
  assert.ok(HOUSE_CENTER.q < HEX_COLS / 2);
  assert.equal(HOUSE_FOOTPRINT.length, 3);

  assert.equal(state.nodes.length, 2);
  assert.deepEqual(state.nodes.map((node) => node.anchor), INITIAL_NODE_ANCHORS);
  assert.ok(state.nodes.every((node) => node.anchor.q > HEX_COLS / 2));
  assert.ok(state.nodes.every((node) => hexDistance(node.anchor, HOUSE_CENTER) >= 15));
});

test("road and facility topology stay on six-neighbor shared edges", () => {
  const state = createGameState(0, "normal", "playing", { seed: 32 });
  const road = state.world.road.cells;
  assert.ok(road.length >= 30);
  for (let index = 1; index < road.length; index += 1) assert.equal(hexDistance(road[index - 1], road[index]), 1);

  for (const node of state.nodes) {
    assert.ok(node.footprint.length >= 7);
    for (const cell of node.footprint) assert.ok(hexDistance(node.anchor, cell) <= 1);
    assert.equal(hexDistance(node.anchor, node.outlet), 2);
  }
});
