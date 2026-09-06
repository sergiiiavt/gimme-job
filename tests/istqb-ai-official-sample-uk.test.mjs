import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { default: catalog } = await import("../content/istqb-ai-testing/catalog.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("official CT-AI sample module ships maintained Ukrainian copy", () => {
  const official = catalog.taxonomy.find((module) => module.id === "official-sample-exam");

  assert.ok(official);
  assert.equal(official.count, 46);
  assert.equal(official.labelUk, "Офіційний приклад іспиту ISTQB — 46 запитань");
  assert.equal(official.navLabelUk, "Офіційний приклад · 46");
  assert.match(official.levelUk, /Офіційна екзаменаційна практика/);
  assert.match(official.descriptionUk, /40 запитань.*6 додаткових/s);
  assert.match(official.markdownUk, /^# Офіційний приклад іспиту ISTQB — 46 запитань/m);
  assert.match(official.markdownUk, /Усього офіційних прикладів.*46/s);
  assert.match(official.markdownUk, /download_id=9561/);
  assert.match(official.markdownUk, /download_id=9564/);
  assert.match(official.markdownUk, /не публікуємо власний переклад 46 офіційних запитань/i);
});

test("CT-AI catalog exposes Ukrainian page metadata", () => {
  assert.equal(catalog.titleUk, "Підготовка до іспиту ISTQB CT-AI v2.0");
  assert.match(catalog.descriptionUk, /46 офіційних sample questions ISTQB v2\.2/);
  assert.ok(catalog.version >= 4);
});

test("certification page enables Ukrainian only for localized modules", async () => {
  const page = await read("app/istqb-ai-testing-page.tsx");

  assert.match(page, /type LearningLanguage/);
  assert.match(page, /useState<LearningLanguage>\("en"\)/);
  assert.match(page, /function hasUkrainian/);
  assert.match(page, /activeModuleHasUkrainian/);
  assert.match(page, /const effectiveLanguage: LearningLanguage = language === "uk" && activeModuleHasUkrainian \? "uk" : "en"/);
  assert.match(page, /languages=\{activeModuleHasUkrainian \? \["en", "uk"\] : \["en"\]\}/);
  assert.match(page, /language === "uk" && !hasUkrainian\(chapter\)/);
  assert.match(page, /activeModule\.markdownUk/);
  assert.match(page, /language=\{effectiveLanguage\}/);
  assert.match(page, /Сертифікації/);
  assert.match(page, /офіційних прикладів запитань/);
  assert.match(page, /Навігація розділами ISTQB CT-AI/);
  assert.doesNotMatch(page, /\[activeModule, language\]/);
});
