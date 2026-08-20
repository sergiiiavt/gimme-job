import {
  BORDER_SPAWNS,
  ENEMIES,
  HOUSE_CENTER,
  HOUSE_FOOTPRINT,
  HEX_HEIGHT,
  PLANTS as LEGACY_PLANTS,
  biomeAt,
  cellAt,
  createFacilityFootprint,
  createGameState as createLegacyGameState,
  hexCenter,
  hexDistance,
  hexKey,
  hexNeighbors,
  objectAt,
  sameHex,
  toUi as legacyToUi,
  type DataNode,
  type Difficulty,
  type EnemyEntity,
  type EnemyKind,
  type GameState,
  type GameStatus,
  type HexCoord,
  type PlantEntity,
  type PlantKind,
  type UiSnapshot,
} from "./rewild-world-legacy.ts";
import {
  REWILD_BASELINE,
  REWILD_ENEMY_BALANCE,
  REWILD_PLANT_BALANCE,
  REWILD_STORAGE_KEY,
  waveSeconds,
  waveSunlightReward,
} from "./rewild-balance.ts";

export type RewildMode = "siege" | "endless";
export type RandomSource = () => number;
export interface RewildSimulationOptions { mode?: RewildMode; random?: RandomSource; seed?: number }

interface SimulationContext { mode: RewildMode; random: RandomSource }
const simulationContexts = new WeakMap<GameState, SimulationContext>();

export const PLANTS = {
  ...LEGACY_PLANTS,
  rootreclaimer: { ...LEGACY_PLANTS.rootreclaimer, unlockWave: REWILD_PLANT_BALANCE.rootreclaimer.unlockWave },
};

