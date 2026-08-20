import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("locks active Rewild overhead atlas frames and v4 fallback policy", async () => {
  const [contractSource, atlasSource, facadeSource] = await Promise.all([
    readFile(projectFile("config/rewild/overhead-atlas-contract.json"), "utf8"),
    readFile(projectFile("app/rewild-pixel-atlas-v3.ts"), "utf8"),
    readFile(projectFile("app/rewild-pixel-atlas.ts"), "utf8"),
  ]);
  const contract = JSON.parse(contractSource);

  assert.equal(contract.activeGeneration, "v3");
  assert.equal(contract.frameVisibilityThreshold, 24);
  assert.equal(contract.v4Policy.decodePolicy, "fail");
  assert.equal(contract.v4Policy.emptyFramePolicy, "fail");
  assert.equal(contract.v4Policy.silentFallbackAllowed, false);

  const entityAtlas = contract.atlases.find((atlas) => atlas.id === "entities-v3");
  const terrainAtlas = contract.atlases.find((atlas) => atlas.id === "terrain-v3");
  assert.ok(entityAtlas);
  assert.ok(terrainAtlas);
  assert.equal(entityAtlas.frames.length, 32);
  assert.equal(terrainAtlas.frames.length, 16);
  assert.ok(entityAtlas.frames.length <= entityAtlas.columns * entityAtlas.rows);
  assert.ok(terrainAtlas.frames.length <= terrainAtlas.columns * terrainAtlas.rows);
  assert.equal(entityAtlas.decodePolicy, "warn-on-v3-decoder-error");
  assert.equal(terrainAtlas.decodePolicy, "fail");
  assert.equal(terrainAtlas.rows, 8);

  for (const frame of entityAtlas.frames) {
    assert.match(atlasSource, new RegExp(`"${frame.name}"`));
    assert.ok(frame.fallback, `${frame.name} must declare its temporary v3 fallback while compatibility mode is allowed`);
  }
  for (const frame of terrainAtlas.frames) assert.match(atlasSource, new RegExp(`"${frame.name}"`));

  for (const [id, fallback] of [
    ["industrial-fan", "datacenter"],
    ["industrial-power", "datacenter"],
    ["industrial-relay", "corruption-node"],
    ["industrial-rubble", "rock"],
    ["reed-clump", "grass-tuft"],
    ["corruption-spike", "corruption-node"],
  ]) {
    assert.match(facadeSource, new RegExp(`"${id}": "${fallback}"`));
  }
});
