import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exactIds = [
  "road-dirt-straight",
  "road-dirt-curve-left",
  "road-dirt-curve-right",
  "road-dirt-t-junction",
  "road-dirt-crossroads",
  "road-dirt-narrow-trail",
  "road-dirt-worn-edge-a",
  "road-dirt-worn-edge-b",
  "fence-wood-straight-a",
  "fence-wood-straight-b",
  "fence-wood-corner",
  "fence-wood-gate",
  "fence-wood-broken",
  "barrier-stone-low",
];

const forbiddenHallucinations = [
  "Scout",
  "Harvester",
  "Planter",
  "Ranger",
  "Builder",
  "Transport",
  "Mainframe Link",
  "Scrapper",
  "Synth Hive",
];

test("Rewild v4 road/fence roster is exact and uses six-direction flat-top connector masks", async () => {
  const [runtime, builder, validator] = await Promise.all([
    readFile(new URL("../app/rewild-road-atlas-v4.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-rewild-v4-road-atlas.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/validate-rewild-v4-road-atlas.mjs", import.meta.url), "utf8"),
  ]);

  const runtimeIdBlock = runtime.match(/REWILD_ROAD_V4_IDS = \[([\s\S]*?)\] as const;/u)?.[1] ?? "";
  const runtimeIds = [...runtimeIdBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(runtimeIds, exactIds);

  for (const id of exactIds) {
    assert.match(runtime, new RegExp(`\\"${id}\\"`), `runtime must include ${id}`);
    assert.match(builder, new RegExp(`\\"${id}\\"`), `builder must include ${id}`);
  }

  assert.match(runtime, /rotateConnectorMask/u);
  assert.match(runtime, /selectRoadV4/u);
  assert.match(runtime, /selectFenceV4/u);
  assert.match(runtime, /Math\.PI \/ 3/u, "sprite rotation must use exact 60-degree steps");
  assert.match(builder, /orientation: "flat-top"/u);
  assert.match(builder, /directions: 6/u);
  assert.match(validator, /rotationStepDegrees: 60/u);

  for (const name of forbiddenHallucinations) {
    assert.doesNotMatch(runtime, new RegExp(name, "iu"), `${name} must not enter the road/fence runtime`);
    assert.doesNotMatch(builder, new RegExp(name, "iu"), `${name} must not enter the road/fence build`);
  }
});

test("Rewild v4 road/fence overlay stays deterministic and renderer-only", async () => {
  const [overlay, overheadRenderer] = await Promise.all([
    readFile(new URL("../app/rewild-road-overlay-v4.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/rewild-overhead-renderer.ts", import.meta.url), "utf8"),
  ]);

  assert.match(overlay, /connectorMasksFromEdges/u);
  assert.match(overlay, /snapshot\.roadEdges/u);
  assert.match(overlay, /snapshot\.occupiedHexes/u, "late road overlay must protect occupied gameplay cells");
  assert.match(overlay, /state\.enemies/u, "late road overlay must protect moving enemy cells");
  assert.match(overlay, /selectRoadV4/u);
  assert.match(overlay, /selectFenceV4/u);
  assert.match(overheadRenderer, /renderRewildRoadFenceOverlayV4/u);
  assert.doesNotMatch(overlay, /Math\.random/u);
  assert.doesNotMatch(overlay, /rewild-simulation/u);
  assert.doesNotMatch(overlay, /updateGame|placePlant|createGameState/u);
  assert.doesNotMatch(overlay, /snapshot\.state(?:\.[A-Za-z0-9_]+)+\s*=/u, "road/fence overlay must not mutate gameplay state");
});