export function createSeededRandom(seed = 1): RandomSource {
  let value = seed >>> 0 || 1;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function contextFor(state: GameState): SimulationContext {
  let context = simulationContexts.get(state);
  if (!context) {
    context = { mode: "siege", random: Math.random };
    simulationContexts.set(state, context);
  }
  return context;
}

export function gameMode(state: GameState) {
  return contextFor(state).mode;
}

function randomFor(state: GameState) {
  return contextFor(state).random;
}

function nextId(state: GameState) {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function mechanicalNodeAt(state: GameState, hex: HexCoord) {
  return state.nodes.find((node) => sameHex(node.anchor, hex));
}

function roadAt(state: GameState, hex: HexCoord) {
  return state.world.road.cells.some((road) => sameHex(road, hex));
}

function logicalSurface(state: GameState, hex: HexCoord) {
  const cell = cellAt(state.world, hex);
  if (!cell) return null;
  if (cell.surface === "foundation" && !mechanicalNodeAt(state, hex)) return roadAt(state, hex) ? "road" : "meadow";
  return cell.surface;
}

function blockedBiome(state: GameState, hex: HexCoord) {
  const kind = biomeAt(state.world, hex)?.kind;
  return kind === "forest" || kind === "water" || kind === "rock" || kind === "flowers";
}

function blockedWorldObject(state: GameState, hex: HexCoord) {
  const object = objectAt(state.world, hex, true);
  return Boolean(object && object.kind !== "house");
}

function isPathBlocked(state: GameState, hex: HexCoord) {
  if (HOUSE_FOOTPRINT.some((house) => sameHex(house, hex))) return false;
  if (mechanicalNodeAt(state, hex)) return true;
  const surface = logicalSurface(state, hex);
  return !surface || surface === "water" || blockedBiome(state, hex) || blockedWorldObject(state, hex);
}

function setMessage(state: GameState, message: string, seconds = 2.6) {
  state.message = message;
  state.messageUntil = state.elapsed + seconds;
}

function resetNodeTimers(state: GameState, node: DataNode) {
  const random = randomFor(state);
  node.spreadTimer = node.boss ? 5 : 13 + random() * 3;
  node.spawnTimer = node.boss ? 3 : 11 + random() * 3;
  node.buildProgress = 0;
  node.hp = node.boss ? 800 : 150;
  node.maxHp = node.boss ? 800 : 150;
  for (const hex of node.footprint) {
    const cell = cellAt(state.world, hex);
    if (!cell) continue;
    cell.corruption = sameHex(hex, node.anchor) ? 4 : 0;
    cell.source = sameHex(hex, node.anchor) ? node.id : null;
  }
}

export function createGameState(
  best: number,
  difficulty: Difficulty = "normal",
  status: GameStatus = "playing",
  options: RewildSimulationOptions = {},
): GameState {
  const state = createLegacyGameState(best, difficulty, status);
  const random = options.random ?? (options.seed === undefined ? Math.random : createSeededRandom(options.seed));
  simulationContexts.set(state, { mode: options.mode ?? "siege", random });
  state.sunlight = REWILD_BASELINE.sunlightStart;
  state.houseHp = REWILD_BASELINE.houseHp;
  state.wave = 1;
  state.nextWave = REWILD_BASELINE.firstWaveSeconds;
  state.elapsed = 0;
  state.score = 0;
  state.bossSpawned = false;
  state.ruins = [];
  state.beams = [];
  state.effects = [];
  for (const node of state.nodes) resetNodeTimers(state, node);
  return state;
}

export function findPath(state: GameState, start: HexCoord) {
  const startKey = hexKey(start);
  const houseKeys = new Set(HOUSE_FOOTPRINT.map(hexKey));
  const queue: HexCoord[] = [start];
  const previous = new Map<string, string | null>([[startKey, null]]);
  let target: string | null = null;

  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = hexKey(current);
    if (houseKeys.has(currentKey)) { target = currentKey; break; }
    for (const neighbor of hexNeighbors(current)) {
      const key = hexKey(neighbor);
      if (previous.has(key) || isPathBlocked(state, neighbor)) continue;
      previous.set(key, currentKey);
      queue.push(neighbor);
    }
  }

  if (!target) return [];
  const path: HexCoord[] = [];
  for (let cursor: string | null = target; cursor && cursor !== startKey; cursor = previous.get(cursor) ?? null) {
    const [q, r] = cursor.split(",").map(Number);
    path.unshift({ q, r });
  }
  return path;
}

function addBeam(state: GameState, from: { x: number; y: number }, to: { x: number; y: number }, color: string) {
  state.beams.push({ from, to, color, life: .18, maxLife: .18 });
}

function targetHex(target: EnemyEntity | DataNode) {
  return "kind" in target ? target.hex : target.anchor;
}

function targetPosition(target: EnemyEntity | DataNode) {
  return "kind" in target ? target.position : hexCenter(target.anchor);
}

function damageTarget(state: GameState, plant: PlantEntity, target: EnemyEntity | DataNode, damage: number, color: string) {
  target.hp -= damage;
  addBeam(state, hexCenter(plant), targetPosition(target), color);
  plant.attackTarget = targetHex(target);
  plant.attackUntil = state.elapsed + .18;
}

function combatTargets(state: GameState, plant: PlantEntity, radius: number) {
  return [...state.enemies, ...state.nodes]
    .filter((target) => target.hp > 0)
    .filter((target) => hexDistance(plant, targetHex(target)) <= radius);
}

function reclaimNear(state: GameState, plant: PlantEntity) {
  const target = [...state.world.cells.values()]
    .filter((cell) => cell.corruption > 0 && !mechanicalNodeAt(state, cell.hex) && hexDistance(plant, cell.hex) <= REWILD_PLANT_BALANCE.rootreclaimer.range)
    .sort((left, right) => hexDistance(plant, left.hex) - hexDistance(plant, right.hex))[0];
  if (!target) return;
  target.corruption = 0;
  target.source = null;
  plant.reclaimTarget = target.hex;
  plant.reclaimUntil = state.elapsed + .7;
  state.score += 6;
  addBeam(state, hexCenter(plant), hexCenter(target.hex), "#a9e37d");
}

function updatePlants(state: GameState, dt: number) {
  for (const plant of state.plants) {
    plant.age += dt;
    plant.cooldown -= dt;
    if (plant.attackUntil <= state.elapsed) plant.attackTarget = null;
    if (plant.reclaimUntil <= state.elapsed) plant.reclaimTarget = null;
    if (plant.disabledUntil > state.elapsed) continue;

    if (plant.kind === "rootreclaimer") {
      plant.reclaimTimer -= dt;
      if (plant.reclaimTimer <= 0) {
        reclaimNear(state, plant);
        plant.reclaimTimer = REWILD_BASELINE.rootReclaimSeconds;
      }
      continue;
    }
    if (plant.cooldown > 0 || plant.kind === "sunbloom") continue;

    if (plant.kind === "thornbramble") {
      const config = REWILD_PLANT_BALANCE.thornbramble;
      for (const target of combatTargets(state, plant, config.range)) damageTarget(state, plant, target, config.damage, "#a9d45c");
      plant.cooldown = config.cooldown;
    } else if (plant.kind === "sporecap") {
      const config = REWILD_PLANT_BALANCE.sporecap;
      for (const target of combatTargets(state, plant, config.range)) damageTarget(state, plant, target, config.damage, "#d7a8ec");
      plant.cooldown = config.cooldown;
    } else if (plant.kind === "vinewhip") {
      const config = REWILD_PLANT_BALANCE.vinewhip;
      const target = combatTargets(state, plant, config.range)[0];
      if (target) {
        damageTarget(state, plant, target, config.damage, "#77bd4a");
        if ("kind" in target) target.slowUntil = state.elapsed + config.slowSeconds;
      }
      plant.cooldown = config.cooldown;
    } else if (plant.kind === "elderoak" && plant.age >= REWILD_PLANT_BALANCE.elderoak.matureSeconds) {
      const config = REWILD_PLANT_BALANCE.elderoak;
      for (const target of combatTargets(state, plant, config.range)) damageTarget(state, plant, target, config.damage, "#d8ba68");
      plant.cooldown = config.cooldown;
    }
  }
}

function externalFacilityOutlet(anchor: HexCoord, footprint: HexCoord[]) {
  const footprintKeys = new Set(footprint.map(hexKey));
  const candidates = footprint
    .flatMap(hexNeighbors)
    .filter((hex, index, list) => !footprintKeys.has(hexKey(hex)) && list.findIndex((candidate) => sameHex(candidate, hex)) === index)
    .sort((left, right) => hexDistance(left, HOUSE_CENTER) - hexDistance(right, HOUSE_CENTER));
  return candidates[0] ?? anchor;
}

function createNode(state: GameState, anchor: HexCoord, boss = false) {
  const id = nextId(state);
  const footprint = createFacilityFootprint(anchor, boss);
  for (const hex of footprint) {
    const cell = cellAt(state.world, hex);
    if (!cell) continue;
    cell.surface = "foundation";
    cell.corruption = sameHex(hex, anchor) ? 4 : 0;
    cell.source = sameHex(hex, anchor) ? id : null;
  }
  const node: DataNode = {
    id,
    anchor,
    hp: boss ? 800 : 150,
    maxHp: boss ? 800 : 150,
    spreadTimer: 0,
    spawnTimer: 0,
    boss,
    buildProgress: 0,
    footprint,
    outlet: externalFacilityOutlet(anchor, footprint),
  };
  state.nodes.push(node);
  resetNodeTimers(state, node);
}

function spawnEnemy(state: GameState, node: DataNode, kind: EnemyKind, offset = 0) {
  if (state.enemies.length >= 70) return;
  const config = REWILD_ENEMY_BALANCE[kind];
  const position = hexCenter(node.outlet);
  state.enemies.push({
    id: nextId(state),
    kind,
    position: { x: position.x + offset * 4, y: position.y + offset * 3 },
    hex: node.outlet,
    hp: config.hp,
    maxHp: config.hp,
    speed: config.speed,
    damage: config.damage,
    cooldown: .4,
    pathTimer: 0,
    path: [],
    slowUntil: 0,
    breached: false,
  });
}

function spawnEnemyAt(state: GameState, kind: EnemyKind, enemy: EnemyEntity, offset: number) {
  const config = REWILD_ENEMY_BALANCE[kind];
  state.enemies.push({
    id: nextId(state),
    kind,
    position: { x: enemy.position.x + offset, y: enemy.position.y },
    hex: { ...enemy.hex },
    hp: config.hp,
    maxHp: config.hp,
    speed: config.speed,
    damage: config.damage,
    cooldown: .4,
    pathTimer: 0,
    path: [],
    slowUntil: 0,
    breached: false,
  });
}

function spawnFromNode(state: GameState, node: DataNode) {
  const roll = randomFor(state)();
  const kind: EnemyKind = state.wave >= 3 && roll > .72 ? "popup" : state.wave >= 2 && roll > .45 ? "deepfake" : "clickbait";
  const count = kind === "clickbait" ? Math.min(1 + Math.floor(state.wave / 3), 3) : 1;
  for (let index = 0; index < count; index += 1) spawnEnemy(state, node, kind, index);
}

function isCorruptible(state: GameState, hex: HexCoord) {
  if (HOUSE_FOOTPRINT.some((house) => sameHex(house, hex))) return true;
  const surface = logicalSurface(state, hex);
  return (surface === "meadow" || surface === "road") && !blockedBiome(state, hex) && !blockedWorldObject(state, hex);
}

function finishGame(state: GameState, status: "won" | "lost", message: string) {
  if (state.status === "won" || state.status === "lost") return;
  state.status = status;
  state.message = message;
  if (status === "won") state.score += REWILD_BASELINE.winScore + Math.round(state.houseHp * REWILD_BASELINE.houseHealthScoreMultiplier);
  state.best = Math.max(state.best, state.score);
  try { globalThis.localStorage?.setItem(REWILD_STORAGE_KEY, String(state.best)); } catch { /* local persistence is optional */ }
}

function spreadCorruption(state: GameState) {
  const candidates = new Map<string, HexCoord>();
  for (const source of state.world.cells.values()) {
    if (source.corruption <= 0) continue;
    for (const neighbor of hexNeighbors(source.hex)) if (isCorruptible(state, neighbor) && cellAt(state.world, neighbor)?.corruption === 0) candidates.set(hexKey(neighbor), neighbor);
  }
  const frontier = [...candidates.values()];
  if (!frontier.length) return;
  const target = frontier[Math.floor(randomFor(state)() * frontier.length)];
  if (HOUSE_FOOTPRINT.some((house) => sameHex(house, target))) {
    if (gameMode(state) === "siege") finishGame(state, "lost", "Corruption reached the garden gate.");
    return;
  }
  if (state.plants.some((plant) => sameHex(plant, target))) return;
  const cell = cellAt(state.world, target);
  if (cell) { cell.corruption = 4; cell.source = null; }
}

function updateNodes(state: GameState, dt: number) {
  for (const node of state.nodes) {
    node.buildProgress += dt;
    node.spreadTimer -= dt;
    node.spawnTimer -= dt;
    if (node.spreadTimer <= 0) {
      spreadCorruption(state);
      node.spreadTimer = node.boss ? 5.5 : Math.max(8, 14 - state.wave * .45);
    }
    if (node.spawnTimer <= 0) {
      spawnFromNode(state, node);
      node.spawnTimer = node.boss ? 3.4 : Math.max(8, 13 - state.wave * .4);
    }
  }
}

function attackPlantOrHouse(state: GameState, enemy: EnemyEntity, target: HexCoord) {
  const plant = state.plants.find((candidate) => sameHex(candidate, target));
  if (plant) {
    if (enemy.cooldown <= 0) {
      plant.hp -= enemy.damage;
      enemy.cooldown = REWILD_BASELINE.enemyAttackCooldown;
      addBeam(state, enemy.position, hexCenter(plant), "#c8ff45");
    }
    return true;
  }
  if (HOUSE_FOOTPRINT.some((house) => sameHex(house, target))) {
    if (enemy.cooldown <= 0) {
      const nextHp = state.houseHp - enemy.damage;
      state.houseHp = gameMode(state) === "endless" ? Math.max(1, nextHp) : Math.max(0, nextHp);
      enemy.cooldown = REWILD_BASELINE.houseAttackCooldown;
      addBeam(state, enemy.position, hexCenter(target), "#f36c76");
      if (state.houseHp <= 0) finishGame(state, "lost", "The house was flattened by aggressively mediocre content.");
    }
    return true;
  }
  return false;
}

function updateEnemies(state: GameState, dt: number) {
  for (const enemy of state.enemies) {
    enemy.pathTimer -= dt;
    if (enemy.kind === "popup" && enemy.cooldown <= 0) {
      const nearby = state.plants.find((plant) => hexDistance(enemy.hex, plant) <= 3);
      if (nearby) {
        nearby.disabledUntil = state.elapsed + REWILD_BASELINE.popupDisableSeconds;
        enemy.cooldown = REWILD_BASELINE.popupAbilityCooldown;
        addBeam(state, enemy.position, hexCenter(nearby), "#ff8dcb");
        setMessage(state, `${PLANTS[nearby.kind].name} closed an extremely persistent popup.`);
        continue;
      }
    }
    enemy.cooldown -= dt;
    if (HOUSE_FOOTPRINT.some((house) => sameHex(house, enemy.hex))) {
      attackPlantOrHouse(state, enemy, enemy.hex);
      continue;
    }
    if (enemy.pathTimer <= 0 || !enemy.path.length) {
      enemy.path = findPath(state, enemy.hex);
      enemy.pathTimer = REWILD_BASELINE.pathRefreshSeconds;
    }
    const next = enemy.path[0];
    if (!next) continue;
    if (attackPlantOrHouse(state, enemy, next)) continue;
    const target = hexCenter(next);
    const dx = target.x - enemy.position.x;
    const dy = target.y - enemy.position.y;
    const distance = Math.max(.001, Math.hypot(dx, dy));
    const slow = enemy.slowUntil > state.elapsed ? .7 : 1;
    const travel = enemy.speed * HEX_HEIGHT * slow * dt;
    if (distance <= travel || distance < 1) {
      enemy.position = target;
      enemy.hex = next;
      enemy.path.shift();
      attackPlantOrHouse(state, enemy, next);
    } else {
      enemy.position.x += dx / distance * travel;
      enemy.position.y += dy / distance * travel;
    }
  }
}

function baseSurfaceFor(state: GameState, hex: HexCoord) {
  return roadAt(state, hex) ? "road" as const : "meadow" as const;
}

function resolveDeaths(state: GameState) {
  const deadEnemies = state.enemies.filter((enemy) => enemy.hp <= 0);
  for (const enemy of deadEnemies) {
    state.score += enemy.kind === "deepfake" ? 35 : enemy.kind === "popup" ? 25 : 12;
    if (enemy.kind === "deepfake") {
      spawnEnemyAt(state, "fragment", enemy, -5);
      spawnEnemyAt(state, "fragment", enemy, 5);
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  const deadNodes = state.nodes.filter((node) => node.hp <= 0);
  for (const node of deadNodes) {
    for (const hex of node.footprint) {
      const cell = cellAt(state.world, hex);
      if (!cell) continue;
      cell.surface = baseSurfaceFor(state, hex);
      cell.source = null;
      cell.corruption = sameHex(hex, node.anchor) ? 4 : 0;
    }
    state.score += node.boss ? 800 : 180;
    setMessage(state, node.boss ? "The Mainframe Core has logged off forever." : "Datacenter composted. The uptime graph looks terrible.", 4);
  }
  state.nodes = state.nodes.filter((node) => node.hp > 0);
  state.plants = state.plants.filter((plant) => plant.hp > 0);
  state.ruins = [];
}

function addWaveNode(state: GameState, boss = false) {
  const available = BORDER_SPAWNS.filter((hex) => !mechanicalNodeAt(state, hex) && !state.plants.some((plant) => sameHex(plant, hex)));
  if (!available.length) return;
  const anchor = available[Math.floor(randomFor(state)() * available.length)];
  createNode(state, anchor, boss);
  setMessage(state, boss ? "MAINFRAME CORE ONLINE. It has a very normal number of eyes." : "A new datacenter has achieved unwanted product-market fit.", 4);
}

function advanceWave(state: GameState) {
  state.wave += 1;
  state.nextWave = waveSeconds(state.wave);
  state.sunlight += waveSunlightReward(state.wave);
  setMessage(state, `Wave ${state.wave}: the algorithm has discovered scale.`, 3.5);
  if (state.wave % 2 === 0) addWaveNode(state);
  if (gameMode(state) === "siege" && state.wave === REWILD_BASELINE.siegeBossWave && !state.bossSpawned) {
    state.bossSpawned = true;
    addWaveNode(state, true);
  } else if (gameMode(state) === "endless" && state.wave % 6 === 0) {
    addWaveNode(state, true);
  }
}

function fieldCell(state: GameState, hex: HexCoord) {
  const surface = logicalSurface(state, hex);
  if (surface !== "meadow" && surface !== "road" && surface !== "foundation") return false;
  return !blockedBiome(state, hex) && !blockedWorldObject(state, hex);
}

export function corruptionPercent(state: GameState) {
  const field = [...state.world.cells.values()].filter((cell) => fieldCell(state, cell.hex));
  const corrupted = field.filter((cell) => cell.corruption > 0);
  return field.length ? Math.round(corrupted.length / field.length * 100) : 0;
}

export function updateGame(state: GameState, dt: number) {
  if (state.status !== "playing" || state.reviewState || dt <= 0) return;
  state.elapsed += dt;
  state.nextWave -= dt;
  const sunblooms = state.plants.filter((plant) => plant.kind === "sunbloom" && plant.disabledUntil <= state.elapsed).length;
  state.sunlight += (REWILD_BASELINE.sunlightPerSecond + sunblooms * REWILD_BASELINE.sunbloomPerSecond) * dt;
  if (state.nextWave <= 0) advanceWave(state);
  updateNodes(state, dt);
  updatePlants(state, dt);
  updateEnemies(state, dt);
  for (const beam of state.beams) beam.life -= dt;
  state.beams = state.beams.filter((beam) => beam.life > 0);
  resolveDeaths(state);

  if (gameMode(state) === "siege" && state.bossSpawned && state.nodes.length === 0 && state.enemies.length === 0 && corruptionPercent(state) === 0) {
    finishGame(state, "won", "The field is alive again. Please refrain from pivoting it into a platform.");
  } else if (state.elapsed > state.messageUntil) {
    state.message = "Grow something useful.";
  }
}

function placementBlocked(state: GameState, hex: HexCoord) {
  return mechanicalNodeAt(state, hex)
    || state.plants.some((plant) => sameHex(plant, hex))
    || blockedBiome(state, hex)
    || blockedWorldObject(state, hex)
    || HOUSE_FOOTPRINT.some((house) => sameHex(house, hex));
}

export function placePlant(state: GameState, hex: HexCoord) {
  if (state.status !== "playing" || !cellAt(state.world, hex) || placementBlocked(state, hex)) return false;
  const config = PLANTS[state.selected];
  if (state.wave < config.unlockWave) { setMessage(state, `${config.name} unlocks at wave ${config.unlockWave}.`); return false; }
  if (state.sunlight < config.cost) { setMessage(state, `Not enough sunlight for ${config.name}.`); return false; }
  const cell = cellAt(state.world, hex)!;
  const healthyGround = logicalSurface(state, hex) === "meadow" || logicalSurface(state, hex) === "road";
  const valid = state.selected === "rootreclaimer" ? cell.corruption > 0 : healthyGround && cell.corruption === 0;
  if (!valid) {
    setMessage(state, state.selected === "rootreclaimer" ? "Rootreclaimers need corrupted ground." : `Can't plant ${config.name} here.`);
    return false;
  }
  state.sunlight -= config.cost;
  state.plants.push({
    id: nextId(state), kind: state.selected, q: hex.q, r: hex.r, hp: config.maxHp,
    cooldown: .2, age: 0, reclaimTimer: REWILD_BASELINE.rootReclaimSeconds, disabledUntil: 0,
    reclaimTarget: null, reclaimUntil: 0, attackTarget: null, attackUntil: 0,
  });
  setMessage(state, `${config.name} planted.`);
  return true;
}

export function toUi(state: GameState): UiSnapshot {
  const snapshot = legacyToUi(state);
  return {
    ...snapshot,
    houseHp: Math.max(0, Math.round(state.houseHp)),
    houseIntegrity: Math.max(0, Math.round(state.houseHp / REWILD_BASELINE.houseHp * 100)),
    corruption: corruptionPercent(state),
  };
}
