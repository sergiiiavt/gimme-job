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

test("both games request a fresh seeded battlefield when a new game starts", () => {
  assert.match(source, /generatePlatformBattlefield\(/);
  assert.match(source, /generateGravityBattlefield\(/);
  assert.equal((source.match(/randomBattlefieldSeed\(resetToken\)/g) ?? []).length, 2);
  assert.match(source, /const mapId = battlefieldId\(battlefield\.seed\)/);
  assert.match(source, /New battlefield/);
});

test("platformer requires difficulty selection and changes reinforcement cadence", () => {
  assert.match(source, /type DifficultyId = "easy" \| "normal" \| "hard" \| "impossible";/);
  assert.match(source, /easy: \{ label: "Easy", spawnEvery: 4700 \}/);
  assert.match(source, /normal: \{ label: "Normal", spawnEvery: 2800 \}/);
  assert.match(source, /hard: \{ label: "Hard", spawnEvery: 1550 \}/);
  assert.match(source, /impossible: \{ label: "Impossible", spawnEvery: 1050 \}/);
  assert.match(source, /aria-label="Select platformer difficulty"/);
  assert.match(source, /nextSpawnAt = now \+ difficultyConfig\.spawnEvery/);
});

test("platformer wins when the player clears the arena before reinforcement", () => {
  assert.match(source, /if \(!won && enemies\.length === 0\)/);
  assert.match(source, /Arena cleared/);
  assert.match(source, /all reinforcements stopped/);
});

test("platformer victory dialog has independent line height and new-game actions", () => {
  assert.match(source, /function VictoryOverlay/);
  assert.match(source, /lineHeight: 1\.35/);
  assert.match(source, /lineHeight: 1\.1/);
  assert.match(source, /lineHeight: 1\.45/);
  assert.match(source, /primaryLabel="Start new game"/);
  assert.match(source, /secondaryLabel="Change difficulty"/);
  assert.match(source, /onPlayAgain=\{\(\) => setResetToken/);
  assert.match(source, /onChangeDifficulty=\{\(\) => setDifficulty\(null\)\}/);
});

test("platformer phase shooters scale by difficulty and phase bolts pass through platforms", () => {
  assert.match(source, /function platformEnemyShotMode/);
  assert.match(source, /easy: \[2\]/);
  assert.match(source, /normal: \[1, 3, 5\]/);
  assert.match(source, /hard: \[0, 2, 4, 6, 8, 10\]/);
  assert.match(source, /impossible: \[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11\]/);
  assert.match(source, /platformEnemyShotMode\(enemy, difficulty\)/);
  assert.match(source, /const speed = enemyMode === "phase" \? 290 : 470/);
  assert.match(source, /projectile\.enemyMode !== "phase"/);
});

test("player and enemy projectiles use separate team styling in both games", () => {
  assert.match(source, /type ProjectileTeam = "player" \| "enemy";/);
  assert.equal((source.match(/team: "player"/g) ?? []).length, 2);
  assert.equal((source.match(/team: "enemy"/g) ?? []).length, 2);
  assert.match(source, /return \{ fill: "#ff665d", radius: 5 \}/);
  assert.match(source, /return \{ fill: "#c58cff", radius: 6 \}/);
  assert.match(source, /return \{ fill: "#76e8ff", radius: 4 \}/);
});

test("gravity builds hostile ships and orbital stations from the generated battlefield", () => {
  assert.match(source, /const enemies: SpaceEnemy\[\] = battlefield\.enemies\.map/);
  assert.match(source, /const stations: SpaceStation\[\] = battlefield\.stations\.map/);
  assert.match(source, /function fireEnemyProjectile/);
  assert.match(source, /fireEnemyProjectile\(station\.x, station\.y, 455, now\)/);
  assert.match(source, /enemy\.vx \+= direction\.x \* 92 \* dt/);
});

test("gravity orbital stations render as station silhouettes instead of target markers", () => {
  assert.match(source, /const stationAngle = \(station\.x \+ station\.y\) \* 0\.0007/);
  assert.match(source, /ctx\.fillStyle = "#315d82"/);
  assert.match(source, /ctx\.fillRect\(-70, -16, 32, 32\)/);
  assert.match(source, /ctx\.fillRect\(38, -16, 32, 32\)/);
  assert.match(source, /station\.health \/ station\.maxHealth/);
});

test("gravity ship has faster steering, passive damping, braking, and a speed cap", () => {
  assert.match(source, /const GRAVITY_TURN_SPEED = 3\.45;/);
  assert.match(source, /const GRAVITY_THRUST = 440;/);
  assert.match(source, /const GRAVITY_PASSIVE_DRAG = 0\.996;/);
  assert.match(source, /const GRAVITY_BRAKE_DRAG = 0\.94;/);
  assert.match(source, /const GRAVITY_MAX_SPEED = 520;/);
  assert.match(source, /const brake = keys\.has\("ArrowDown"\) \|\| keys\.has\("KeyS"\)/);
  assert.match(source, /const drag = brake \? GRAVITY_BRAKE_DRAG : GRAVITY_PASSIVE_DRAG/);
  assert.match(source, /shipSpeed > GRAVITY_MAX_SPEED/);
});

test("gravity victory requires destroying one base on every generated planet", () => {
  assert.match(source, /const bases: EnemyBase\[\] = planets\.map/);
  assert.match(source, /bases\.every\(\(base\) => !base\.alive\)/);
  assert.match(source, /All planetary bases destroyed/);
  assert.match(source, /Every enemy base on every planet has been destroyed/);
});

test("both games grant two seconds of invincibility after automatic respawn", () => {
  assert.match(source, /const INVINCIBILITY_AFTER_RESPAWN_MS = 2000;/);
  assert.equal((source.match(/let invincibleUntil = 0;/g) ?? []).length, 2);
  assert.equal((source.match(/respawn\(now, true\)/g) ?? []).length, 2);
  assert.equal((source.match(/now < invincibleUntil/g) ?? []).length >= 4, true);
  assert.equal((source.match(/Invincible for/g) ?? []).length, 2);
});
