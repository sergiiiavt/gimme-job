import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const navigationSource = readFileSync(new URL("../app/site-navigation.tsx", import.meta.url), "utf8");

test("sidebar keeps one inert next-game placeholder", () => {
  assert.equal((navigationSource.match(/title="Next game"/g) ?? []).length, 1);
  assert.match(navigationSource, /aria-disabled="true"[\s\S]*?<span className="kb-nav-label">Next game<\/span>/);
});
