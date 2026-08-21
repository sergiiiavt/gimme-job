import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reviewInterviewPrevalence } from "./interview-prevalence-policy.mjs";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const [
  common,
  canonical,
  databaseSql,
  observabilityProduction,
  restoredCoverage,
  testingFoundations,
  embedded,
  modernSdet,
  coreFoundations,
  expanded,
  sourceRefresh,
  baseSources,
  sourceRefreshSources,
  sourceEvidence,
  taxonomy,
] = await Promise.all([
  readJson("../content/interview/common-qa.json"),
  readJson("../content/interview/canonical-baseline.json"),
  readJson("../content/interview/database-sql-qa.json"),
  readJson("../content/interview/observability-production-qa.json"),
  readJson("../content/interview/restored-coverage-qa.json"),
  readJson("../content/interview/testing-foundations-qa.json"),
  readJson("../content/interview/embedded-qa.json"),
  readJson("../content/interview/modern-sdet-qa.json"),
  readJson("../content/interview/core-foundations-qa.json"),
  readJson("../content/interview/expanded-qa.json"),
  readJson("../content/interview/source-refresh-qa.json"),
  readJson("../content/interview/sources.json"),
  readJson("../content/interview/source-refresh-sources.json"),
  readJson("../content/interview/source-evidence-overrides.json"),
  readJson("../content/interview/taxonomy.json"),
]);

const baseQuestions = [
  ...common.questions,
  ...canonical.questions,
  ...databaseSql.questions,
  ...observabilityProduction.questions,
  ...restoredCoverage.questions,
  ...testingFoundations.questions,
  ...embedded.questions,
  ...modernSdet.questions,
  ...coreFoundations.questions,
  ...expanded.questions,
];
const baseQuestionById = new Map(baseQuestions.map((question) => [question.id, question]));
const baseQuestionTexts = new Set(baseQuestions.map((question) => question.question.trim().toLowerCase()));
const baseSourceIds = new Set(baseSources.map((source) => source.id));
const extensionSourceIds = new Set(sourceRefreshSources.map((source) => source.id));
const allSourceIds = new Set([...baseSourceIds, ...extensionSourceIds]);
const categories = new Set(taxonomy.flatMap((item) => item.category ? [item.category] : []));
const levels = new Set(["Junior", "Middle", "Senior", "Lead"]);
const kinds = new Set(["Theory", "Practical", "Troubleshooting", "Test design", "Scenario", "Security", "Strategy", "Risk analysis", "Release decision", "Leadership", "Behavioral", "Performance", "Integration", "Operations", "Reliability", "Automation"]);
const prevalenceLevels = new Set(["Very common", "Common", "Occasional", "Specialist"]);
const deprecatedTags = new Set(["defect", "risks", "audit-trail", "test-plan", "test-case", "test-condition", "state-transitions", "pipelines", "environments", "integrations", "reviews", "oracles", "browsers", "reconnection"]);

assert.equal(sourceRefresh.questions.length, 8, "The audited source refresh must contain exactly 8 new canonical questions.");
assert.equal(sourceRefreshSources.length, 12, "The audited source extension must contain exactly 12 sources.");
assert.equal(extensionSourceIds.size, sourceRefreshSources.length, "Refresh source IDs must be unique.");
assert.equal(new Set(sourceEvidence.map((item) => item.id)).size, sourceEvidence.length, "Evidence override IDs must be unique.");

