import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const TEST_DIRECTORY = new URL("./", import.meta.url);
const SELF = "navigation-source-ownership.test.mjs";
const allowedNavigationSourceContracts = [
  "auth-forwarding-ui.test.mjs",
  "learning-path-advisor-render.test.mjs",
  "navigation-config.test.ts",
].sort();

test("only dedicated navigation contracts may inspect navigation implementation sources", async () => {
  const files = (await readdir(TEST_DIRECTORY, { recursive: true }))
    .map((name) => name.replaceAll("\\", "/"))
    .filter((name) => /\.test\.(?:[cm]?js|[cm]?ts)$/.test(name) && name !== SELF);

  const readers = [];
  for (const file of files) {
    const source = await readFile(new URL(file, TEST_DIRECTORY), "utf8");
    if (source.includes("app/site-navigation.tsx") || source.includes("app/navigation-config.ts")) readers.push(file);
  }

  assert.deepEqual(
    readers.sort(),
    allowedNavigationSourceContracts,
    "Navigation copy/order belongs in navigation-config tests. Add a source reader here only for navigation implementation details that cannot be expressed through exported config. The guard intentionally does not scan common label literals because that would create noisy false positives; catch literal-copy coupling in review.",
  );
});
