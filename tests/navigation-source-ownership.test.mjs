import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const TEST_DIRECTORY = new URL("./", import.meta.url);
const SELF = "navigation-source-ownership.test.mjs";
const allowedSidebarSourceContracts = [
  "auth-forwarding-ui.test.mjs",
  "learning-path-advisor-render.test.mjs",
  "next-game-placeholder.test.mjs",
].sort();

test("only dedicated sidebar contracts may inspect site-navigation source", async () => {
  const files = (await readdir(TEST_DIRECTORY))
    .filter((name) => /\.test\.(?:[cm]?js|[cm]?ts)$/.test(name) && name !== SELF);

  const readers = [];
  for (const file of files) {
    const source = await readFile(new URL(file, TEST_DIRECTORY), "utf8");
    if (source.includes("app/site-navigation.tsx")) readers.push(file);
  }

  assert.deepEqual(
    readers.sort(),
    allowedSidebarSourceContracts,
    "Navigation copy/order belongs in navigation-config tests. Add a source reader here only when it verifies SiteSidebar implementation details that cannot be expressed through the config.",
  );
});
