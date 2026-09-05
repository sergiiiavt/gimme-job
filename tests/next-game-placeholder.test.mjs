import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const navigationSource = readFileSync(new URL("../app/site-navigation.tsx", import.meta.url), "utf8");

test("sidebar replaces the inert next-game placeholder with one Games link", () => {
  assert.doesNotMatch(navigationSource, /title="Next game"/);
  assert.doesNotMatch(navigationSource, /aria-disabled="true"[\s\S]*?Next game/);
  assert.equal((navigationSource.match(/id: "games"/g) ?? []).length, 1);
  assert.match(navigationSource, /label: "Games"[\s\S]*?publicHref: "\/games"[\s\S]*?personalHref: "\/games"/);
});
