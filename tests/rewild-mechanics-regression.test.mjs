import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { REWILD_BASELINE, REWILD_ENEMY_BALANCE, REWILD_STORAGE_KEY, waveSunlightReward } from "../app/rewild-balance.ts";
import {
  ENEMIES,
  HOUSE_FOOTPRINT,
  PLANTS,
  cellAt,
  createGameState,
  gameMode,
  hexCenter,
  hexDirection,
  hexDistance,
  hexNeighbors,
  pixelToHex,
  placePlant,
  updateGame,
} from "../app/rewild-hex-world.ts";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const sameHex = (left, right) => left.q === right.q && left.r === right.r;

function quietState(options = {}) {
  const state = createGameState(0, options.difficulty ?? "normal", "playing", { seed: options.seed ?? 12345, mode: options.mode ?? "siege" });
  state.nodes = [];
  state.enemies = [];
  state.nextWave = 1_000_000;
  for (const cell of state.world.cells.values()) { cell.corruption = 0; cell.source = null; }
  return state;
}

function addPlant(state, kind, hex, overrides = {}) {
  const plant = {
    id: state.nextId++, kind, q: hex.q, r: hex.r, hp: PLANTS[kind].maxHp,
    cooldown: 0, age: 20, reclaimTimer: 0, disabledUntil: 0,
    reclaimTarget: null, reclaimUntil: 0, attackTarget: null, attackUntil: 0,
    ...overrides,
  };
  state.plants.push(plant);
  return plant;
}

function addEnemy(state, kind, hex, overrides = {}) {
  const config = REWILD_ENEMY_BALANCE[kind];
  const enemy = {
    id: state.nextId++, kind, position: hexCenter(hex), hex: { ...hex }, hp: config.hp, maxHp: config.hp,
    speed: config.speed, damage: config.damage, cooldown: 0, pathTimer: 0, path: [], slowUntil: 0, breached: false,
    ...overrides,
  };
  state.enemies.push(enemy);
  return enemy;
}

test("Siege and Endless start from the PR14 economy and two-node contract", () => {
  for (const mode of ["siege", "endless"]) {
    for (const difficulty of ["easy", "normal", "hard"]) {
      const state = createGameState(77, difficulty, "playing", { seed: 17, mode });
      assert.equal(gameMode(state), mode);
      assert.equal(state.sunlight, REWILD_BASELINE.sunlightStart);
      assert.equal(state.houseHp, REWILD_BASELINE.houseHp);
      assert.equal(state.wave, 1);
      assert.equal(state.nextWave, REWILD_BASELINE.firstWaveSeconds);
      assert.equal(state.nodes.length, 2);
      assert.equal(state.best, 77);
    }
  }
  assert.equal(PLANTS.rootreclaimer.unlockWave, 2);
});

test("hex topology exposes six unique shared-border neighbors and picking round-trips rendered centers", () => {
  const interior = { q: 12, r: 6 };
  const neighbors = hexNeighbors(interior);
  assert.equal(neighbors.length, 6);
  assert.equal(new Set(neighbors.map((hex) => `${hex.q},${hex.r}`)).size, 6);
  for (const neighbor of neighbors) assert.equal(hexDistance(interior, neighbor), 1);

  for (const hex of [interior, { q: 5, r: 5 }, { q: 20, r: 8 }]) {
    const center = hexCenter(hex);
    assert.deepEqual(pixelToHex(center.x, center.y), hex);
  }
});

test("base income is one sunlight per second and enabled Sunblooms add two", () => {
  const state = quietState();
  state.sunlight = 0;
  updateGame(state, 1);
  assert.equal(state.sunlight, 1);

  const sun = addPlant(state, "sunbloom", { q: 10, r: 6 });
  updateGame(state, 1);
  assert.equal(state.sunlight, 4);

  sun.disabledUntil = state.elapsed + 10;
  updateGame(state, 1);
  assert.equal(state.sunlight, 5);
});

test("placement enforces original unlock waves and defenders never move", () => {
  const state = quietState();
  state.selected = "rootreclaimer";
  state.sunlight = 1_000;
  const target = [...state.world.cells.values()].find((cell) => cell.surface !== "water" && !HOUSE_FOOTPRINT.some((hex) => sameHex(hex, cell.hex)));
  assert.ok(target);
  target.corruption = 4;
  assert.equal(placePlant(state, target.hex), false);
  state.wave = 2;
  assert.equal(placePlant(state, target.hex), true);
  const planted = state.plants.at(-1);
  const origin = { q: planted.q, r: planted.r };
  for (let tick = 0; tick < 2_000; tick += 1) updateGame(state, .05);
  assert.deepEqual({ q: planted.q, r: planted.r }, origin);
});

