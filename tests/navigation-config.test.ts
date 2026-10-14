import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  learningClusters,
  navigationGroups,
  navigationIntroItem,
} from "../app/navigation-config.ts";

function group(id: (typeof navigationGroups)[number]["id"]) {
  const value = navigationGroups.find((candidate) => candidate.id === id);
  assert.ok(value, `${id} navigation group must exist`);
  return value;
}

function item(groupId: (typeof navigationGroups)[number]["id"], itemId: string) {
  const value = group(groupId).items.find((candidate) => candidate.id === itemId);
  assert.ok(value, `${itemId} must exist in ${groupId}`);
  return value;
}

test("navigation keeps the intended group and item structure", () => {
  assert.equal(navigationIntroItem.id, "about");
  assert.deepEqual(navigationGroups.map((entry) => entry.id), ["career", "playgrounds", "learning", "misc"]);
  assert.deepEqual(group("career").items.map((entry) => entry.id), ["jobs", "resume", "interview", "trends"]);
  assert.equal(group("playgrounds").label, "Playground");
  assert.deepEqual(group("playgrounds").items.map((entry) => entry.id), ["ai-assistant", "websocket-playground", "database-playground"]);
  assert.deepEqual(group("misc").items.map((entry) => entry.id), ["news", "games"]);
  assert.deepEqual(
    learningClusters.flatMap((cluster) => cluster.itemIds),
    group("learning").items.map((entry) => entry.id),
    "every learning item must appear in exactly one cluster, in render order",
  );

  const allIds = [navigationIntroItem.id, ...navigationGroups.flatMap((entry) => entry.items.map((navItem) => navItem.id))];
  assert.equal(new Set(allIds).size, allIds.length, "navigation IDs must be unique");
  assert.ok(navigationIntroItem.label.trim().length > 0);
  assert.ok(navigationGroups.every((entry) => entry.label.trim().length > 0));
  assert.ok(navigationGroups.flatMap((entry) => entry.items).every((navItem) => navItem.label.trim().length > 0));
});

test("external navigation items keep canonical destinations independent of display copy", () => {
  const assistant = item("playgrounds", "ai-assistant");
  const websocket = item("playgrounds", "websocket-playground");
  const database = item("playgrounds", "database-playground");
  const games = item("misc", "games");

  assert.equal(assistant.external, true);
  assert.equal(assistant.publicHref, "/ai-assistant");
  assert.equal(websocket.external, true);
  assert.equal(websocket.publicHref, "/playgrounds/websocket");
  assert.equal(database.external, true);
  assert.equal(database.publicHref, "/playgrounds/databases");
  assert.equal(games.external, true);
  assert.equal(games.publicHref, "/games");
});


test("design switcher is rendered after every primary navigation group", () => {
  const source = readFileSync(new URL("../app/site-navigation.tsx", import.meta.url), "utf8");
  const groups = source.indexOf("navigationGroups.map");
  const slot = source.indexOf('className="kb-design-switcher-slot"');

  assert.ok(groups >= 0, "primary navigation groups must be rendered");
  assert.ok(slot > groups, "design switcher must be after the navigation groups so it appears at the bottom of the scroll");
  assert.match(source, /<DesignModeSwitcher\/>/);
});

// Navigation owns this shared sidebar width invariant for all pages and design modes.
test("Quick reference matches the secondary navigation buttons in width", () => {
  const sidebar = readFileSync(new URL("../app/site-navigation.tsx", import.meta.url), "utf8");
  const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const newDesign = readFileSync(new URL("../app/new-design.css", import.meta.url), "utf8");

  assert.ok(sidebar.includes('className="kb-subnav"'));
  assert.ok(sidebar.includes('className={`kb-quick-reference-link'));
  assert.ok(sidebar.includes('className="kb-subnav-switch"'));

  const linkCss = sidebar.split(".kb-quick-reference-link {")[1]?.split("}")[0];
  assert.ok(linkCss, "Quick reference style must exist on the shared sidebar");
  assert.ok(linkCss.includes("margin: 0 0 7px;"), "Quick reference must not be inset horizontally");
  assert.ok(linkCss.includes("width: 100%;"), "Quick reference must fill the same width as the switcher");
  assert.ok(!linkCss.includes("margin-left:") && !linkCss.includes("margin-right:"));

  const subnavCss = globals.split(".kb-subnav {")[1]?.split("}")[0] ?? "";
  const switcherCss = globals.split(".kb-subnav-switch {")[1]?.split("}")[0] ?? "";
  assert.ok(subnavCss.includes("flex-direction: column;"));
  assert.ok(switcherCss.includes("display: grid;"));

  const newDesignLinkCss = newDesign.split('html[data-design="new"] .kb-quick-reference-link {')[1]?.split("}")[0] ?? "";
  assert.ok(!newDesignLinkCss.includes("margin:") && !newDesignLinkCss.includes("width:"));
});

