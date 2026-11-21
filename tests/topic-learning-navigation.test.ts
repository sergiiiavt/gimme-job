import assert from "node:assert/strict";
import test from "node:test";
import { topicNavigationItems } from "../app/topic-learning-navigation.ts";

const topics = [
  { id: "published", label: "Published", labelUk: "Опубліковано", status: "published" },
  { id: "planned", label: "Planned", labelUk: "Заплановано", status: "under-construction" },
];
const supplements = [{ id: "videos", label: "Learning videos", labelUk: "Навчальні відео" }];

test("placeholder chapters carry an under-construction badge in the page language", () => {
  const english = topicNavigationItems(topics, supplements, "en");
  const ukrainian = topicNavigationItems(topics, supplements, "uk");

  assert.deepEqual(english.find((item) => item.id === "planned"), { id: "planned", label: "Planned", status: "under-construction", statusLabel: "Under construction" });
  assert.deepEqual(ukrainian.find((item) => item.id === "planned"), { id: "planned", label: "Заплановано", status: "under-construction", statusLabel: "У розробці" });
  assert.deepEqual(ukrainian.find((item) => item.id === "published"), { id: "published", label: "Опубліковано" });
});

test("supplements follow the chapters without a badge", () => {
  assert.deepEqual(topicNavigationItems(topics, supplements, "uk").map((item) => item.id), ["published", "planned", "videos"]);
  assert.deepEqual(topicNavigationItems(topics, supplements, "uk").at(-1), { id: "videos", label: "Навчальні відео" });
});