test("defenders attack and reclaim automatically with PR14 hex-translated ranges", () => {
  const thornState = quietState();
  addPlant(thornState, "thornbramble", { q: 12, r: 6 });
  const adjacent = hexNeighbors({ q: 12, r: 6 })[0];
  const target = addEnemy(thornState, "clickbait", adjacent);
  updateGame(thornState, .01);
  assert.equal(target.hp, REWILD_ENEMY_BALANCE.clickbait.hp - 4);

  const vineState = quietState();
  const vineHex = { q: 12, r: 6 };
  const bentTarget = [...vineState.world.cells.values()].map((cell) => cell.hex)
    .find((hex) => hexDistance(vineHex, hex) >= 2 && hexDistance(vineHex, hex) <= 3 && hexDirection(vineHex, hex) === null);
  assert.ok(bentTarget, "test map must contain a non-axis target within Vinewhip range");
  addPlant(vineState, "vinewhip", vineHex);
  const bentEnemy = addEnemy(vineState, "deepfake", bentTarget);
  updateGame(vineState, .01);
  assert.equal(bentEnemy.hp, REWILD_ENEMY_BALANCE.deepfake.hp - 8, "Vinewhip must not require a six-axis firing line");

  const rootState = quietState();
  const rootHex = { q: 12, r: 6 };
  const reclaimHex = hexNeighbors(rootHex)[0];
  const root = addPlant(rootState, "rootreclaimer", rootHex, { reclaimTimer: 0 });
  cellAt(rootState.world, reclaimHex).corruption = 4;
  updateGame(rootState, .01);
  assert.equal(cellAt(rootState.world, reclaimHex).corruption, 0);
  assert.equal(root.reclaimTimer, REWILD_BASELINE.rootReclaimSeconds);
});

test("datacenters spread corruption and spawn enemies without construction or health gates", () => {
  const state = createGameState(0, "hard", "playing", { seed: 3 });
  const node = state.nodes[0];
  node.hp = 1;
  node.buildProgress = 0;
  node.spreadTimer = 0;
  node.spawnTimer = 0;
  for (const other of state.nodes.slice(1)) { other.spreadTimer = 999; other.spawnTimer = 999; }
  const before = [...state.world.cells.values()].filter((cell) => cell.corruption > 0).length;

  updateGame(state, .01);

  assert.ok([...state.world.cells.values()].filter((cell) => cell.corruption > 0).length > before);
  assert.equal(state.enemies.length, 1);
  assert.equal(state.enemies[0].hp, REWILD_ENEMY_BALANCE.clickbait.hp);
  assert.equal(state.enemies[0].speed, REWILD_ENEMY_BALANCE.clickbait.speed);
  assert.equal(state.enemies[0].damage, REWILD_ENEMY_BALANCE.clickbait.damage);
});

test("Popup enemies disable defenders and Deepfakes split into two fragments", () => {
  const popupState = quietState();
  const defender = addPlant(popupState, "sunbloom", { q: 12, r: 6 });
  addEnemy(popupState, "popup", hexNeighbors(defender)[0], { cooldown: 0 });
  updateGame(popupState, .01);
  assert.ok(defender.disabledUntil > popupState.elapsed);

  const deepfakeState = quietState();
  addEnemy(deepfakeState, "deepfake", { q: 12, r: 6 }, { hp: 0 });
  updateGame(deepfakeState, .01);
  assert.equal(deepfakeState.enemies.filter((enemy) => enemy.kind === "fragment").length, 2);
});

test("automatic enemy routes advance through one shared hex border and do not contaminate travelled cells", () => {
  const state = quietState();
  const start = { q: 4, r: 6 };
  const enemy = addEnemy(state, "clickbait", start);
  const visited = [start];
  for (let tick = 0; tick < 500 && visited.length < 4; tick += 1) {
    const previous = { ...enemy.hex };
    updateGame(state, .05);
    if (!sameHex(previous, enemy.hex)) visited.push({ ...enemy.hex });
  }
  assert.ok(visited.length >= 3, "enemy should advance automatically");
  for (let index = 1; index < visited.length; index += 1) assert.equal(hexDistance(visited[index - 1], visited[index]), 1);
  for (const hex of visited.slice(1)) assert.equal(cellAt(state.world, hex)?.corruption ?? 0, 0);
});

