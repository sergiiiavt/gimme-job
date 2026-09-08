const DEFAULT_SEED = 0x6d2b79f5;
const GOLDEN_RATIO_32 = 0x9e3779b9;

/** @typedef {{x:number,y:number,w:number,h:number}} GeneratedRect */
/** @typedef {{x:number,y:number,w:number,h:number,minX:number,maxX:number,vx:number}} GeneratedEnemySpawn */
/** @typedef {{x:number,y:number}} SpawnPoint */
/** @typedef {{seed:number,platforms:GeneratedRect[],spawnTemplates:GeneratedEnemySpawn[],playerSpawn:SpawnPoint}} PlatformBattlefield */
/** @typedef {{x:number,y:number,radius:number,surfaceGravity:number,fill:string,edge:string}} GravityPlanetSpec */
/** @typedef {{x:number,y:number,radius:number,fireEvery:number}} GravityEnemySpec */
/** @typedef {{x:number,y:number,radius:number,health:number,maxHealth:number,fireEvery:number}} GravityStationSpec */
/** @typedef {{seed:number,shipSpawn:{x:number,y:number,angle:number},planets:GravityPlanetSpec[],baseAngles:number[],enemies:GravityEnemySpec[],stations:GravityStationSpec[]}} GravityBattlefield */

function normalizeSeed(seed) {
  const normalized = Number(seed) >>> 0;
  return normalized === 0 ? DEFAULT_SEED : normalized;
}

function mixSeed(seed, salt) {
  let value = (normalizeSeed(seed) ^ ((Number(salt) >>> 0) + GOLDEN_RATIO_32)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return normalizeSeed(value);
}

export function randomBattlefieldSeed(salt = 0) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return mixSeed(values[0], salt);
  }
  return mixSeed(Date.now() >>> 0, salt);
}

