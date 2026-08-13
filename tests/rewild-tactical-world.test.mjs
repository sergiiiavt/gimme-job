import assert from "node:assert/strict";
import test from "node:test";

import { hexDistanceBetween } from "../app/rewild-hex-grid.ts";
import {
  TACTICAL_COLS,
  TACTICAL_ROWS,
  chooseTacticalAction,
  createTacticalBenchmark,
  deriveTacticalComponents,
  endTacticalTurn,
  inspectTacticalCell,
  moveTacticalEntity,
  reduceTacticalWorld,
  selectTacticalEntity,
  setTacticalPreview,
  tacticalCellAt,
  tacticalCellKey,
  tacticalEdgeAt,
  tacticalEdgesForCell,
  tacticalEntityAt,
  tacticalNeighbor,
  tacticalNeighbors,
  tacticalUiSnapshot,
} from "../app/rewild-tactical-world.ts";

function benchmarkSignature(state) {
  return JSON.stringify({
    cells: Array.from(state.cells, ([key, cell]) => [key, cell.ground, cell.habitat, cell.territory, cell.corruption, cell.recovery, cell.structureId, cell.occupantId, cell.variantSeed]),
    networks: Array.from(state.edges.values()).filter((edge) => edge.road || edge.cable || edge.root || edge.drain || edge.wall),
    components: state.components.all.map((component) => [component.id, component.kind, component.cells, component.boundary, component.variantSeed]),
    structures: state.structures,
    entities: state.entities,
    turn: state.turn,
  });
}

test("creates a deterministic authoritative 37 by 15 benchmark board", () => {
  const state = createTacticalBenchmark();
  const repeat = createTacticalBenchmark();
  assert.equal(state.cells.size, TACTICAL_COLS * TACTICAL_ROWS);
  assert.equal(benchmarkSignature(state), benchmarkSignature(repeat));

  for (let q = 0; q < TACTICAL_COLS; q += 1) for (let r = 0; r < TACTICAL_ROWS; r += 1) {
    const hex = { q, r };
    const cell = tacticalCellAt(state, hex);
    assert.ok(cell, `missing cell ${tacticalCellKey(hex)}`);
    assert.deepEqual(cell.hex, hex);
    assert.equal(state.cells.get(tacticalCellKey(hex)), cell);
    assert.ok(Number.isInteger(cell.corruption) && cell.corruption >= 0 && cell.corruption <= 100);
    assert.ok(Number.isInteger(cell.recovery) && cell.recovery >= 0 && cell.recovery <= 100);
    assert.ok(Number.isInteger(cell.variantSeed) && cell.variantSeed >= 0);
  }

  const alternate = createTacticalBenchmark(12345);
  assert.notEqual(benchmarkSignature(state), benchmarkSignature(alternate));
  assert.deepEqual(Array.from(state.cells.keys()), Array.from(alternate.cells.keys()));
});

test("stores every internal border once and exposes explicit six-edge networks", () => {
  const state = createTacticalBenchmark();
  const neighborReferences = Array.from(state.cells.values()).reduce((total, cell) => total + tacticalNeighbors(cell.hex).length, 0);
  assert.equal(state.edges.size, neighborReferences / 2);

  for (const edge of state.edges.values()) {
    assert.equal(hexDistanceBetween(edge.a, edge.b), 1);
    assert.equal(tacticalEdgeAt(state, edge.a, edge.b), edge);
    assert.equal(tacticalEdgeAt(state, edge.b, edge.a), edge);
    assert.ok(edge.direction >= 0 && edge.direction < 6);
    for (const connection of ["road", "cable", "root", "drain", "wall"]) assert.equal(typeof edge[connection], "boolean");
  }

  const interior = { q: 18, r: 6 };
  assert.equal(tacticalEdgesForCell(state, interior).length, 6);
  for (const connection of ["road", "cable", "root", "drain", "wall"]) {
    assert.ok(Array.from(state.edges.values()).some((edge) => edge[connection]), `missing ${connection} network`);
  }
});

