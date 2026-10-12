import assert from "node:assert/strict";
import test from "node:test";
import { chapterReferencesEn, chapterSourcesLabel, sourcesNounUk, ukrainianPlural } from "../app/source-count-label.ts";

test("Ukrainian source counts agree with the number", () => {
  const expected: Array<[number, string]> = [
    [0, "джерел"], [1, "джерело"], [2, "джерела"], [4, "джерела"], [5, "джерел"], [11, "джерел"], [12, "джерел"],
    [14, "джерел"], [20, "джерел"], [21, "джерело"], [22, "джерела"], [25, "джерел"], [33, "джерела"],
    [111, "джерел"], [112, "джерел"], [121, "джерело"], [1004, "джерела"],
  ];
  for (const [count, noun] of expected) assert.equal(sourcesNounUk(count), noun, `${count}`);
});

test("the plural rule matches the Unicode CLDR rules for Ukrainian", () => {
  const rules = new Intl.PluralRules("uk");
  const forms: Record<string, string> = { one: "one", few: "few", many: "many" };
  for (let count = 0; count <= 1_000; count += 1) {
    assert.equal(ukrainianPlural(count, "one", "few", "many"), forms[rules.select(count)], `${count}`);
  }
});

test("registry status lines in both languages", () => {
  assert.equal(chapterSourcesLabel(33, "uk"), "33 джерела цього розділу");
  assert.equal(chapterSourcesLabel(21, "uk"), "21 джерело цього розділу");
  assert.equal(chapterSourcesLabel(20, "uk"), "20 джерел цього розділу");
  assert.equal(chapterSourcesLabel(1, "en"), "1 chapter reference");
  assert.equal(chapterSourcesLabel(33, "en"), "33 chapter references");
  assert.equal(chapterReferencesEn(0), "0 chapter references");
});
