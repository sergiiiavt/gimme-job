import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const [
  beginner,
  intermediate,
  advanced,
  expert,
  taxonomy,
  baseSources,
  learningSources,
  quickReference,
  coverageBaseline,
] = await Promise.all([
  readJson("../content/python-learning/beginner-lessons.json"),
  readJson("../content/python-learning/intermediate-lessons.json"),
  readJson("../content/python-learning/advanced-lessons.json"),
  readJson("../content/python-learning/expert-lessons.json"),
  readJson("../content/python-learning/taxonomy.json"),
  readJson("../content/python-interview/sources.json"),
  readJson("../content/python-learning/sources.json"),
  readJson("../content/python-learning/quick-reference.json"),
  readJson("../content/python-learning/coverage-baseline.json"),
]);

const lessons = [...beginner.lessons, ...intermediate.lessons, ...advanced.lessons, ...expert.lessons];
const sources = [...baseSources, ...learningSources];
const levels = new Set(["Beginner", "Intermediate", "Advanced", "Expert"]);
const sourceIds = new Set(sources.map((source) => source.id));
const modules = taxonomy.filter((item) => item.level);
const moduleIds = new Set(modules.map((item) => item.id));
const moduleById = new Map(modules.map((item) => [item.id, item]));
const lessonIds = new Set();
const lessonTitles = new Set();

assert.equal(sourceIds.size, sources.length, "Python curriculum source IDs must be unique across shared and learning-specific sources.");
assert.ok(
  lessons.length >= coverageBaseline.minimumLessons,
  `The Python curriculum must not regress below the coverage baseline of ${coverageBaseline.minimumLessons} lessons.`,
);
assert.ok(
  modules.length >= coverageBaseline.minimumModules,
  `The Python curriculum must not regress below the coverage baseline of ${coverageBaseline.minimumModules} modules.`,
);

for (const source of learningSources) {
  assert.match(source.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid learning source id: ${source.id}`);
  assert.ok(source.title?.trim(), `Missing title for learning source ${source.id}`);
  assert.match(source.url, /^https:\/\//, `Learning source URL must use HTTPS: ${source.id}`);
  assert.ok(source.publisher?.trim(), `Missing publisher for learning source ${source.id}`);
  assert.ok(source.kind?.trim(), `Missing kind for learning source ${source.id}`);
  assert.ok(source.role?.trim(), `Missing role for learning source ${source.id}`);
}

for (const curriculumModule of modules) {
  assert.match(curriculumModule.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid module id: ${curriculumModule.id}`);
  assert.ok(levels.has(curriculumModule.level), `Invalid level for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.label?.trim(), `Missing label for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.labelUk?.trim(), `Missing Ukrainian label for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.description?.trim(), `Missing description for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.descriptionUk?.trim(), `Missing Ukrainian description for module ${curriculumModule.id}`);
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
  assert.equal(
    lesson.level,
    moduleById.get(lesson.moduleId).level,
    `Lesson level must match module level for ${lesson.id}`,
  );
  assert.ok(Number.isInteger(lesson.order) && lesson.order >= 1, `Invalid learning order for ${lesson.id}`);

  assert.ok(lesson.title?.trim(), `Missing title for ${lesson.id}`);
  assert.ok(lesson.titleUk?.trim(), `Missing Ukrainian title for ${lesson.id}`);
  assert.ok(lesson.summary?.trim(), `Missing summary for ${lesson.id}`);
  assert.ok(lesson.summaryUk?.trim(), `Missing Ukrainian summary for ${lesson.id}`);
  assert.ok(lesson.concept?.trim(), `Missing concept for ${lesson.id}`);
  assert.ok(lesson.concept.trim().length >= 200, `Concept explanation is too short for ${lesson.id}`);
  assert.ok(lesson.conceptUk?.trim(), `Missing Ukrainian concept explanation for ${lesson.id}`);
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

const orders = lessons.map((lesson) => lesson.order).sort((a, b) => a - b);
assert.equal(new Set(orders).size, orders.length, "Every lesson's learning order must be unique.");
assert.deepEqual(orders, lessons.map((_, index) => index + 1), "Learning order values must form a contiguous 1..N sequence.");

for (const level of levels) {
  assert.ok(lessons.some((lesson) => lesson.level === level), `No lessons use level ${level}`);
}

const referencedLearningSourceIds = new Set(
  lessons.flatMap((lesson) => lesson.sourceIds).filter((sourceId) => learningSources.some((source) => source.id === sourceId)),
);
for (const source of learningSources) {
  assert.ok(referencedLearningSourceIds.has(source.id), `Learning-specific source ${source.id} is not referenced by any lesson.`);
}

const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
const quickReferenceText = JSON.stringify(quickReference).toLowerCase();

for (const requirement of coverageBaseline.requirements) {
  const lesson = lessonsById.get(requirement.lessonId);
  assert.ok(lesson, `Coverage requirement ${requirement.id} is missing lesson ${requirement.lessonId}.`);
  const lessonText = JSON.stringify(lesson).toLowerCase();

  for (const needle of requirement.lessonNeedles ?? []) {
    assert.ok(
      lessonText.includes(needle.toLowerCase()),
      `Coverage requirement ${requirement.id} expects "${needle}" in ${requirement.lessonId}.`,
    );
  }

  for (const needle of requirement.quickReferenceNeedles ?? []) {
    assert.ok(
      quickReferenceText.includes(needle.toLowerCase()),
      `Coverage requirement ${requirement.id} expects "${needle}" in the Python Quick Reference.`,
    );
  }
}

console.log(
  `Python curriculum validated: ${lessons.length} lessons, ${modules.length} modules, ${learningSources.length} curriculum-specific sources, ${coverageBaseline.requirements.length} coverage requirements.`,
);
