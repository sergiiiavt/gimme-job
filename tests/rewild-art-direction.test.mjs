import assert from "node:assert/strict";
import test from "node:test";

import { createReviewGameState, hexKey } from "../app/rewild-hex-world.ts";
import { createRenderSnapshot } from "../app/rewild-render-snapshot.ts";

function benchmarkSignature() {
  const state = createReviewGameState(0, "ecosystem");
  const snapshot = createRenderSnapshot(state);
  return {
    reviewState: state.reviewState,
    wave: state.wave,
    sunlight: state.sunlight,
    score: state.score,
    houseHp: state.houseHp,
    nodes: state.nodes.map((node) => [node.anchor.q, node.anchor.r, node.boss, node.hp]),
    plants: state.plants.map((plant) => [plant.kind, plant.q, plant.r, plant.hp]),
    enemies: state.enemies.map((enemy) => [enemy.kind, enemy.hex.q, enemy.hex.r, enemy.hp]),
    corrupted: [...state.world.cells.values()].filter((cell) => cell.corruption > 0).map((cell) => [hexKey(cell.hex), cell.corruption]),
    regions: state.world.biomes.map((region) => [region.id, region.kind, region.cells.length]),
    roadEdges: snapshot.roadEdges.map((edge) => [hexKey(edge.from), hexKey(edge.to)]),
  };
}

test("ecosystem review state is the deterministic art-direction benchmark", () => {
  const first = benchmarkSignature();
  const second = benchmarkSignature();

  assert.equal(first.reviewState, "ecosystem");
  assert.equal(first.wave, 4);
  assert.equal(first.sunlight, 88);
  assert.equal(first.score, 1240);
  assert.ok(first.nodes.length >= 2);
  assert.ok(first.regions.some(([, kind]) => kind === "forest"));
  assert.ok(first.regions.some(([, kind]) => kind === "water"));
  assert.ok(first.roadEdges.length > 0);
  assert.deepEqual(second, first, "visual benchmark composition must not drift between renders");
});
