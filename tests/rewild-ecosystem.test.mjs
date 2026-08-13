import assert from "node:assert/strict";
import test from "node:test";

import {
  BORDER_SPAWNS,
  PLANTS,
  biomeAt,
  cellAt,
  createGameState,
  createHexWorld,
  environmentVisualState,
  findPath,
  hexDirection,
  hexDistance,
  inspectHex,
  placePlant,
  updateGame,
} from "../app/rewild-hex-world.ts";

const sameHex = (left, right) => left.q === right.q && left.r === right.r;

test("generated biome regions are connected and water owns its logical cells", () => {
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

function validCells(state, kind) {
  state.selected = kind;
  return [...state.world.cells.values()].map((cell) => cell.hex).filter((hex) => {
    const cell = cellAt(state.world, hex);
    const occupied = state.plants.some((plant) => sameHex(plant, hex))
      || state.nodes.some((node) => node.footprint.some((part) => sameHex(part, hex)))
      || state.world.objects.some((object) => object.collision && object.footprint.some((part) => sameHex(part, hex)))
      || ["forest", "rock"].includes(biomeAt(state.world, hex)?.kind);
    if (!cell || occupied) return false;
    return kind === "rootreclaimer" ? cell.corruption > 0 : cell.surface === "meadow" && cell.corruption === 0;
  });
}

function ecosystemPlayer(state) {
  if (state.nodes.length && state.sunlight >= PLANTS.vinewhip.cost) {
    const placement = validCells(state, "vinewhip").map((hex) => ({
      hex,
      score: state.nodes.filter((node) => hexDistance(hex, node.anchor) <= 4 && hexDirection(hex, node.anchor) !== null).length * 100
        - Math.min(...state.nodes.map((node) => hexDistance(hex, node.anchor))),
    })).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score)[0];
    if (placement) { state.selected = "vinewhip"; placePlant(state, placement.hex); return; }
  }
  if (state.sunlight >= PLANTS.sunbloom.cost && state.plants.filter((plant) => plant.kind === "sunbloom").length < 5) {
    const placement = validCells(state, "sunbloom")[0];
    if (placement) { state.selected = "sunbloom"; placePlant(state, placement); return; }
  }
  if (!state.nodes.length && state.sunlight >= PLANTS.rootreclaimer.cost) {
    const placements = validCells(state, "rootreclaimer");
    const placement = state.ruins.length ? placements.sort((left, right) => (
      Math.min(...state.ruins.map((ruin) => hexDistance(left, ruin.anchor)))
      - Math.min(...state.ruins.map((ruin) => hexDistance(right, ruin.anchor)))
    ))[0] : placements[0];
    if (placement) { state.selected = "rootreclaimer"; placePlant(state, placement); }
  }
}

function completeRun(difficulty, defended) {
  const state = createGameState(0, difficulty);
  for (let tick = 0; tick < 40_000 && state.status === "playing"; tick += 1) {
    if (defended && tick % 20 === 0) ecosystemPlayer(state);
    updateGame(state, .05);
  }
  return state;
}

test("ponds actively dilute nearby soil without erasing occupied rubble", () => {
  const state = createGameState(0, "normal");
  state.nodes = [];
  for (const cell of state.world.cells.values()) { cell.corruption = 0; cell.source = null; }
  const pond = state.world.objects.find((object) => object.kind === "pond");
  const target = [...state.world.cells.values()].find((cell) => cell.surface === "meadow" && pond.footprint.some((part) => hexDistance(part, cell.hex) <= 2));
  assert.ok(target);
  target.corruption = 4;
  target.source = 99;
  state.ecosystemTimer = 0;

  updateGame(state, .05);

  assert.equal(target.corruption, 3);
  assert.equal(state.effects.filter((effect) => effect.kind === "dilution").length, 1);
  state.ecosystemTimer = 0;
  updateGame(state, .05);
  assert.equal(target.corruption, 2);
  assert.equal(state.effects.filter((effect) => effect.kind === "dilution").length, 1);
});

test("physical environment frames follow stress and persist through recovery", () => {
  const state = createGameState(0, "normal");
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

test("tree relationships make early root placement stronger and faster", () => {
  const state = createGameState(0, "normal");
  state.nodes = [];
  const tree = state.world.objects.find((object) => object.kind === "tree");
  const target = [...state.world.cells.values()].find((cell) => cell.surface === "meadow"
    && hexDistance(cell.hex, tree.anchor) <= 3
    && !state.world.objects.some((object) => object.collision && object.footprint.some((part) => sameHex(part, cell.hex))));
  assert.ok(target);
  target.corruption = 3;
  state.selected = "rootreclaimer";

  const inspection = inspectHex(state, target.hex);
  assert.equal(PLANTS.rootreclaimer.unlockWave, 1);
  assert.equal(inspection.valid, true);
  assert.ok(inspection.details.some((detail) => detail.includes("Tree network")));
  assert.equal(placePlant(state, target.hex), true);
  updateGame(state, .9);
  assert.equal(state.plants[0].reclaimTimer, 2.5);
});

test("placement analysis exposes road interception and physical blockers", () => {
  const state = createGameState(0, "normal");
  state.nodes = [];
  state.selected = "thornbramble";
  const roadEdge = [...state.world.cells.values()].find((cell) => cell.surface === "meadow"
    && state.world.road.cells.some((road) => hexDistance(cell.hex, road) <= 1)
    && !state.world.objects.some((object) => object.footprint.some((part) => sameHex(part, cell.hex))));
  assert.ok(roadEdge);
  assert.ok(inspectHex(state, roadEdge.hex).details.some((detail) => detail.includes("Road edge")));
  const rock = state.world.objects.find((object) => object.kind === "rock");
  const blocked = inspectHex(state, rock.anchor);
  assert.equal(blocked.valid, false);
  assert.ok(blocked.details.some((detail) => detail.includes("redirects AI slop")));
});

test("enemy pathfinding takes the longer road corridor when its travel cost is lower", () => {
  const state = createGameState(0, "normal");
  const start = BORDER_SPAWNS.find((spawn) => spawn.q === 1 && spawn.r === 10);
  assert.ok(start);
  const path = findPath(state, start);
  const roadSteps = path.filter((hex) => cellAt(state.world, hex)?.surface === "road").length;
  assert.ok(roadSteps >= 10, `expected a road-led route, received ${roadSteps} road steps`);
});

test("enemies contaminate the logical cells they traverse", () => {
  const state = createGameState(0, "normal");
  const node = state.nodes[0];
  node.buildProgress = 7;
  node.spawnTimer = 0;
  node.spreadTimer = 99;
  updateGame(state, .05);
  const enemy = state.enemies[0];
  assert.ok(enemy);
  const start = enemy.hex;
  for (let tick = 0; tick < 400 && sameHex(enemy.hex, start); tick += 1) updateGame(state, .05);
  assert.equal(sameHex(enemy.hex, start), false);
  assert.ok(cellAt(state.world, enemy.hex)?.corruption >= 1);
});

test("all difficulty modes support complete strategic wins and unattended losses", () => {
  const wins = ["easy", "normal", "hard"].map((difficulty) => completeRun(difficulty, true));
  const losses = ["easy", "normal", "hard"].map((difficulty) => completeRun(difficulty, false));

  assert.deepEqual(wins.map((state) => state.status), ["won", "won", "won"], JSON.stringify(wins.map((state) => ({ difficulty: state.difficulty, elapsed: state.elapsed, house: state.houseHp, nodes: state.nodes.length, ruins: state.ruins.length, enemies: state.enemies.length, corrupted: [...state.world.cells.values()].filter((cell) => cell.corruption > 0).length }))));
  assert.deepEqual(losses.map((state) => state.status), ["lost", "lost", "lost"]);
  assert.ok(wins[0].houseHp > wins[1].houseHp && wins[1].houseHp > wins[2].houseHp);
  for (const state of wins) {
    assert.equal(state.wave, 5);
    assert.equal(state.nodes.length, 0);
    assert.equal(state.ruins.length, 0);
    assert.equal(state.enemies.length, 0);
  }
});
