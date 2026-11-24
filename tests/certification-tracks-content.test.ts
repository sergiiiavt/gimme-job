import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [
  { aiEngineeringCertificationCatalogs },
  { istqbCertificationCatalogs },
  { isMockExamModuleId },
  { parseIstqbAiMockExam },
  { default: ctAiCatalog },
] = await Promise.all([
  import("../content/ai-engineering-certifications/catalog.ts"),
  import("../content/istqb-certifications/catalog.ts"),
  import("../content/certification-catalog.ts"),
  import("../app/istqb-ai-mock-exam-model.ts"),
  import("../content/istqb-ai-testing/catalog.ts"),
]);

const certificationTracks = [...istqbCertificationCatalogs, ...aiEngineeringCertificationCatalogs];

type Catalog = (typeof certificationTracks)[number];

const expectedMockQuestions: Record<string, number> = {
  "ctfl-v4": 40,
  "ct-genai-v1": 40,
  "claude-101": 15,
  "claude-code-101": 15,
  "claude-platform-101": 15,
  "claude-architect": 40,
  "claude-developer": 30,
  "github-copilot-gh-300": 30,
};

const mockExam = (catalog: Catalog) => {
  const mockChapter = catalog.taxonomy.find((chapter) => isMockExamModuleId(chapter.id));
  assert.ok(mockChapter, `${catalog.trackId} has a mock exam`);
  return { mockChapter, exam: parseIstqbAiMockExam(mockChapter.markdown) };
};

test("certification tracks have unique ids and resolvable sources", () => {
  const trackIds = certificationTracks.map((catalog) => catalog.trackId);
  assert.equal(new Set(trackIds).size, trackIds.length);

  for (const catalog of certificationTracks) {
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

test("topic ids are unique across all tracks on /learn/certifications", () => {
  const ids = [ctAiCatalog, ...certificationTracks].flatMap((catalog) => catalog.taxonomy.map((chapter: { id: string }) => chapter.id));
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicates, []);
});

test("certification track chapters publish retrievable sections", () => {
  for (const catalog of certificationTracks) {
    for (const chapter of catalog.taxonomy) {
      assert.match(chapter.markdown, /^# \S/, `${catalog.trackId}/${chapter.id} starts with a title`);
      assert.ok(chapter.count > 0, `${catalog.trackId}/${chapter.id} has a positive count`);
      assert.ok((chapter.markdown.match(/^## /gm) ?? []).length >= 2, `${catalog.trackId}/${chapter.id} has at least two sections`);
      assert.doesNotMatch(chapter.markdown, /under-construction/i);
    }
  }
});

test("certification mock exams parse completely with the shared mock exam model", () => {
  for (const catalog of certificationTracks) {
    const { mockChapter, exam } = mockExam(catalog);
    assert.equal(exam.questions.length, expectedMockQuestions[catalog.trackId], `${catalog.trackId} question count`);
    assert.equal(mockChapter.count, exam.questions.length, `${catalog.trackId} module count matches the questions`);
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

test("certification mock exam answers cannot be guessed by position or option length", () => {
  for (const catalog of certificationTracks) {
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

test("each Claude exam and course badge has its own self-contained track", () => {
  const byId = new Map(certificationTracks.map((catalog) => [catalog.trackId, catalog]));
  const text = (trackId: string) => byId.get(trackId)?.taxonomy.map((chapter) => chapter.markdown).join("\n") ?? "";
  const opening = (trackId: string) => byId.get(trackId)?.taxonomy[0]?.markdown ?? "";

  for (const [trackId, course] of [["claude-101", "Claude 101"], ["claude-code-101", "Claude Code 101"], ["claude-platform-101", "Claude Platform 101"]]) {
    assert.match(opening(trackId), new RegExp(`^# ${course}: course map`), `${trackId} opens on its own course`);
    assert.match(opening(trackId), /Claude Academy/);
    assert.doesNotMatch(text(trackId), /720 passes/, `${trackId} holds no proctored-exam rules`);
  }

  assert.match(opening("claude-architect"), /Claude Certified Architect – Foundations \(CCAR-F\)/);
  assert.doesNotMatch(text("claude-architect"), /CCDV-F API delta|## CCDV-F domains|developer API chapter/, "CCAR-F holds no CCDV-F prep");
  assert.doesNotMatch(text("claude-architect"), /free Claude Academy certificates/, "the 101 courses live in their own tiles");

  assert.match(opening("claude-developer"), /Claude Certified Developer – Foundations \(CCDV-F\)/);
  assert.ok(byId.get("claude-developer")?.taxonomy.some((chapter) => chapter.id === "developer-api"), "the developer-api topic id moved with its content");

  for (const trackId of ["claude-101", "claude-code-101", "claude-platform-101", "claude-architect", "claude-developer"]) {
    assert.ok(byId.get(trackId)?.taxonomy.some((chapter) => isMockExamModuleId(chapter.id)), `${trackId} has practice questions`);
  }
});
