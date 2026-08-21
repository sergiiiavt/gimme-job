import common from "./common-qa.json";
import canonical from "./canonical-baseline.json";
import databaseSql from "./database-sql-qa.json";
import sqlPracticalInterview from "./sql-practical-interview";
import sqlCodeExamples from "./sql-code-examples";
import observabilityProduction from "./observability-production-qa.json";
import restoredCoverage from "./restored-coverage-qa.json";
import testingFoundations from "./testing-foundations-qa.json";
import embedded from "./embedded-qa.json";
import modernSdet from "./modern-sdet-qa.json";
import coreFoundations from "./core-foundations-qa.json";
import expanded from "./expanded-qa.json";
import sourceRefresh from "./source-refresh-qa.json";
import baseSources from "./sources.json";
import sourceRefreshSources from "./source-refresh-sources.json";
import sourceEvidence from "./source-evidence-overrides.json";
import taxonomy from "./taxonomy.json";

const sourceEvidenceById = new Map(sourceEvidence.map((item) => [item.id, item]));
const sqlCodeExamplesById = new Map(sqlCodeExamples.map((item) => [item.id, item.codeExamples]));

function applySourceEvidence<T extends { id: string; sourceIds: string[]; prevalence: string }>(question: T): T {
  const evidence = sourceEvidenceById.get(question.id);
  if (!evidence) return question;

  return {
    ...question,
    sourceIds: [...new Set([...question.sourceIds, ...evidence.sourceIds])],
    prevalence: "prevalence" in evidence ? evidence.prevalence : question.prevalence,
  } as T;
}

function applySqlCodeExamples<T extends { id: string }>(question: T) {
  const codeExamples = sqlCodeExamplesById.get(question.id);
  return codeExamples ? { ...question, codeExamples } : question;
}

const questions = [
  ...common.questions,
  ...canonical.questions,
  ...databaseSql.questions,
  ...sqlPracticalInterview.questions,
  ...observabilityProduction.questions,
  ...restoredCoverage.questions,
  ...testingFoundations.questions,
  ...embedded.questions,
  ...modernSdet.questions,
  ...coreFoundations.questions,
  ...expanded.questions,
  ...sourceRefresh.questions,
].map(applySourceEvidence).map(applySqlCodeExamples);

const sources = [...baseSources, ...sourceRefreshSources];

export const interviewCatalog = {
  version: 15,
  title: "QA interview knowledge base",
  description: "Canonical interview questions with original answers, practical signals, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-21",
  methodology: {
    coverage: "Ukrainian and international interview evidence is reviewed together. DOU 250+/400+ and current Hillel guidance retain local-market context, while Katalon, Indeed, GeeksforGeeks, Testsigma, BugBug, KORE1 and AssertHired provide independent current signals. New wording is merged into an existing canonical question unless the interview intent is materially distinct. SQL coverage also includes a maintained practical task layer with executable query examples for data-validation and SDET-style interviews.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available. Interview banks support recurrence and interview intent; they are not treated as technical authorities by themselves. SQL answers pair the concept with executable examples and explicit reasoning so query syntax is connected to the test intent.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    prevalence: "Every published question follows the maintained full-catalog review policy. Recurrence is counted by independent source family rather than raw URL count, so multiple DOU collections or several specialist pages from one publisher cannot inflate prevalence. Very common remains reserved for repeatedly recurring foundations; generated scenario variants cannot become Very common automatically; Embedded/IoT, AI/ML/LLM and regulated-domain questions remain Specialist. Personal stars are private user state and never affect prevalence.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy,
  sources,
  questions
};

export default interviewCatalog;
