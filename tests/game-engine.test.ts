import assert from "node:assert/strict";
import test from "node:test";
import {
  TERRAIN_CELL,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  carveTerrain,
  createTerrain,
  isTerrainSolid,
  rectsOverlap,
  terrainIndex,
  terrainSurfaceRow,
} from "../app/games/game-engine.ts";

test("rectangle collision requires actual overlap", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test("generated terrain has empty space above a solid surface", () => {
  const terrain = createTerrain();
  const column = 48;
  const surface = terrainSurfaceRow(column);
  const x = column * TERRAIN_CELL + TERRAIN_CELL / 2;

  assert.equal(terrain[terrainIndex(column, surface)], 1);
  assert.equal(isTerrainSolid(terrain, x, (surface - 1) * TERRAIN_CELL + 1), false);
  assert.equal(isTerrainSolid(terrain, x, surface * TERRAIN_CELL + 1), true);
});

test("terrain boundaries behave as world collision boundaries", () => {
  const terrain = createTerrain();
  assert.equal(isTerrainSolid(terrain, -1, 100), true);
  assert.equal(isTerrainSolid(terrain, WORLD_WIDTH, 100), true);
  assert.equal(isTerrainSolid(terrain, 100, WORLD_HEIGHT), true);
  assert.equal(isTerrainSolid(terrain, 100, -1), false);
});

test("carving terrain opens a local crater without deleting distant ground", () => {
  const terrain = createTerrain();
  const column = 55;
  const surface = terrainSurfaceRow(column);
  const x = column * TERRAIN_CELL + TERRAIN_CELL / 2;
  const y = (surface + 3) * TERRAIN_CELL + TERRAIN_CELL / 2;
  const distantColumn = column + 12;
  const distantSurface = terrainSurfaceRow(distantColumn);

  assert.equal(isTerrainSolid(terrain, x, y), true);
  carveTerrain(terrain, x, y, 31);
  assert.equal(isTerrainSolid(terrain, x, y), false);
  assert.equal(terrain[terrainIndex(distantColumn, distantSurface + 3)], 1);
});
