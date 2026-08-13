import assert from "node:assert/strict";
import test from "node:test";

import {
  hexCenterFor,
  hexDistanceBetween,
  hexDirectionBetween,
  hexLineBetween,
  hexNeighborFor,
  hexNeighborsFor,
  pixelToHexFor,
  straightHexLineBetween,
} from "../app/rewild-hex-grid.ts";

const layout = { cols: 30, rows: 14, size: 25, origin: { x: 28, y: 17 } };
const key = (hex) => `${hex.q},${hex.r}`;

test("hex centers round-trip through direct axial picking", () => {
  for (let q = 0; q < layout.cols; q += 1) for (let r = 0; r < layout.rows; r += 1) {
    const hex = { q, r };
    assert.deepEqual(pixelToHexFor(layout, hexCenterFor(layout, hex).x, hexCenterFor(layout, hex).y), hex);
  }
});

test("interior cells expose exactly six unique border neighbors", () => {
  const origin = { q: 15, r: 7 };
  const neighbors = hexNeighborsFor(layout, origin);
  assert.equal(neighbors.length, 6);
  assert.equal(new Set(neighbors.map(key)).size, 6);
  assert.ok(neighbors.every((neighbor) => hexDistanceBetween(origin, neighbor) === 1));
  assert.deepEqual(Array.from({ length: 6 }, (_, direction) => hexNeighborFor(layout, origin, direction)), neighbors);
});

test("hex lines advance only through shared borders", () => {
  const line = hexLineBetween(layout, { q: 3, r: 2 }, { q: 24, r: 11 });
  assert.equal(line.length, hexDistanceBetween(line[0], line.at(-1)) + 1);
  for (let index = 1; index < line.length; index += 1) assert.equal(hexDistanceBetween(line[index - 1], line[index]), 1);
});

test("straight action lines accept only one of the six hex axes", () => {
  const start = { q: 12, r: 6 };
  const aligned = hexNeighborsFor(layout, start)[0];
  assert.notEqual(hexDirectionBetween(start, aligned), null);
  assert.equal(straightHexLineBetween(layout, start, aligned).length, 2);
  const bentTarget = { q: 14, r: 6 };
  assert.equal(hexDirectionBetween(start, bentTarget), null);
  assert.deepEqual(straightHexLineBetween(layout, start, bentTarget), []);
});
