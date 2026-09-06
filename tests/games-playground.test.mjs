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
