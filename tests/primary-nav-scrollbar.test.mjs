import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/navigation-scroll.css", import.meta.url), "utf8");
const scrollState = readFileSync(new URL("../app/primary-nav-scroll-state.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("primary navigation scrollbar is moved to the left without reversing content", () => {
  assert.match(styles, /\.kb-navigation \.kb-nav-list\s*\{[\s\S]*direction:\s*rtl/);
  assert.match(styles, /\.kb-navigation \.kb-nav-list > \*\s*\{[\s\S]*direction:\s*ltr/);
  assert.match(styles, /scrollbar-gutter:\s*stable/);
});

test("primary navigation scrollbar stays minimal until hover, focus, or active scrolling", () => {
  assert.match(styles, /::-webkit-scrollbar\s*\{[\s\S]*width:\s*3px/);
  assert.match(styles, /::-webkit-scrollbar-thumb\s*\{[\s\S]*background:\s*transparent/);
  assert.match(styles, /\.kb-nav-list\.is-scrolling[\s\S]*scrollbar-color:/);
  assert.match(styles, /\.kb-nav-list\.is-scrolling::-webkit-scrollbar-thumb/);
});

test("scroll state exposes a short-lived is-scrolling class and keeps position persistence", () => {
  assert.match(scrollState, /const SCROLL_IDLE_MS = 650/);
  assert.match(scrollState, /classList\.add\("is-scrolling"\)/);
  assert.match(scrollState, /classList\.remove\("is-scrolling"\)/);
  assert.match(scrollState, /saveScrollTop\(nav\.scrollTop\)/);
  assert.match(layout, /import "\.\/navigation-scroll\.css"/);
});
