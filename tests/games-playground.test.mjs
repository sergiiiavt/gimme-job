import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/games/games-playground.tsx", import.meta.url), "utf8");

test("both games support held mouse fire", () => {
  assert.equal((source.match(/let pointerHeld = false;/g) ?? []).length, 2);
  assert.equal((source.match(/pointerHeld = true;/g) ?? []).length, 2);
  assert.equal((source.match(/keyboardShoot \|\| pointerHeld/g) ?? []).length, 2);
});

test("platformer shows a larger world through smaller fixed-scale actors", () => {
  assert.match(source, /const PLATFORM_WORLD_WIDTH = 1920;/);
  assert.match(source, /const PLATFORM_WORLD_HEIGHT = 960;/);
  assert.match(source, /const PLATFORM_SCALE = WIDTH \/ PLATFORM_WORLD_WIDTH;/);
  assert.match(source, /ctx\.scale\(PLATFORM_SCALE, PLATFORM_SCALE\)/);
});

test("gravity treats the old 40 percent scale as the new 100 percent baseline", () => {
  assert.match(source, /const GRAVITY_BASE_ZOOM = 0\.4;/);
  assert.match(source, /const GRAVITY_MIN_ZOOM = 0\.24;/);
  assert.match(source, /const GRAVITY_MAX_ZOOM = 2\.4;/);
  assert.match(source, /let zoom = GRAVITY_BASE_ZOOM;/);
  assert.match(source, /zoom \/ GRAVITY_BASE_ZOOM \* 100/);
});

test("both games expose blaster rocket and bomb weapons", () => {
  assert.match(source, /type WeaponId = "blaster" \| "rocket" \| "bomb";/);
  assert.match(source, /Digit1/);
  assert.match(source, /Digit2/);
  assert.match(source, /Digit3/);
  assert.match(source, /craterRadius = projectile\.kind === "rocket" \? 110 : projectile\.kind === "bomb" \? 155 : 46/);
});

test("both games show a visible clickable weapon selector", () => {
  assert.match(source, /aria-label="Weapon selector"/);
  assert.match(source, /aria-pressed=\{weapon === option\.id\}/);
  assert.match(source, /icon: "🚀"/);
  assert.match(source, /icon: "💣"/);
  assert.equal((source.match(/<WeaponSelector onSelect=\{chooseWeapon\} weapon=\{weapon\}\/>/g) ?? []).length, 2);
});

test("both player-controlled worlds wrap at every edge", () => {
  assert.match(source, /wrapCoordinate\(player\.x \+ player\.w \/ 2, PLATFORM_WORLD_WIDTH\)/);
  assert.match(source, /wrapCoordinate\(centerY, PLATFORM_WORLD_HEIGHT\)/);
  assert.match(source, /wrapCoordinate\(ship\.x, SPACE_WORLD_WIDTH\)/);
  assert.match(source, /wrapCoordinate\(ship\.y, SPACE_WORLD_HEIGHT\)/);
  assert.doesNotMatch(source, /ship\.x < 0 \|\| ship\.x > SPACE_WORLD_WIDTH/);
});

test("platformer requires difficulty selection and changes reinforcement cadence", () => {
  assert.match(source, /type DifficultyId = "easy" \| "normal" \| "hard";/);
  assert.match(source, /easy: \{ label: "Easy", spawnEvery: 4700 \}/);
  assert.match(source, /normal: \{ label: "Normal", spawnEvery: 2800 \}/);
  assert.match(source, /hard: \{ label: "Hard", spawnEvery: 1550 \}/);
  assert.match(source, /aria-label="Select platformer difficulty"/);
  assert.match(source, /nextSpawnAt = now \+ difficultyConfig\.spawnEvery/);
});

test("platformer wins when the player clears the arena before reinforcement", () => {
  assert.match(source, /if \(!won && enemies\.length === 0\)/);
  assert.match(source, /Arena cleared/);
  assert.match(source, /all reinforcements stopped/);
});

test("gravity adds hostile ships and orbital stations", () => {
  assert.match(source, /const enemies: SpaceEnemy\[\] = \[/);
  assert.match(source, /const stations: SpaceStation\[\] = \[/);
  assert.match(source, /function fireEnemyProjectile/);
  assert.match(source, /fireEnemyProjectile\(station\.x, station\.y, 455, now\)/);
  assert.match(source, /enemy\.vx \+= direction\.x \* 92 \* dt/);
});

test("gravity victory requires destroying one base on every planet", () => {
  assert.match(source, /const bases: EnemyBase\[\] = planets\.map/);
  assert.match(source, /bases\.every\(\(base\) => !base\.alive\)/);
  assert.match(source, /All planetary bases destroyed/);
  assert.match(source, /Every enemy base on every planet has been destroyed/);
});
