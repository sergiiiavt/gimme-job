import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [
  { aiEngineeringCertificationCatalogs, isMockExamModuleId },
  { parseIstqbAiMockExam },
] = await Promise.all([
  import("../content/ai-engineering-certifications/catalog.ts"),
  import("../app/istqb-ai-mock-exam-model.ts"),
]);

type Catalog = (typeof aiEngineeringCertificationCatalogs)[number];

const expectedMockQuestions: Record<string, number> = {
  "claude-architect": 40,
  "github-copilot-gh-300": 30,
};

const mockExam = (catalog: Catalog) => {
  const module = catalog.taxonomy.find((chapter) => isMockExamModuleId(chapter.id));
  assert.ok(module, `${catalog.trackId} has a mock exam`);
  return { module, exam: parseIstqbAiMockExam(module.markdown) };
};

test("AI engineering certification tracks have unique ids and resolvable sources", () => {
  const trackIds = aiEngineeringCertificationCatalogs.map((catalog) => catalog.trackId);
  assert.equal(new Set(trackIds).size, trackIds.length);

  for (const catalog of aiEngineeringCertificationCatalogs) {
    const moduleIds = catalog.taxonomy.map((chapter) => chapter.id);
    assert.equal(new Set(moduleIds).size, moduleIds.length, `${catalog.trackId} module ids are unique`);

    const sourceIds = new Set(catalog.sources.map((source) => source.id));
    assert.equal(sourceIds.size, catalog.sources.length, `${catalog.trackId} source ids are unique`);

    for (const chapter of catalog.taxonomy) {
      assert.ok(chapter.sourceIds.length > 0, `${catalog.trackId}/${chapter.id} cites a source`);
      for (const id of chapter.sourceIds) {
        assert.ok(sourceIds.has(id), `${catalog.trackId}/${chapter.id} cites unknown source ${id}`);
      }
    }
  }
});

test("AI engineering certification chapters publish retrievable sections", () => {
  for (const catalog of aiEngineeringCertificationCatalogs) {
    for (const chapter of catalog.taxonomy) {
      assert.match(chapter.markdown, /^# \S/, `${catalog.trackId}/${chapter.id} starts with a title`);
      assert.ok(chapter.count > 0, `${catalog.trackId}/${chapter.id} has a positive count`);
      assert.ok((chapter.markdown.match(/^## /gm) ?? []).length >= 2, `${catalog.trackId}/${chapter.id} has at least two sections`);
      assert.doesNotMatch(chapter.markdown, /under-construction/i);
    }
  }
});

test("AI engineering mock exams parse completely with the shared mock exam model", () => {
  for (const catalog of aiEngineeringCertificationCatalogs) {
    const { module, exam } = mockExam(catalog);
    assert.equal(exam.questions.length, expectedMockQuestions[catalog.trackId], `${catalog.trackId} question count`);
    assert.equal(module.count, exam.questions.length, `${catalog.trackId} module count matches the questions`);
    assert.ok(exam.introduction.startsWith("# "), `${catalog.trackId} mock exam has an introduction`);

    exam.questions.forEach((question, index) => {
      const label = `${catalog.trackId} question ${question.number}`;
      assert.equal(question.number, index + 1, `${label} is numbered in order`);
      assert.ok(question.prompt.length > 10, `${label} has a prompt`);
      assert.deepEqual(question.options.map((option) => option.key), ["A", "B", "C", "D"], `${label} has options A to D`);
      assert.ok(question.correctAnswer, `${label} has an answer`);
      assert.ok(question.explanation && question.explanation.length > 20, `${label} has an explanation`);
    });
  }
});

test("AI engineering mock exam answers cannot be guessed by position or option length", () => {
  for (const catalog of aiEngineeringCertificationCatalogs) {
    const { exam } = mockExam(catalog);
    const total = exam.questions.length;

    for (const key of ["A", "B", "C", "D"]) {
      const share = exam.questions.filter((question) => question.correctAnswer === key).length / total;
      assert.ok(share >= 0.15 && share <= 0.35, `${catalog.trackId} answer ${key} share ${share.toFixed(2)} is balanced`);
    }

    const correctIsStrictlyLongest = exam.questions.filter((question) => {
      const correct = question.options.find((option) => option.key === question.correctAnswer);
      const others = question.options.filter((option) => option.key !== question.correctAnswer);
      return correct !== undefined && others.every((option) => correct.text.length > option.text.length);
    }).length;
    assert.ok(correctIsStrictlyLongest / total < 0.5, `${catalog.trackId} correct answer is the longest option in ${correctIsStrictlyLongest} of ${total}`);
  }
});
