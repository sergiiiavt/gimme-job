import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const [beginner, intermediate, advanced, expert, taxonomy, sources] = await Promise.all([
  readJson("../content/automation-learning/beginner-lessons.json"),
  readJson("../content/automation-learning/intermediate-lessons.json"),
  readJson("../content/automation-learning/advanced-lessons.json"),
  readJson("../content/automation-learning/expert-lessons.json"),
  readJson("../content/automation-learning/taxonomy.json"),
  readJson("../content/automation-learning/sources.json"),
]);

const lessons = [...beginner.lessons, ...intermediate.lessons, ...advanced.lessons, ...expert.lessons];
const levels = new Set(["Beginner", "Intermediate", "Advanced", "Expert"]);
const sourceIds = new Set(sources.map((source) => source.id));
const modules = taxonomy.filter((item) => item.level);
const moduleIds = new Set(modules.map((item) => item.id));
const lessonIds = new Set();
const lessonTitles = new Set();

assert.ok(lessons.length >= 43, "The test automation path must not regress below the current 43-lesson baseline.");
assert.equal(modules.length, 12, "The test automation taxonomy must contain exactly 12 modules.");

for (const source of sources) {
  assert.match(source.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid source id: ${source.id}`);
  assert.ok(source.title?.trim(), `Missing title for source ${source.id}`);
  assert.ok(source.url?.startsWith("https://"), `Source ${source.id} must cite an https URL`);
  assert.ok(source.publisher?.trim(), `Missing publisher for source ${source.id}`);
  assert.ok(source.role?.trim(), `Missing role for source ${source.id}`);
}

for (const curriculumModule of modules) {
  assert.match(curriculumModule.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid module id: ${curriculumModule.id}`);
  assert.ok(levels.has(curriculumModule.level), `Invalid level for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.label?.trim(), `Missing label for module ${curriculumModule.id}`);
  assert.ok(curriculumModule.description?.trim(), `Missing description for module ${curriculumModule.id}`);
}

for (const lesson of lessons) {
  assert.match(lesson.id, /^ta-lesson-[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid or non-namespaced lesson id: ${lesson.id}`);
  assert.ok(!lessonIds.has(lesson.id), `Duplicate lesson id: ${lesson.id}`);
  lessonIds.add(lesson.id);
  const normalizedTitle = lesson.title.trim().toLowerCase();
  assert.ok(!lessonTitles.has(normalizedTitle), `Duplicate lesson title: ${lesson.title}`);
  lessonTitles.add(normalizedTitle);

  assert.ok(moduleIds.has(lesson.moduleId), `Unknown module ${lesson.moduleId} in ${lesson.id}`);
  assert.ok(levels.has(lesson.level), `Invalid level for ${lesson.id}`);
  assert.ok(Number.isInteger(lesson.order) && lesson.order >= 1, `Invalid learning order for ${lesson.id}`);

  const moduleLevel = modules.find((item) => item.id === lesson.moduleId)?.level;
  assert.equal(lesson.level, moduleLevel, `Lesson ${lesson.id} disagrees with its module's level`);

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

  if (lesson.repoRefs !== undefined) {
    assert.ok(lesson.repoRefs.length > 0, `repoRefs, if present, must not be an empty array for ${lesson.id}`);
    for (const ref of lesson.repoRefs) {
      assert.ok(ref.label?.trim(), `Missing repoRef label in ${lesson.id}`);
      assert.ok(ref.path?.trim(), `Missing repoRef path in ${lesson.id}`);
      assert.ok(!ref.path.startsWith("/") && !/^https?:\/\//.test(ref.path), `repoRef path must be a relative repo path, not a URL: ${ref.path} in ${lesson.id}`);
      if (ref.kind !== undefined) {
        assert.ok(["implementation", "usage", "ci"].includes(ref.kind), `Invalid repoRef kind ${ref.kind} in ${lesson.id}`);
      }
    }
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

const citedSources = new Set(lessons.flatMap((lesson) => lesson.sourceIds));
const unusedSources = [...sourceIds].filter((id) => !citedSources.has(id));
assert.equal(unusedSources.length, 0, `Every source must be cited by at least one lesson. Unused: ${unusedSources.join(", ")}`);

console.log(`Test automation curriculum validated: ${lessons.length} lessons, ${modules.length} modules, ${sources.length} sources.`);