for (const source of sourceRefreshSources) {
  assert.ok(!baseSourceIds.has(source.id), `Refresh source duplicates the base registry: ${source.id}`);
  assert.match(source.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid refresh source id: ${source.id}`);
  assert.ok(source.title?.trim(), `Missing refresh source title for ${source.id}`);
  assert.match(source.url, /^https:\/\//, `Refresh source URL must use HTTPS: ${source.id}`);
  assert.ok(source.publisher?.trim(), `Missing refresh source publisher for ${source.id}`);
  assert.ok(source.role?.trim(), `Missing refresh source role for ${source.id}`);
}

for (const evidence of sourceEvidence) {
  const baseQuestion = baseQuestionById.get(evidence.id);
  assert.ok(baseQuestion, `Evidence override target does not exist: ${evidence.id}`);
  assert.ok(evidence.sourceIds?.length, `Evidence override needs at least one source: ${evidence.id}`);
  for (const sourceId of evidence.sourceIds) {
    assert.ok(allSourceIds.has(sourceId), `Unknown evidence source ${sourceId} for ${evidence.id}`);
  }
  if (evidence.prevalence) {
    assert.ok(prevalenceLevels.has(evidence.prevalence), `Invalid evidence prevalence for ${evidence.id}`);
  }

  const merged = {
    ...baseQuestion,
    sourceIds: [...new Set([...baseQuestion.sourceIds, ...evidence.sourceIds])],
    prevalence: evidence.prevalence ?? baseQuestion.prevalence,
  };
  assert.equal(merged.prevalence, reviewInterviewPrevalence(merged), `Merged prevalence is stale for ${evidence.id}`);
}

const refreshIds = new Set();
const refreshTexts = new Set();
for (const question of sourceRefresh.questions) {
  assert.match(question.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid refresh question id: ${question.id}`);
  assert.ok(!baseQuestionById.has(question.id), `Refresh question duplicates an existing ID: ${question.id}`);
  assert.ok(!refreshIds.has(question.id), `Duplicate refresh question ID: ${question.id}`);
  refreshIds.add(question.id);

  const normalizedText = question.question.trim().toLowerCase();
  assert.ok(!baseQuestionTexts.has(normalizedText), `Refresh question duplicates existing text: ${question.question}`);
  assert.ok(!refreshTexts.has(normalizedText), `Duplicate refresh question text: ${question.question}`);
  refreshTexts.add(normalizedText);

  assert.ok(levels.has(question.level), `Invalid level for ${question.id}`);
  assert.ok(categories.has(question.category), `Unknown category ${question.category} in ${question.id}`);
  assert.ok(kinds.has(question.kind), `Invalid kind for ${question.id}`);
  assert.ok(prevalenceLevels.has(question.prevalence), `Invalid prevalence for ${question.id}`);
  assert.equal(question.prevalence, reviewInterviewPrevalence(question), `Prevalence is not reviewed by current policy for ${question.id}`);
  assert.ok(question.question?.trim(), `Missing question for ${question.id}`);
  assert.ok(question.shortAnswer?.trim()?.length >= 100, `Answer is too short for ${question.id}`);
  assert.ok(question.questionUk?.trim(), `Missing Ukrainian question for ${question.id}`);
  assert.ok(question.shortAnswerUk?.trim()?.length >= 100, `Ukrainian answer is too short for ${question.id}`);
  assert.ok(question.strongAnswerSignals?.length >= 2, `Add answer signals for ${question.id}`);
  assert.equal(question.strongAnswerSignalsUk?.length, question.strongAnswerSignals.length, `Ukrainian signals must match English signals for ${question.id}`);
  assert.ok(question.example?.trim()?.length >= 60, `Example is too short for ${question.id}`);
  assert.ok(question.exampleUk?.trim()?.length >= 60, `Ukrainian example is too short for ${question.id}`);
  assert.ok(question.sourceIds?.length >= 2, `Refresh question needs interview and/or technical source evidence: ${question.id}`);

  for (const tag of question.tags ?? []) {
    assert.match(tag, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid tag ${tag} in ${question.id}`);
    assert.ok(!deprecatedTags.has(tag), `Replace deprecated tag ${tag} in ${question.id}`);
  }
  for (const sourceId of question.sourceIds) {
    assert.ok(allSourceIds.has(sourceId), `Unknown source ${sourceId} in ${question.id}`);
  }
}

const referencedExtensionSources = new Set([
  ...sourceRefresh.questions.flatMap((question) => question.sourceIds),
  ...sourceEvidence.flatMap((evidence) => evidence.sourceIds),
].filter((sourceId) => extensionSourceIds.has(sourceId)));
assert.deepEqual(referencedExtensionSources, extensionSourceIds, "Every source-refresh source must be referenced by a question or evidence overlay.");

const samePublisherDou = {
  id: "policy-dou-family-check",
  category: "Mobile",
  question: "Which mobile tool would you use?",
  tags: ["mobile"],
  sourceIds: ["dou-qa-2022", "dou-qa-400-2023"],
};
assert.equal(reviewInterviewPrevalence(samePublisherDou), "Occasional", "Two DOU collections must count as one source family.");
assert.equal(
  reviewInterviewPrevalence({ ...samePublisherDou, sourceIds: [...samePublisherDou.sourceIds, "asserthired-mobile-qa-2026"] }),
  "Common",
  "A genuinely independent second interview source family should raise recurrence to Common.",
);

console.log(`Interview source refresh validated: ${sourceRefresh.questions.length} questions, ${sourceEvidence.length} evidence overlays, ${sourceRefreshSources.length} new sources.`);
