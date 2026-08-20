import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("composes Rewild nature as deterministic clusters and exterior shoreline details", async () => {
  const source = await readFile(projectFile("app/rewild-authored-overlay.ts"), "utf8");

  assert.match(source, /const CLUSTER_OFFSETS/);
  assert.match(source, /function meadowClusterSprite/);
  assert.match(source, /function forestNeighborCount/);
  assert.match(source, /const interior = neighbors >= 4/);
  assert.match(source, /const crownCount = interior/);
  assert.match(source, /function shorelinePoint/);
  assert.match(source, /const boundaryDirections = neighbors/);
  assert.match(source, /kinds\.get\(hexKey\(neighbor\)\) !== "water"/);
  assert.match(source, /shorelinePoint\(center, hexCenter\(neighbor\)\)/);
  assert.match(source, /0x100000000/);

  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /updateGame|placePlant|createGameState/);
});
