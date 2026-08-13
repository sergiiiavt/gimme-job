import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const [beginner, intermediate, advanced, expert, taxonomy, sources] = await Promise.all([
  readJson("../content/python-learning/beginner-lessons.json"),
  readJson("../content/python-learning/intermediate-lessons.json"),
  readJson("../content/python-learning/advanced-lessons.json"),
  readJson("../content/python-learning/expert-lessons.json"),
  readJson("../content/python-learning/taxonomy.json"),
  readJson("../content/python-interview/sources.json"),
]);

const lessons = [...beginner.lessons, ...intermediate.lessons, ...advanced.lessons, ...expert.lessons];
const levels = new Set(["Beginner", "Intermediate", "Advanced", "Expert"]);
const sourceIds = new Set(sources.map((source) => source.id));
const modules = taxonomy.filter((item) => item.level);
const moduleIds = new Set(modules.map((item) => item.id));
const lessonIds = new Set();
const lessonTitles = new Set();

assert.ok(lessons.length >= 64, "The Python curriculum must not regress below the current 64-lesson baseline.");
assert.equal(modules.length, 15, "The Python curriculum taxonomy must contain exactly 15 modules.");

for (const curriculumModule of modules) {
  assert.match(curriculumModule.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid module id: ${curriculumModule.id}`);
  assert.ok(levels.has(curriculumModule.level), `Invalid level for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.label?.trim(), `Missing label for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.description?.trim(), `Missing description for module ${curriculumModule.id}`);
}

for (const lesson of lessons) {
  assert.match(lesson.id, /^py-lesson-[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid or non-namespaced lesson id: ${lesson.id}`);
  assert.ok(!lessonIds.has(lesson.id), `Duplicate lesson id: ${lesson.id}`);
  lessonIds.add(lesson.id);
  const normalizedTitle = lesson.title.trim().toLowerCase();
  assert.ok(!lessonTitles.has(normalizedTitle), `Duplicate lesson title: ${lesson.title}`);
  lessonTitles.add(normalizedTitle);

  assert.ok(moduleIds.has(lesson.moduleId), `Unknown module ${lesson.moduleId} in ${lesson.id}`);
  assert.ok(levels.has(lesson.level), `Invalid level for ${lesson.id}`);

  assert.ok(lesson.title?.trim(), `Missing title for ${lesson.id}`);
  assert.ok(lesson.titleUk?.trim(), `Missing Ukrainian title for ${lesson.id}`);
  assert.ok(lesson.summary?.trim(), `Missing summary for ${lesson.id}`);
  assert.ok(lesson.summaryUk?.trim(), `Missing Ukrainian summary for ${lesson.id}`);
  assert.ok(lesson.concept?.trim(), `Missing concept for ${lesson.id}`);
  assert.ok(lesson.concept.trim().length >= 200, `Concept explanation is too short for ${lesson.id}`);
  assert.ok(lesson.conceptUk?.trim(), `Missing Ukrainian concept for ${lesson.id}`);
  assert.ok(lesson.conceptUk.trim().length >= 200, `Ukrainian concept explanation is too short for ${lesson.id}`);

  assert.ok(lesson.keyPoints?.length >= 2, `Add at least two key points for ${lesson.id}`);
  assert.ok(lesson.keyPointsUk?.length === lesson.keyPoints.length, `Ukrainian key points must match the English count for ${lesson.id}`);
  assert.ok(lesson.pitfalls?.length >= 1, `Add at least one pitfall for ${lesson.id}`);
  assert.ok(lesson.pitfallsUk?.length === lesson.pitfalls.length, `Ukrainian pitfalls must match the English count for ${lesson.id}`);

  if (lesson.code !== undefined) {
    assert.ok(lesson.code.trim().length >= 10, `Code sample is too short for ${lesson.id}`);
    assert.ok(lesson.codeCaption?.trim(), `Missing code caption for ${lesson.id}`);
    assert.ok(lesson.codeCaptionUk?.trim(), `Missing Ukrainian code caption for ${lesson.id}`);
  }
  if (lesson.exercise !== undefined) {
    assert.ok(lesson.exercise.trim().length >= 30, `Exercise prompt is too short for ${lesson.id}`);
    assert.ok(lesson.exerciseUk?.trim(), `Missing Ukrainian exercise for ${lesson.id}`);
  }

  for (const tag of lesson.tags ?? []) {
    assert.match(tag, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid tag ${tag} in ${lesson.id}`);
  }

  assert.ok(lesson.sourceIds?.length, `Add at least one source for ${lesson.id}`);
  for (const sourceId of lesson.sourceIds) {
    assert.ok(sourceIds.has(sourceId), `Unknown source ${sourceId} in ${lesson.id}`);
  }
}

for (const curriculumModule of modules) {
  const count = lessons.filter((lesson) => lesson.moduleId === curriculumModule.id).length;
  assert.ok(count >= 3, `Module ${curriculumModule.id} must contain at least 3 lessons, found ${count}.`);
}

for (const level of levels) {
  assert.ok(lessons.some((lesson) => lesson.level === level), `No lessons use level ${level}`);
}

console.log(`Python curriculum validated: ${lessons.length} lessons, ${modules.length} modules.`);
