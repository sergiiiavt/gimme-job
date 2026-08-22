import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exactIds = [
  "detail-grass-tuft-a",
  "detail-grass-tuft-b",
  "detail-grass-tuft-c",
  "detail-wild-weeds",
  "detail-flower-yellow",
  "detail-flower-purple",
  "detail-mushrooms",
  "detail-pebbles",
  "detail-rock-small-a",
  "detail-rock-small-b",
  "detail-rock-medium-a",
  "detail-log-a",
  "detail-stump-a",
  "detail-shrub-low-a",
  "detail-reeds-a",
  "detail-lily-pads-a",
  "industrial-cable-segment-a",
  "industrial-junction-box-a",
  "industrial-relay-box-a",
  "industrial-pipe-outlet-a",
  "industrial-vent-small-a",
  "industrial-debris-small-a",
  "detail-tree-pine-a",
  "detail-tree-broadleaf-a",
];

const forbiddenHallucinations = [
  "Scout",
  "Harvester",
  "Planter",
  "Ranger",
  "Builder",
  "Transport",
  "Mainframe Link",
];

test("Rewild v4 environment detail roster is exact and decorative-only", async () => {
  const [runtime, builder] = await Promise.all([
    readFile(new URL("../app/rewild-detail-atlas-v4.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-rewild-v4-detail-atlas.mjs", import.meta.url), "utf8"),
  ]);

  for (const id of exactIds) {
    assert.match(runtime, new RegExp(`\\"${id}\\"`), `runtime must include ${id}`);
    assert.match(builder, new RegExp(`\\"${id}\\"`), `builder must include ${id}`);
  }

  for (const name of forbiddenHallucinations) {
    assert.doesNotMatch(runtime, new RegExp(name, "iu"), `${name} must not enter the v4 detail runtime`);
    assert.doesNotMatch(builder, new RegExp(name, "iu"), `${name} must not enter the v4 detail build`);
  }

  const runtimeIdBlock = runtime.match(/REWILD_DETAIL_V4_IDS = \[([\s\S]*?)\] as const;/u)?.[1] ?? "";
  const runtimeIds = [...runtimeIdBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(runtimeIds, exactIds);
});

test("Rewild v4 authored overlay remains deterministic renderer-only composition", async () => {
  const overlay = await readFile(new URL("../app/rewild-authored-overlay.ts", import.meta.url), "utf8");

  assert.match(overlay, /drawRewildDetailV4/u);
  assert.match(overlay, /CLUSTER_OFFSETS/u);
  assert.match(overlay, /shorelinePoint/u);
  assert.match(overlay, /industrial-pipe-outlet-a/u);
  assert.match(overlay, /0x100000000/u, "deterministic random helper must remain bounded below 1");
  assert.doesNotMatch(overlay, /Math\.random/u);
  assert.doesNotMatch(overlay, /rewild-simulation/u);
  assert.doesNotMatch(overlay, /snapshot\.state(?:\.[A-Za-z0-9_]+)+\s*=/u, "visual overlay must not mutate gameplay state");
});