test("derives joined forests and lakes with only external component boundaries", () => {
  const state = createTacticalBenchmark();
  assert.deepEqual(state.components.forests.map((component) => component.cells.length), [38, 43, 17]);
  assert.deepEqual(state.components.lakes.map((component) => component.cells.length), [22, 21]);

  const derived = deriveTacticalComponents(state.cells, state.seed);
  assert.deepEqual(derived, state.components);
  for (const component of state.components.all) {
    const memberKeys = new Set(component.cells.map(tacticalCellKey));
    assert.equal(memberKeys.size, component.cells.length);
    const reached = new Set([tacticalCellKey(component.cells[0])]);
    const queue = [component.cells[0]];
    for (let index = 0; index < queue.length; index += 1) {
      for (const neighbor of tacticalNeighbors(queue[index])) {
        const key = tacticalCellKey(neighbor);
        if (memberKeys.has(key) && !reached.has(key)) {
          reached.add(key);
          queue.push(neighbor);
        }
      }
    }
    assert.equal(reached.size, component.cells.length, `${component.id} contains a disconnected cell`);
    for (const boundary of component.boundary) {
      assert.ok(memberKeys.has(tacticalCellKey(boundary.cell)));
      assert.deepEqual(tacticalNeighbor(boundary.cell, boundary.direction), boundary.neighbor);
      assert.ok(!boundary.neighbor || !memberKeys.has(tacticalCellKey(boundary.neighbor)));
    }
  }
});

test("authors nature, contested frontier, and industry as real cell states", () => {
  const state = createTacticalBenchmark();
  for (let r = 0; r < TACTICAL_ROWS; r += 1) {
    assert.equal(tacticalCellAt(state, { q: 0, r }).territory, "nature");
    assert.equal(tacticalCellAt(state, { q: TACTICAL_COLS - 1, r }).territory, "industry");
    assert.equal(tacticalCellAt(state, { q: TACTICAL_COLS - 1, r }).ground, "industrial");
  }
  const transitionStarts = Array.from({ length: TACTICAL_ROWS }, (_, r) => {
    for (let q = 0; q < TACTICAL_COLS; q += 1) if (tacticalCellAt(state, { q, r }).territory !== "nature") return q;
    return -1;
  });
  assert.ok(new Set(transitionStarts).size >= 3, "the frontier must be visibly irregular");

  for (const structure of state.structures) for (const hex of structure.footprint) {
    const cell = tacticalCellAt(state, hex);
    assert.equal(cell.structureId, structure.id);
    assert.equal(cell.ground, "industrial");
    assert.equal(cell.habitat, null);
    assert.equal(cell.territory, "industry");
  }
});

test("keeps entities, cell occupancy, facing, AP, and selected Rootreclaimer authoritative", () => {
  const state = createTacticalBenchmark();
  assert.equal(state.turn.phase, "player");
  assert.equal(state.turn.selectedAction, "move");
  const selected = state.entities.find((entity) => entity.id === state.turn.selectedEntityId);
  assert.equal(selected.name, "Rootreclaimer");
  assert.equal(selected.side, "ally");
  assert.equal(tacticalEntityAt(state, selected.hex), selected);
  assert.ok(state.entities.some((entity) => entity.name === "AI Slop Swarm"));
  assert.ok(state.entities.some((entity) => entity.name === "Deepfake Sludge"));
  assert.ok(state.entities.some((entity) => entity.name === "Popup Parasite"));
  for (const entity of state.entities) {
    assert.equal(tacticalCellAt(state, entity.hex).occupantId, entity.id);
    assert.ok(entity.facing >= 0 && entity.facing < 6);
    assert.ok(entity.actionPoints >= 0 && entity.actionPoints <= entity.maxActionPoints);
  }
});

