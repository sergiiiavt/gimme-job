import assert from "node:assert/strict";
import test from "node:test";

import {
  cellAt,
  createGameState,
  updateGame,
} from "../app/rewild-hex-world.ts";

test("damaged datacenters keep operating until destroyed", () => {
  const state = createGameState(0, "normal", "playing", { seed: 11 });
  const subject = state.nodes[0];
  subject.hp = 1;
  subject.buildProgress = 0;
  subject.spawnTimer = 0;
  subject.spreadTimer = 0;
  for (const node of state.nodes.slice(1)) { node.spawnTimer = 999; node.spreadTimer = 999; }
  const before = [...state.world.cells.values()].filter((cell) => cell.corruption > 0).length;

  updateGame(state, .01);

  assert.equal(state.enemies.length, 1, "PR14 has no low-health shutdown threshold");
  assert.ok([...state.world.cells.values()].filter((cell) => cell.corruption > 0).length > before);
});

test("destroyed datacenters do not create persistent occupied rubble", () => {
  const state = createGameState(0, "normal", "playing", { seed: 12 });
  const subject = state.nodes[0];
  const anchor = { ...subject.anchor };
  subject.hp = 0;
  subject.spawnTimer = 999;
  subject.spreadTimer = 999;
  for (const node of state.nodes.slice(1)) { node.spawnTimer = 999; node.spreadTimer = 999; }

  updateGame(state, .01);

  assert.equal(state.nodes.some((node) => node.id === subject.id), false);
  assert.equal(state.ruins.length, 0);
  assert.notEqual(cellAt(state.world, anchor)?.surface, "rubble");
  assert.ok((cellAt(state.world, anchor)?.corruption ?? 0) > 0, "the former source cell stays corrupted until roots reclaim it");
});

test("facility build progress is visual state and does not gate simulation", () => {
  const state = createGameState(0, "normal", "playing", { seed: 13 });
  const subject = state.nodes[0];
  subject.buildProgress = 0;
  subject.spawnTimer = 0;
  subject.spreadTimer = 999;
  for (const node of state.nodes.slice(1)) { node.spawnTimer = 999; node.spreadTimer = 999; }

  updateGame(state, .01);

  assert.equal(state.enemies.length, 1);
  assert.ok(subject.buildProgress > 0, "renderer may still visualize construction progress independently");
});
