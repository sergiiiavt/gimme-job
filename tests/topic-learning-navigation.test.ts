import assert from "node:assert/strict";
import test from "node:test";
import { topicNavigationItems, topicSectionNavigation } from "../app/topic-learning-navigation.ts";

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

test("translated TOC and rendered headings use the same nonempty canonical section IDs", () => {
  const canonical = [
    { id: "prepare-relevant-context", text: "Prepare relevant context" },
    { id: "independent-review-with-another-ai", text: "Independent review with another AI" },
    { id: "summary", text: "Summary" },
  ];
  const translated = [
    { id: "", text: "Підготуйте доречний контекст" },
    { id: "ai", text: "Незалежний перегляд іншою AI-моделлю" },
    { id: "", text: "Підсумок" },
  ];

  const ukrainian = topicSectionNavigation(translated, canonical);
  assert.deepEqual(ukrainian.headings.map((heading) => heading.id), canonical.map((heading) => heading.id));
  assert.equal(new Set(ukrainian.headings.map((heading) => heading.id)).size, 3);
  for (const heading of ukrainian.headings) {
    assert.equal(ukrainian.headingIdOverrides[heading.text], heading.id);
  }
  assert.equal(translated[0].id, "", "translation metadata is not mutated");

  const english = topicSectionNavigation(canonical, canonical);
  assert.deepEqual(english.headings, canonical, "existing English links are unchanged after switching back");
});

test("a heading without a canonical counterpart keeps its own ID or gets a stable fallback", () => {
  const result = topicSectionNavigation([
    { id: "local-section", text: "Local section" },
    { id: "", text: "Додатковий розділ" },
  ], []);

  assert.deepEqual(result.headings.map((heading) => heading.id), ["local-section", "section-2"]);
  assert.equal(result.headingIdOverrides["Додатковий розділ"], "section-2");
  assert.deepEqual(topicSectionNavigation([], []), { headings: [], headingIdOverrides: {} });
});