function seededRandom(seed) {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function randomInt(rng, min, max) {
  return Math.floor(randomBetween(rng, min, max + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(rng, values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function intervalGap(a, b) {
  if (a.x + a.w < b.x) return b.x - (a.x + a.w);
  if (b.x + b.w < a.x) return a.x - (b.x + b.w);
  return 0;
}

function canReachPlatform(from, to) {
  const rise = from.y - to.y;
  const gap = intervalGap(from, to);
  if (rise >= 0) return rise <= 195 && gap <= 300;
  return -rise <= 345 && gap <= 430;
}

function reachablePlatformIndexes(platforms) {
  const reachable = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const fromIndex = queue.shift();
    if (fromIndex === undefined) break;
    for (let index = 0; index < platforms.length; index += 1) {
      if (reachable.has(index)) continue;
      if (!canReachPlatform(platforms[fromIndex], platforms[index])) continue;
      reachable.add(index);
      queue.push(index);
    }
  }
  return reachable;
}

function generateGround(rng, worldWidth, worldHeight) {
  const gapA = randomInt(rng, 95, 145);
  const gapB = randomInt(rng, 95, 145);
  const available = worldWidth - gapA - gapB;
  const widthA = randomInt(rng, 440, 555);
  const widthB = randomInt(rng, 430, 555);
  const widthC = available - widthA - widthB;
  if (widthC < 360) return null;
  const y = worldHeight - 45;
  return [
    { x: 0, y, w: widthA, h: 45 },
    { x: widthA + gapA, y, w: widthB, h: 45 },
    { x: widthA + gapA + widthB + gapB, y, w: widthC, h: 45 },
  ];
}

function overlapsWithPadding(candidate, others, padding) {
  return others.some((other) => (
    candidate.x < other.x + other.w + padding
    && candidate.x + candidate.w + padding > other.x
    && candidate.y < other.y + other.h + padding
    && candidate.y + candidate.h + padding > other.y
  ));
}

function buildPlatformLayout(seed, worldWidth, worldHeight) {
  const rng = seededRandom(seed);
  const ground = generateGround(rng, worldWidth, worldHeight);
  if (!ground) return null;
  const platforms = [...ground];
  let previousRow = ground;
  const groundY = worldHeight - 45;

  for (let tier = 0; tier < 5; tier += 1) {
    const targetY = groundY - (tier + 1) * 128 + randomInt(rng, -18, 18);
    const row = [];
    for (let band = 0; band < 3; band += 1) {
      const width = randomInt(rng, 190, 285);
      const bandMin = band * worldWidth / 3 + 28;
      const bandMax = (band + 1) * worldWidth / 3 - width - 28;
      let candidate = null;

      for (let attempt = 0; attempt < 24; attempt += 1) {
        const proposed = {
          x: randomBetween(rng, bandMin, Math.max(bandMin, bandMax)),
          y: targetY + randomInt(rng, -16, 16),
          w: width,
          h: 16,
        };
        if (!previousRow.some((parent) => canReachPlatform(parent, proposed))) continue;
        if (overlapsWithPadding(proposed, row, 42)) continue;
        candidate = proposed;
        break;
      }

      if (!candidate) {
        const parent = previousRow[band % previousRow.length];
        const parentCenter = parent.x + parent.w / 2;
        const center = clamp(
          parentCenter + randomInt(rng, -190, 190),
          width / 2 + 24,
          worldWidth - width / 2 - 24,
        );
        candidate = { x: center - width / 2, y: targetY, w: width, h: 16 };
      }
      row.push(candidate);
      platforms.push(candidate);
    }
    previousRow = row;
  }

  const reachable = reachablePlatformIndexes(platforms);
  if (reachable.size < 16) return null;
  return { rng, platforms, reachable };
}

/**
 * Generates a platform arena from a seeded reachability graph. Each tier is
 * anchored to the tier below, then a conservative jump graph is validated.
 * Enemy spawns are selected only from nodes reachable from the starting ground.
 * @returns {PlatformBattlefield}
 */
export function generatePlatformBattlefield(seed, worldWidth = 1920, worldHeight = 960) {
  const normalizedSeed = normalizeSeed(seed);
  let layout = null;
  let acceptedSeed = normalizedSeed;
  for (let attempt = 0; attempt < 32 && !layout; attempt += 1) {
    acceptedSeed = mixSeed(normalizedSeed, attempt);
    layout = buildPlatformLayout(acceptedSeed, worldWidth, worldHeight);
  }
  if (!layout) throw new Error("Unable to generate a reachable platform battlefield");

  const spawnCandidates = shuffle(
    layout.rng,
    layout.platforms
      .map((platform, index) => ({ platform, index }))
      .filter(({ platform, index }) => (
        layout.reachable.has(index)
        && platform.w >= 150
        && !(index === 0 && platform.x < 240)
      )),
  );
  if (spawnCandidates.length < 12) throw new Error("Platform battlefield has too few reachable enemy spawns");

  const spawnTemplates = spawnCandidates.slice(0, 12).map(({ platform }, index) => {
    const minX = platform.x + 10;
    const maxX = platform.x + platform.w - 10;
    const x = clamp(randomBetween(layout.rng, minX + 6, maxX - 32), minX, maxX - 26);
    const speed = randomInt(layout.rng, 62, 84) * (index % 2 === 0 ? 1 : -1);
    return { x, y: platform.y - 32, w: 26, h: 32, minX, maxX, vx: speed };
  });

  return {
    seed: acceptedSeed,
    platforms: layout.platforms,
    spawnTemplates,
    playerSpawn: { x: 46, y: layout.platforms[0].y - 42 },
  };
}

const PLANET_PALETTE = [
  ["#36505d", "#79929d"],
  ["#594c62", "#9b879f"],
  ["#4c5740", "#85956d"],
  ["#5b463d", "#9c7768"],
  ["#3d5364", "#718da2"],
  ["#4f455e", "#897aa0"],
  ["#52533a", "#96956c"],
];

function circleClear(candidate, planets, clearance) {
  return planets.every((planet) => (
    Math.hypot(candidate.x - planet.x, candidate.y - planet.y)
      >= candidate.radius + planet.radius + clearance
  ));
}

function generatePlanetLayout(seed, worldWidth, worldHeight, shipSpawn) {
  const rng = seededRandom(seed);
  const colors = shuffle(rng, PLANET_PALETTE);
  const planets = [];
  for (let index = 0; index < 5; index += 1) {
    let accepted = null;
    for (let attempt = 0; attempt < 220; attempt += 1) {
      const radius = randomInt(rng, 180, 320);
      const edgeMargin = radius + 340;
      const candidate = {
        x: randomBetween(rng, edgeMargin, worldWidth - edgeMargin),
        y: randomBetween(rng, edgeMargin, worldHeight - edgeMargin),
        radius,
      };
      if (Math.hypot(candidate.x - shipSpawn.x, candidate.y - shipSpawn.y) < radius + 780) continue;
      if (!circleClear(candidate, planets, 430)) continue;
      accepted = candidate;
      break;
    }
    if (!accepted) return null;
    const [fill, edge] = colors[index % colors.length];
    planets.push({
      ...accepted,
      surfaceGravity: Math.round(145 + (accepted.radius - 180) * 0.82 + randomInt(rng, 0, 26)),
      fill,
      edge,
    });
  }
  return { rng, planets };
}

function angleDistance(a, b) {
  const raw = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(raw, Math.PI * 2 - raw);
}

function stationCandidateClear(x, y, planets, stations) {
  if (planets.some((planet) => Math.hypot(x - planet.x, y - planet.y) < planet.radius + 95)) return false;
  if (stations.some((station) => Math.hypot(x - station.x, y - station.y) < 190)) return false;
  return true;
}

function fallbackPlanetLayout(seed, worldWidth, worldHeight, shipSpawn) {
  const rng = seededRandom(mixSeed(seed, 0xfa11ba));
  const anchors = [
    [0.26, 0.48],
    [0.48, 0.24],
    [0.65, 0.67],
    [0.84, 0.35],
    [0.36, 0.83],
  ];
  const colors = shuffle(rng, PLANET_PALETTE);
  const planets = anchors.map(([xRatio, yRatio], index) => {
    const radius = randomInt(rng, 185, 285);
    const x = clamp(
      worldWidth * xRatio + randomInt(rng, -90, 90),
      radius + 260,
      worldWidth - radius - 260,
    );
    const y = clamp(
      worldHeight * yRatio + randomInt(rng, -80, 80),
      radius + 260,
      worldHeight - radius - 260,
    );
    const [fill, edge] = colors[index];
    return { x, y, radius, surfaceGravity: Math.round(155 + (radius - 180) * 0.8), fill, edge };
  });
  if (planets.some((planet) => Math.hypot(planet.x - shipSpawn.x, planet.y - shipSpawn.y) < planet.radius + 620)) {
    shipSpawn.x = 650;
    shipSpawn.y = 520;
  }
  return { rng, planets };
}

/**
 * Generates a gravity arena using rejection sampling with explicit exclusion
 * zones: a safe player spawn, separated planets, valid orbital station slots,
 * and open-space enemy spawns. A deterministic fallback layout prevents a bad
 * random sequence from blocking game creation.
 * @returns {GravityBattlefield}
 */
export function generateGravityBattlefield(seed, worldWidth = 5200, worldHeight = 3400) {
  const normalizedSeed = normalizeSeed(seed);
  const seedRng = seededRandom(normalizedSeed);
  const shipSpawn = {
    x: randomInt(seedRng, 560, 840),
    y: randomInt(seedRng, 500, 790),
    angle: randomBetween(seedRng, -Math.PI, Math.PI),
  };

  let layout = null;
  let acceptedSeed = normalizedSeed;
  for (let attempt = 0; attempt < 36 && !layout; attempt += 1) {
    acceptedSeed = mixSeed(normalizedSeed, attempt);
    layout = generatePlanetLayout(acceptedSeed, worldWidth, worldHeight, shipSpawn);
  }
  if (!layout) layout = fallbackPlanetLayout(acceptedSeed, worldWidth, worldHeight, shipSpawn);

  const { rng, planets } = layout;
  const baseAngles = planets.map(() => randomBetween(rng, 0, Math.PI * 2));
  const stationPlanetIndexes = shuffle(rng, planets.map((_, index) => index)).slice(0, 4);
  const stations = [];

  for (const planetIndex of stationPlanetIndexes) {
    const planet = planets[planetIndex];
    let station = null;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const angle = randomBetween(rng, 0, Math.PI * 2);
      if (angleDistance(angle, baseAngles[planetIndex]) < 0.75) continue;
      const distance = planet.radius + randomInt(rng, 190, 300);
      const x = planet.x + Math.cos(angle) * distance;
      const y = planet.y + Math.sin(angle) * distance;
      if (x < 100 || x > worldWidth - 100 || y < 100 || y > worldHeight - 100) continue;
      if (!stationCandidateClear(x, y, planets, stations)) continue;
      station = {
        x,
        y,
        radius: 27,
        health: 4,
        maxHealth: 4,
        fireEvery: randomInt(rng, 1400, 1700),
      };
      break;
    }
    if (!station) {
      const angle = baseAngles[planetIndex] + Math.PI;
      const distance = planet.radius + 250;
      station = {
        x: clamp(planet.x + Math.cos(angle) * distance, 100, worldWidth - 100),
        y: clamp(planet.y + Math.sin(angle) * distance, 100, worldHeight - 100),
        radius: 27,
        health: 4,
        maxHealth: 4,
        fireEvery: randomInt(rng, 1400, 1700),
      };
    }
    stations.push(station);
  }

  const enemies = [];
  for (let attempt = 0; attempt < 900 && enemies.length < 6; attempt += 1) {
    const x = randomBetween(rng, 180, worldWidth - 180);
    const y = randomBetween(rng, 180, worldHeight - 180);
    if (Math.hypot(x - shipSpawn.x, y - shipSpawn.y) < 760) continue;
    if (planets.some((planet) => Math.hypot(x - planet.x, y - planet.y) < planet.radius + 230)) continue;
    if (stations.some((station) => Math.hypot(x - station.x, y - station.y) < 200)) continue;
    if (enemies.some((enemy) => Math.hypot(x - enemy.x, y - enemy.y) < 190)) continue;
    enemies.push({ x, y, radius: 16, fireEvery: randomInt(rng, 1580, 2100) });
  }

  if (enemies.length < 6) {
    const grid = [];
    for (let y = 300; y < worldHeight - 300; y += 430) {
      for (let x = 300; x < worldWidth - 300; x += 520) grid.push({ x, y });
    }
    for (const point of shuffle(rng, grid)) {
      if (enemies.length >= 6) break;
      if (Math.hypot(point.x - shipSpawn.x, point.y - shipSpawn.y) < 760) continue;
      if (planets.some((planet) => Math.hypot(point.x - planet.x, point.y - planet.y) < planet.radius + 230)) continue;
      if (stations.some((station) => Math.hypot(point.x - station.x, point.y - station.y) < 200)) continue;
      if (enemies.some((enemy) => Math.hypot(point.x - enemy.x, point.y - enemy.y) < 190)) continue;
      enemies.push({ ...point, radius: 16, fireEvery: randomInt(rng, 1580, 2100) });
    }
  }

  if (enemies.length < 6) throw new Error("Unable to generate open-space enemy spawns");
  return { seed: acceptedSeed, shipSpawn, planets, baseAngles, enemies, stations };
}
