import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exactIds = ["house", "house-damaged", "datacenter", "mainframe"];

test("Rewild v4 structure roster is exact and matches the code-authoritative House/DataNode concepts", async () => {
  const [runtime, builder, world] = await Promise.all([
    readFile(new URL("../app/rewild-structure-atlas-v4.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-rewild-v4-structures-atlas.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/rewild-world.ts", import.meta.url), "utf8"),
  ]);

  for (const id of exactIds) {
    assert.match(runtime, new RegExp(`\\"${id}\\"`), `runtime must include ${id}`);
    assert.match(builder, new RegExp(`\\"${id}\\"`), `builder must include ${id}`);
  }

  const runtimeIdBlock = runtime.match(/REWILD_STRUCTURE_V4_IDS = \[([\s\S]*?)\] as const;/u)?.[1] ?? "";
  const runtimeIds = [...runtimeIdBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(runtimeIds, exactIds);

  assert.match(world, /HOUSE_FOOTPRINT/u, "house sprite must map to the code-authoritative HOUSE_FOOTPRINT");
  assert.match(world, /createFacilityFootprint/u, "datacenter/mainframe sprites must map to the code-authoritative facility footprint");
});

test("Rewild pixel atlas facade routes the structure roster through the v4 structure atlas ahead of v3/v2", async () => {
  const facade = await readFile(new URL("../app/rewild-pixel-atlas.ts", import.meta.url), "utf8");

  assert.match(facade, /drawRewildStructureV4Sprite/u);
  assert.match(facade, /REWILD_STRUCTURE_V4_IDS/u);
  assert.match(facade, /V4_STRUCTURE_SPRITES\.has\(id\)/u, "v4 structure ids must be checked before the v3 visibility fallback runs");
});
