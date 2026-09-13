import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const navigationSource = readFileSync(new URL("../app/site-navigation.tsx", import.meta.url), "utf8");

test("sidebar no longer renders the inert next-game placeholder", () => {
  assert.doesNotMatch(navigationSource, /title="Next game"/);
  assert.doesNotMatch(navigationSource, /aria-disabled="true"[\s\S]*?Next game/);
});
