import assert from "node:assert/strict";
import test from "node:test";

import {
  cellAt,
  createReviewGameState,
  facilityOperational,
  updateGame,
} from "../app/rewild-hex-world.ts";

test("a critically damaged datacenter stops producing and spreading", () => {
  const state = createReviewGameState(0, "damage");
  state.reviewState = null;
  const subject = state.nodes[0];
  subject.hp = subject.maxHp * .19;
  subject.spawnTimer = 0;
  subject.spreadTimer = 0;
  const before = [...state.world.cells.values()].map((cell) => cell.corruption);

  updateGame(state, 1);

  assert.equal(facilityOperational(subject), false);
  assert.equal(state.enemies.length, 0);
  assert.deepEqual([...state.world.cells.values()].map((cell) => cell.corruption), before);
});

test("collapse persists as occupied rubble until every cell is reclaimed", () => {
  const state = createReviewGameState(0, "collapse");
  assert.equal(state.ruins.length, 1);
  assert.ok(state.ruins[0].footprint.every((hex) => cellAt(state.world, hex)?.surface === "rubble"));

  for (const hex of state.ruins[0].footprint) {
    const cell = cellAt(state.world, hex);
    if (cell) { cell.surface = "meadow"; cell.corruption = 0; cell.source = null; }
  }
  state.ruins = state.ruins.filter((ruin) => ruin.footprint.some((hex) => cellAt(state.world, hex)?.surface === "rubble"));

  assert.equal(state.ruins.length, 0);
});

test("deterministic reclamation keeps roots connected to surviving rubble", () => {
  const state = createReviewGameState(0, "reclamation");
  const root = state.plants.find((plant) => plant.kind === "rootreclaimer");
  assert.ok(root?.reclaimTarget);
  assert.equal(state.ruins.length, 1);
  assert.ok(state.ruins[0].footprint.some((hex) => cellAt(state.world, hex)?.surface === "rubble"));
  assert.ok(state.ruins[0].footprint.some((hex) => cellAt(state.world, hex)?.surface === "meadow"));
});
