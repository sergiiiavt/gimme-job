import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANTS,
  biomeAt,
  cellAt,
  createGameState,
  createHexWorld,
  environmentVisualState,
  hexDistance,
  objectAt,
  placePlant,
  updateGame,
} from "../app/rewild-hex-world.ts";
import { REWILD_BASELINE } from "../app/rewild-balance.ts";

const sameHex = (left, right) => left.q === right.q && left.r === right.r;

test("generated biome regions remain connected visual map features", () => {
  const world = createHexWorld();
  assert.ok(world.biomes.some((region) => region.kind === "forest" && region.cells.length >= 12));
  for (const region of world.biomes) {
    const unseen = new Set(region.cells.map((hex) => `${hex.q},${hex.r}`));
    const queue = [region.cells[0]];
    while (queue.length) {
      const current = queue.shift();
      const currentKey = `${current.q},${current.r}`;
      if (!unseen.delete(currentKey)) continue;
      for (const neighbor of region.cells.filter((hex) => hexDistance(hex, current) === 1)) if (unseen.has(`${neighbor.q},${neighbor.r}`)) queue.push(neighbor);
    }
    assert.equal(unseen.size, 0, `${region.id} must be one connected shape`);
    if (region.kind === "water") assert.ok(region.cells.every((hex) => cellAt(world, hex)?.surface === "water"));
  }
});

test("ponds no longer alter corruption as an autonomous gameplay rule", () => {
  const state = createGameState(0, "normal", "playing", { seed: 21 });
  state.nodes = [];
  state.nextWave = 999;
  for (const cell of state.world.cells.values()) { cell.corruption = 0; cell.source = null; }
  const pond = state.world.objects.find((object) => object.kind === "pond");
  assert.ok(pond);
  const target = [...state.world.cells.values()].find((cell) => cell.surface === "meadow" && pond.footprint.some((part) => hexDistance(part, cell.hex) <= 2));
  assert.ok(target);
  target.corruption = 4;

  updateGame(state, 2.5);

  assert.equal(target.corruption, 4);
  assert.equal(state.effects.filter((effect) => effect.kind === "dilution").length, 0);
});

test("tree and pond response frames remain available as render-only state", () => {
  const state = createGameState(0, "normal", "playing", { seed: 22 });
  state.nodes = [];
  const tree = state.world.objects.find((object) => object.kind === "tree");
  assert.ok(tree);
  for (const hex of tree.footprint) {
    const cell = cellAt(state.world, hex);
    if (cell) cell.corruption = 3;
  }
  assert.equal(environmentVisualState(state, tree), "corrupted");
  state.environmentResponses.set(tree.id, { stress: 3, recoveringUntil: state.elapsed + 6 });
  for (const hex of tree.footprint) {
    const cell = cellAt(state.world, hex);
    if (cell) cell.corruption = 0;
  }
  assert.equal(environmentVisualState(state, tree), "recovering");
  state.elapsed += 7;
  assert.equal(environmentVisualState(state, tree), "healthy");
});

test("nearby trees do not change Rootreclaimer range or cycle", () => {
  const state = createGameState(0, "normal", "playing", { seed: 23 });
  state.nodes = [];
  state.nextWave = 999;
  state.wave = 2;
  state.sunlight = 1_000;
  for (const cell of state.world.cells.values()) { cell.corruption = 0; cell.source = null; }
  const tree = state.world.objects.find((object) => object.kind === "tree");
  assert.ok(tree);
  const target = [...state.world.cells.values()].find((cell) => cell.surface === "meadow"
    && hexDistance(cell.hex, tree.anchor) <= 3
    && !biomeAt(state.world, cell.hex)
    && !objectAt(state.world, cell.hex, true));
  assert.ok(target);
  target.corruption = 4;
  state.selected = "rootreclaimer";
  assert.equal(PLANTS.rootreclaimer.unlockWave, 2);
  assert.equal(placePlant(state, target.hex), true);
  const root = state.plants.at(-1);
  root.reclaimTimer = 0;

  updateGame(state, .01);

  assert.equal(root.reclaimTimer, REWILD_BASELINE.rootReclaimSeconds);
  assert.equal(root.reclaimTimer, 3.7);
});

test("difficulty labels no longer change the frozen PR14 gameplay values", () => {
  const states = ["easy", "normal", "hard"].map((difficulty) => createGameState(0, difficulty, "playing", { seed: 24 }));
  assert.deepEqual(states.map((state) => state.sunlight), [120, 120, 120]);
  assert.deepEqual(states.map((state) => state.houseHp), [100, 100, 100]);
  assert.deepEqual(states.map((state) => state.nextWave), [24, 24, 24]);
  assert.ok(states.every((state) => state.nodes.length === 2));
  assert.equal(states.every((state) => sameHex(state.nodes[0].anchor, states[0].nodes[0].anchor)), true);
});
