import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exactIds = [
  "plant-sunbloom",
  "plant-thornbramble",
  "plant-sporecap",
  "plant-vinewhip",
  "plant-rootreclaimer",
  "plant-elderoak",
  "plant-elderoak-mature",
  "enemy-clickbait",
  "enemy-deepfake",
  "enemy-fragment",
  "enemy-popup",
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

test("Rewild v4 entity roster is exact and matches the code-authoritative plant/enemy kinds", async () => {
  const [runtime, builder, world] = await Promise.all([
    readFile(new URL("../app/rewild-entity-atlas-v4.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-rewild-v4-entities-atlas.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/rewild-world.ts", import.meta.url), "utf8"),
  ]);

  for (const id of exactIds) {
    assert.match(runtime, new RegExp(`\\"${id}\\"`), `runtime must include ${id}`);
    assert.match(builder, new RegExp(`\\"${id}\\"`), `builder must include ${id}`);
  }

  for (const name of forbiddenHallucinations) {
    assert.doesNotMatch(runtime, new RegExp(name, "iu"), `${name} must not enter the v4 entity runtime`);
    assert.doesNotMatch(builder, new RegExp(name, "iu"), `${name} must not enter the v4 entity build`);
  }

  const runtimeIdBlock = runtime.match(/REWILD_ENTITY_V4_IDS = \[([\s\S]*?)\] as const;/u)?.[1] ?? "";
  const runtimeIds = [...runtimeIdBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(runtimeIds, exactIds);

  for (const id of exactIds) {
    const kind = id.replace(/^plant-/u, "").replace(/^enemy-/u, "").replace(/-mature$/u, "");
    assert.match(world, new RegExp(`"${kind}"`), `${id}: underlying kind "${kind}" must exist in the code-authoritative roster`);
  }
});

test("Rewild pixel atlas facade routes the new roster through the v4 entity atlas ahead of v3/v2", async () => {
  const facade = await readFile(new URL("../app/rewild-pixel-atlas.ts", import.meta.url), "utf8");

  assert.match(facade, /drawRewildEntityV4Sprite/u);
  assert.match(facade, /REWILD_ENTITY_V4_IDS/u);
  assert.match(facade, /V4_ENTITY_SPRITES\.has\(id\)/u, "v4 entity ids must be checked before the v3 visibility fallback runs");
});