test("previews and moves only across one open shared border", () => {
  const state = createTacticalBenchmark();
  const selected = state.entities.find((entity) => entity.id === state.turn.selectedEntityId);
  const destination = tacticalNeighbors(selected.hex).find((hex) => {
    const cell = tacticalCellAt(state, hex);
    return cell.ground !== "water" && !cell.structureId && !cell.occupantId;
  });
  assert.ok(destination);

  const previewed = setTacticalPreview(state, destination);
  assert.equal(previewed.preview.valid, true);
  assert.ok(previewed.preview.edge);
  const moved = moveTacticalEntity(previewed, destination);
  const movedEntity = moved.entities.find((entity) => entity.id === selected.id);
  assert.deepEqual(movedEntity.hex, destination);
  assert.equal(movedEntity.actionPoints, selected.actionPoints - 1);
  assert.equal(tacticalCellAt(moved, selected.hex).occupantId, null);
  assert.equal(tacticalCellAt(moved, destination).occupantId, selected.id);
  assert.equal(moved.preview, null);
  assert.equal(tacticalCellAt(state, selected.hex).occupantId, selected.id, "the source state remains immutable");

  const distant = { q: selected.hex.q - 3, r: selected.hex.r };
  assert.equal(moveTacticalEntity(state, distant), state);
  const water = Array.from(state.cells.values()).find((cell) => cell.ground === "water");
  assert.equal(moveTacticalEntity(state, water.hex), state);
});

test("reducer selection, actions, and end-turn cycle preserve phase authority", () => {
  const initial = createTacticalBenchmark();
  const sunbloom = initial.entities.find((entity) => entity.kind === "sunbloom");
  const enemy = initial.entities.find((entity) => entity.side === "enemy");
  const selected = selectTacticalEntity(initial, sunbloom.id);
  assert.equal(selected.turn.selectedEntityId, sunbloom.id);
  assert.equal(selected.turn.selectedAction, null);
  assert.equal(selectTacticalEntity(initial, enemy.id), initial, "an enemy cannot be selected during player phase");

  const attacking = chooseTacticalAction(selected, "attack");
  assert.equal(attacking.turn.selectedAction, "attack");
  const endedPlayer = reduceTacticalWorld(attacking, { type: "end-turn" });
  assert.equal(endedPlayer.turn.phase, "enemy");
  assert.equal(endedPlayer.turn.selectedEntityId, null);
  const endedEnemy = endTacticalTurn(endedPlayer);
  assert.equal(endedEnemy.turn.phase, "resolve");
  const nextTurn = endTacticalTurn(endedEnemy);
  assert.equal(nextTurn.turn.phase, "player");
  assert.equal(nextTurn.turn.number, initial.turn.number + 1);
  for (const ally of nextTurn.entities.filter((entity) => entity.side === "ally")) assert.equal(ally.actionPoints, ally.maxActionPoints);
});

test("offers renderer-ready cell inspection and UI snapshots", () => {
  const state = createTacticalBenchmark();
  const root = state.entities.find((entity) => entity.kind === "rootreclaimer");
  const inspection = inspectTacticalCell(state, root.hex);
  assert.equal(inspection.cell.occupantId, root.id);
  assert.equal(inspection.entity, root);
  assert.equal(inspection.edges.length, 6);

  const structure = state.structures[0];
  const structureInspection = inspectTacticalCell(state, structure.anchor);
  assert.equal(structureInspection.structure.id, structure.id);

  const ui = tacticalUiSnapshot(state);
  assert.equal(ui.turnNumber, 1);
  assert.equal(ui.phase, "player");
  assert.equal(ui.selectedEntity.name, "Rootreclaimer");
  assert.equal(ui.allyCount, 4);
  assert.equal(ui.enemyCount, 4);
  assert.equal(ui.natureCells + ui.industryCells + ui.contestedCells, state.cells.size);
  assert.ok(ui.averageCorruption > 0 && ui.averageCorruption < 100);
});
