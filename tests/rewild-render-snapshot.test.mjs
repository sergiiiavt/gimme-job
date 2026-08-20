import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { hexNeighborFor } from "../app/rewild-hex-grid.ts";
import {
  REWILD_HEX_LAYOUT,
  createGameState,
  hexDistance,
  hexKey,
} from "../app/rewild-hex-world.ts";
import { createRenderSnapshot } from "../app/rewild-render-snapshot.ts";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("render snapshots are detached from the live simulation state", () => {
  const state = createGameState(0, "normal", "playing", { seed: 301 });
  const firstCell = [...state.world.cells.values()][0];
  const firstNode = state.nodes[0];
  const snapshot = createRenderSnapshot(state);
  const snapshotCell = snapshot.state.world.cells.get(hexKey(firstCell.hex));

  assert.notEqual(snapshot.state, state);
  assert.notEqual(snapshot.state.world, state.world);
  assert.notEqual(snapshotCell, firstCell);
  assert.notEqual(snapshot.state.nodes[0], firstNode);

  const originalSnapshotHp = snapshot.state.nodes[0].hp;
  const originalSnapshotCorruption = snapshotCell.corruption;
  firstNode.hp -= 17;
  firstCell.corruption = firstCell.corruption === 4 ? 3 : 4;

  assert.equal(snapshot.state.nodes[0].hp, originalSnapshotHp);
  assert.equal(snapshotCell.corruption, originalSnapshotCorruption);

  snapshot.state.nodes[0].hp -= 11;
  assert.equal(firstNode.hp, originalSnapshotHp - 17, "renderer-side writes cannot reach the live simulation");
});

test("render snapshot derives direction-stable six-neighbor component masks", () => {
  const state = createGameState(0, "normal", "playing", { seed: 302 });
  const snapshot = createRenderSnapshot(state);
  const forest = snapshot.state.world.biomes.find((region) => region.kind === "forest");
  assert.ok(forest);
  const masks = snapshot.regionNeighborMasks.get(forest.id);
  assert.ok(masks);

  const keys = new Set(forest.cells.map(hexKey));
  let linkedCells = 0;
  for (const cell of forest.cells) {
    const mask = masks.get(hexKey(cell));
    assert.ok(Number.isInteger(mask) && mask >= 0 && mask <= 0b111111);
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = hexNeighborFor(REWILD_HEX_LAYOUT, cell, direction);
      assert.equal(Boolean(mask & (1 << direction)), Boolean(neighbor && keys.has(hexKey(neighbor))));
    }
    if (mask) linkedCells += 1;
  }
  assert.ok(linkedCells > 0, "connected regions expose authored neighbor masks for edge rendering");
});

test("snapshot edge networks contain only shared-border hex steps", () => {
  const state = createGameState(0, "normal", "playing", { seed: 303 });
  const snapshot = createRenderSnapshot(state);
  assert.ok(snapshot.roadEdges.length > 0);
  assert.ok(snapshot.cableEdges.length > 0);

  for (const edge of [...snapshot.roadEdges, ...snapshot.cableEdges, ...snapshot.enemyRouteEdges]) {
    assert.equal(hexDistance(edge.from, edge.to), 1);
  }
});

test("active renderer consumes the detached snapshot and its connected-network projections", async () => {
  const [seamSource, productionSource] = await Promise.all([
    readFile(projectFile("app/rewild-overhead-renderer.ts"), "utf8"),
    readFile(projectFile("app/rewild-production-renderer.ts"), "utf8"),
  ]);

  assert.match(seamSource, /createRenderSnapshot\(state\)/);
  assert.match(seamSource, /renderProductionGame\(context, snapshot, camera\)/);
  assert.match(productionSource, /snapshot\.regionNeighborMasks/);
  assert.match(productionSource, /snapshot\.roadEdges/);
  assert.match(productionSource, /snapshot\.cableEdges/);
  assert.match(productionSource, /snapshot\.enemyRouteEdges/);
  assert.doesNotMatch(productionSource, /updateGame|placePlant|moveCursor|createGameState/);
});
