import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const model = await import("../app/istqb-ai-official-sample-model.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("official CT-AI answer sheet mirrors the v2.2 40-question answer key and 44-point structure", () => {
  assert.equal(model.OFFICIAL_MAIN_QUESTIONS.length, 40);
  assert.equal(model.OFFICIAL_MAIN_TOTAL_POINTS, 44);
  assert.equal(model.OFFICIAL_MAIN_PASSING_SCORE, 29);
  assert.equal(model.OFFICIAL_MAIN_QUESTIONS.reduce((sum, question) => sum + question.points, 0), 44);

  assert.deepEqual(model.OFFICIAL_MAIN_QUESTIONS.find((question) => question.number === 2)?.correct, ["c", "e"]);
  assert.deepEqual(model.OFFICIAL_MAIN_QUESTIONS.find((question) => question.number === 19)?.correct, ["b"]);
  assert.deepEqual(model.OFFICIAL_MAIN_QUESTIONS.find((question) => question.number === 39)?.correct, ["b", "d"]);

  const perfectAnswers = Object.fromEntries(model.OFFICIAL_MAIN_QUESTIONS.map((question) => [question.number, [...question.correct]]));
  assert.deepEqual(model.scoreOfficialMain(perfectAnswers), { points: 44, correctQuestions: 40 });
});

test("all six additional v2.2 examples can be scored separately", () => {
  assert.deepEqual(Object.keys(model.OFFICIAL_ADDITIONAL_KEYS), ["A1", "A2", "A3", "A4", "A5", "A6"]);
  assert.deepEqual(model.OFFICIAL_ADDITIONAL_KEYS.A5, ["1", "4", "2", "5", "3"]);
  assert.equal(model.scoreOfficialAdditional(model.OFFICIAL_ADDITIONAL_KEYS), 6);
});

test("official sample companion embeds ISTQB source material without republishing question wording", async () => {
  const component = await read("app/istqb-ai-official-sample-companion.tsx");

  assert.match(component, /download_id=9561/);
  assert.match(component, /download_id=9564/);
  assert.match(component, /<iframe/);
  assert.match(component, /OFFICIAL_MAIN_PASSING_SCORE/);
  assert.match(component, /Check 40-question score/);
  assert.match(component, /Перевірити результат 40 запитань/);
  assert.match(component, /GimmeJob does not republish the question text/);
  assert.doesNotMatch(component, /Which of the following statements BEST highlights the difference/);
  assert.doesNotMatch(component, /AI-based systems tend to learn from patterns in data/);
  assert.doesNotMatch(component, /localStorage|sessionStorage/);
});
