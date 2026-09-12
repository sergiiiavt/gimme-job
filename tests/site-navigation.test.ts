import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { navigationGroups } = await import("../app/site-navigation.tsx");

test("Playground navigation avoids repeating the parent section name", () => {
  const playground = navigationGroups.find((group) => group.id === "playgrounds");

  assert.ok(playground, "Playground navigation group must exist");
  assert.equal(playground.label, "Playground");
  assert.equal(
    playground.items.find((item) => item.id === "websocket-playground")?.label,
    "WebSocket",
  );
  assert.equal(
    playground.items.find((item) => item.id === "database-playground")?.label,
    "Database",
  );
});
