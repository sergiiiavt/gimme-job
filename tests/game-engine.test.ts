import assert from "node:assert/strict";
import test from "node:test";
import {
  SPACE_WORLD_HEIGHT,
  SPACE_WORLD_WIDTH,
  clampCamera,
  findSolidPlanetIndex,
  gravityAtPoint,
  isPlanetSolidAtPoint,
  normalizedDirection,
  pointInsideCrater,
  rectsOverlap,
  screenToWorld,
  type PlanetPhysics,
} from "../app/games/game-engine.ts";

function planet(overrides: Partial<PlanetPhysics> = {}): PlanetPhysics {
  return {
    x: 500,
    y: 500,
    radius: 100,
    surfaceGravity: 200,
    craters: [],
    ...overrides,
  };
}

test("rectangle collision requires actual overlap", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test("normalized direction aims at a point and has a stable zero-distance fallback", () => {
  assert.deepEqual(normalizedDirection(0, 0, 3, 4), { x: 0.6, y: 0.8 });
  assert.deepEqual(normalizedDirection(4, 4, 4, 4), { x: 1, y: 0 });
});

test("planet gravity points toward planets and becomes stronger near the surface", () => {
  const body = planet();
  const far = gravityAtPoint(0, 500, [body]);
  const near = gravityAtPoint(390, 500, [body]);

  assert.ok(far.x > 0);
  assert.equal(far.y, 0);
  assert.ok(near.x > far.x);
  assert.deepEqual(gravityAtPoint(body.x, body.y, [body]), { x: 0, y: 0 });
});

test("craters turn solid planet material into empty space", () => {
  const body = planet({ craters: [{ x: 580, y: 500, radius: 30 }] });

  assert.equal(isPlanetSolidAtPoint(body, 500, 500), true);
  assert.equal(isPlanetSolidAtPoint(body, 580, 500), false);
  assert.equal(isPlanetSolidAtPoint(body, 650, 500), false);
  assert.equal(pointInsideCrater(580, 500, body.craters), true);
  assert.equal(pointInsideCrater(500, 500, body.craters), false);
});

test("solid planet lookup returns the collided planet or -1", () => {
  const planets = [planet(), planet({ x: 900, y: 500, radius: 80 })];
  assert.equal(findSolidPlanetIndex(planets, 500, 500), 0);
  assert.equal(findSolidPlanetIndex(planets, 900, 500), 1);
  assert.equal(findSolidPlanetIndex(planets, 700, 500), -1);
});

test("screen coordinates map into the scrolling world", () => {
  assert.deepEqual(screenToWorld(120, 80, { x: 400, y: 300 }), { x: 520, y: 380 });
});

test("camera follows the target while staying inside the large world", () => {
  assert.deepEqual(clampCamera(100, 100, 1000, 600), { x: 0, y: 0 });
  assert.deepEqual(clampCamera(2600, 1700, 1000, 600), { x: 2100, y: 1400 });
  assert.deepEqual(
    clampCamera(SPACE_WORLD_WIDTH, SPACE_WORLD_HEIGHT, 1000, 600),
    { x: SPACE_WORLD_WIDTH - 1000, y: SPACE_WORLD_HEIGHT - 600 },
  );
  assert.deepEqual(clampCamera(100, 100, SPACE_WORLD_WIDTH + 20, SPACE_WORLD_HEIGHT + 20), { x: 0, y: 0 });
});
