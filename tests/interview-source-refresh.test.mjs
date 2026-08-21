import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reviewInterviewPrevalence } from "../scripts/interview-prevalence-policy.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

const expectedIds = [
  "mobile-pre-release-build-distribution",
  "mobile-proxy-traffic-debugging",
  "git-qa-workflow",
  "websocket-realtime-testing",
  "mobile-offline-sync-recovery",
  "mobile-upgrade-state-migration",
  "shift-left-in-practice",
  "automation-tool-selection",
];

test("keeps the source refresh small, explicit, and bilingual", async () => {
  const refresh = await readJson("content/interview/source-refresh-qa.json");

  assert.deepEqual(refresh.questions.map((question) => question.id), expectedIds);
  for (const question of refresh.questions) {
    assert.ok(question.questionUk?.trim());
    assert.ok(question.shortAnswerUk?.trim());
    assert.ok(question.example?.trim());
    assert.ok(question.exampleUk?.trim());
    assert.equal(question.strongAnswerSignalsUk.length, question.strongAnswerSignals.length);
    assert.equal(question.prevalence, reviewInterviewPrevalence(question));
  }
});

test("deduplicates recurrence by publisher family", () => {
  const base = {
    id: "source-family-test",
    category: "Mobile",
    question: "Which mobile tool would you use?",
    tags: ["mobile"],
    sourceIds: ["dou-qa-2022", "dou-qa-400-2023"],
  };

  assert.equal(reviewInterviewPrevalence(base), "Occasional");
  assert.equal(
    reviewInterviewPrevalence({ ...base, sourceIds: [...base.sourceIds, "asserthired-mobile-qa-2026"] }),
    "Common",
  );
});

test("keeps source evidence as overlays instead of duplicate questions", async () => {
  const [evidence, refreshSources] = await Promise.all([
    readJson("content/interview/source-evidence-overrides.json"),
    readJson("content/interview/source-refresh-sources.json"),
  ]);

  assert.equal(new Set(evidence.map((item) => item.id)).size, evidence.length);
  assert.equal(new Set(refreshSources.map((item) => item.id)).size, refreshSources.length);
  assert.ok(evidence.some((item) => item.id === "severity-versus-priority"));
  assert.ok(evidence.some((item) => item.id === "quality-metrics" && item.prevalence === "Common"));
  assert.ok(refreshSources.some((source) => source.id === "dou-qa-400-2023"));
  assert.ok(refreshSources.some((source) => source.id === "hillel-qa-interviewer-2025"));
});
