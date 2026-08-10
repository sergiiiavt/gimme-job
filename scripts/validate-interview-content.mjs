import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentUrl = new URL("../content/interview/common-qa.json", import.meta.url);
const content = JSON.parse(await readFile(contentUrl, "utf8"));
const levels = new Set(["Junior", "Middle", "Senior", "Lead"]);
const sourceIds = new Set(content.sources.map((source) => source.id));
const questionIds = new Set();

assert.equal(typeof content.version, "number", "Content version is required.");
assert.match(content.lastReviewedAt, /^\d{4}-\d{2}-\d{2}$/, "lastReviewedAt must use YYYY-MM-DD.");
assert.ok(content.questions.length >= 30, "The common collection must contain at least 30 questions.");

for (const question of content.questions) {
  assert.match(question.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid question id: ${question.id}`);
  assert.ok(!questionIds.has(question.id), `Duplicate question id: ${question.id}`);
  questionIds.add(question.id);
  assert.ok(levels.has(question.level), `Invalid level for ${question.id}`);
  assert.ok(question.category?.trim(), `Missing category for ${question.id}`);
  assert.ok(question.question?.trim(), `Missing question for ${question.id}`);
  assert.ok(question.shortAnswer?.trim(), `Missing short answer for ${question.id}`);
  assert.ok(question.strongAnswerSignals?.length >= 2, `Add at least two answer signals for ${question.id}`);
  assert.ok(question.sourceIds?.length, `Add at least one source for ${question.id}`);
  for (const sourceId of question.sourceIds) {
    assert.ok(sourceIds.has(sourceId), `Unknown source ${sourceId} in ${question.id}`);
  }
}

console.log(`Interview content validated: ${content.questions.length} questions, ${content.sources.length} sources.`);
