import assert from "node:assert/strict";
import test from "node:test";
import {
  hiddenDeepLinkSections,
  navigationGroups,
  navigationIntroItem,
  navigationItems,
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
  assert.deepEqual(group("playgrounds").items.map((entry) => entry.id), ["ai-assistant", "websocket-playground", "database-playground"]);
  assert.deepEqual(group("misc").items.map((entry) => entry.id), ["news", "games"]);

  const learningIds = group("learning").items.map((entry) => entry.id);
  assert.ok(learningIds.indexOf("automation") < learningIds.indexOf("testing-tools"));
  assert.ok(learningIds.indexOf("testing-tools") < learningIds.indexOf("api"));
  assert.ok(learningIds.indexOf("standards") < learningIds.indexOf("metrics-estimation"));
  assert.ok(learningIds.indexOf("metrics-estimation") < learningIds.indexOf("strategy"));

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
  assert.equal(games.personalHref, "/games");
});

test("section navigation and hidden deep links remain derived from the canonical config", () => {
  const visibleSectionIds = [navigationIntroItem.id, ...navigationGroups.flatMap((entry) => entry.items)
    .filter((entry) => entry.external !== true)
    .map((entry) => entry.id)];

  assert.deepEqual(navigationItems.map((entry) => entry.id), visibleSectionIds);
  assert.deepEqual(hiddenDeepLinkSections, ["python-interview"]);
  assert.equal(navigationItems.some((entry) => entry.id === "python-interview"), false);
});
