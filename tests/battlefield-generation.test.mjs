import assert from "node:assert/strict";
import test from "node:test";

import {
  generateGravityBattlefield,
  generatePlatformBattlefield,
} from "../app/games/battlefield-generation.mjs";

function platformContainsSpawn(platform, spawn) {
  return Math.abs(platform.y - 32 - spawn.y) < 0.001
    && spawn.x >= platform.x
    && spawn.x + spawn.w <= platform.x + platform.w;
}

test("platform battlefield generation is deterministic and produces usable spawn surfaces", () => {
  const first = generatePlatformBattlefield(0x12345678);
  const repeated = generatePlatformBattlefield(0x12345678);
  const different = generatePlatformBattlefield(0x87654321);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first.platforms, different.platforms);
  assert.equal(first.platforms.length, 18);
  assert.equal(first.spawnTemplates.length, 12);
  assert.equal(first.playerSpawn.y, first.platforms[0].y - 42);
  for (const spawn of first.spawnTemplates) {
    assert.ok(first.platforms.some((platform) => platformContainsSpawn(platform, spawn)));
  }
});

test("platform generator stays valid across a broad deterministic seed sample", () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const battlefield = generatePlatformBattlefield(seed);
    assert.equal(battlefield.spawnTemplates.length, 12);
    assert.equal(battlefield.platforms.length, 18);
    for (const spawn of battlefield.spawnTemplates) {
      assert.ok(battlefield.platforms.some((platform) => platformContainsSpawn(platform, spawn)));
    }
  }
});

test("gravity battlefield generation keeps a safe spawn and separated combat objects", () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const battlefield = generateGravityBattlefield(seed);
    assert.equal(battlefield.planets.length, 5);
    assert.equal(battlefield.baseAngles.length, 5);
    assert.equal(battlefield.stations.length, 4);
    assert.equal(battlefield.enemies.length, 6);

    for (const planet of battlefield.planets) {
      assert.ok(
        Math.hypot(planet.x - battlefield.shipSpawn.x, planet.y - battlefield.shipSpawn.y)
          >= planet.radius + 620,
      );
    }

    for (let left = 0; left < battlefield.planets.length; left += 1) {
      for (let right = left + 1; right < battlefield.planets.length; right += 1) {
        const a = battlefield.planets[left];
        const b = battlefield.planets[right];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius + 350);
      }
    }

    for (const enemy of battlefield.enemies) {
      assert.ok(Math.hypot(enemy.x - battlefield.shipSpawn.x, enemy.y - battlefield.shipSpawn.y) >= 700);
      assert.ok(battlefield.planets.every((planet) => (
        Math.hypot(enemy.x - planet.x, enemy.y - planet.y) >= planet.radius + 200
      )));
    }
  }
});
