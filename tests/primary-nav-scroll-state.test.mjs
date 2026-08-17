import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("primary navigation keeps its scroll position across route selection changes", async () => {
  const [keeper, layout] = await Promise.all([
    read("app/primary-nav-scroll-state.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(keeper, /\.kb-navigation \.kb-nav-list/);
  assert.match(keeper, /sessionStorage\.setItem/);
  assert.match(keeper, /sessionStorage\.getItem/);
  assert.match(keeper, /nextNav\.scrollTop = savedScrollTop/);
  assert.match(keeper, /new MutationObserver\(attachToCurrentNav\)/);
  assert.match(layout, /<PrimaryNavScrollState\/>/);
});