test("enemies repeatedly attack the house instead of disappearing after one breach", () => {
  const state = quietState();
  state.houseHp = 4;
  const house = HOUSE_FOOTPRINT[0];
  const approach = hexNeighbors(house).find((hex) => !HOUSE_FOOTPRINT.some((part) => sameHex(part, hex)));
  assert.ok(approach);
  const enemy = addEnemy(state, "clickbait", approach, { path: [house], pathTimer: 99, cooldown: 0 });

  updateGame(state, .01);
  assert.equal(state.houseHp, 2);
  assert.ok(state.enemies.includes(enemy));
  updateGame(state, 1.01);
  assert.equal(state.status, "lost");
  assert.equal(state.houseHp, 0);
});

test("corruption reaching the house loses Siege but not Endless", () => {
  for (const mode of ["siege", "endless"]) {
    const state = createGameState(0, "normal", "playing", { seed: 5, mode });
    for (const cell of state.world.cells.values()) {
      cell.corruption = HOUSE_FOOTPRINT.some((house) => sameHex(house, cell.hex)) ? 0 : 4;
      cell.source = null;
    }
    state.nodes[0].spreadTimer = 0;
    state.nodes[0].spawnTimer = 999;
    for (const node of state.nodes.slice(1)) { node.spreadTimer = 999; node.spawnTimer = 999; }
    updateGame(state, .01);
    assert.equal(state.status, mode === "siege" ? "lost" : "playing");
  }
});

test("waves restore PR14 rewards, boss timing, and Endless continuation", () => {
  const siege = quietState();
  siege.wave = 1;
  siege.nextWave = .01;
  siege.sunlight = 0;
  updateGame(siege, .02);
  assert.equal(siege.wave, 2);
  assert.ok(Math.abs(siege.sunlight - (waveSunlightReward(2) + .02)) < 1e-9);
  assert.equal(siege.nodes.length, 1, "even waves add a datacenter");

  siege.nodes = [];
  siege.wave = 4;
  siege.nextWave = .01;
  updateGame(siege, .02);
  assert.equal(siege.wave, 5);
  assert.equal(siege.bossSpawned, true);
  assert.ok(siege.nodes.some((node) => node.boss));

  const endless = quietState({ mode: "endless" });
  endless.wave = 5;
  endless.nextWave = .01;
  updateGame(endless, .02);
  assert.equal(endless.wave, 6);
  assert.equal(endless.status, "playing");
  assert.ok(endless.nodes.some((node) => node.boss));
});

test("Siege victory applies the original score bonus and persists best score", () => {
  const previousStorage = globalThis.localStorage;
  const writes = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: (key, value) => writes.set(key, value) } });
  try {
    const state = quietState();
    state.bossSpawned = true;
    state.houseHp = 80;
    state.score = 100;
    updateGame(state, .01);
    assert.equal(state.status, "won");
    assert.equal(state.score, 100 + REWILD_BASELINE.winScore + 80 * REWILD_BASELINE.houseHealthScoreMultiplier);
    assert.equal(state.best, state.score);
    assert.equal(writes.get(REWILD_STORAGE_KEY), String(state.score));
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage });
  }
});

test("pause is the active-run state that stops continuous simulation advancement", () => {
  const state = quietState();
  state.status = "paused";
  updateGame(state, 10);
  assert.equal(state.elapsed, 0);
  state.status = "playing";
  updateGame(state, .5);
  assert.equal(state.elapsed, .5);
});

test("the frozen runtime has no tactical turn or manual action command surface", async () => {
  const simulationSource = await readFile(projectFile("app/rewild-simulation.ts"), "utf8");
  for (const forbidden of ["actionPoints", "selectedUnit", "endTurn", "moveUnit", "PLAYER PHASE", "END TURN"]) assert.doesNotMatch(simulationSource, new RegExp(forbidden, "i"));
  assert.doesNotMatch(simulationSource, /roadBoost|stepCost|updateEcosystem|facilityOperational|hexDirection\(plant/);
  assert.match(simulationSource, /for \(const neighbor of hexNeighbors\(current\)\)/);
  assert.match(simulationSource, /disabledUntil = state\.elapsed \+ REWILD_BASELINE\.popupDisableSeconds/);
  assert.equal(ENEMIES.popup.damage, 4);
});
