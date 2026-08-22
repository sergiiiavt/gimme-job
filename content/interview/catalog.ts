import common from "./common-qa.json";
import canonical from "./canonical-baseline.json";
import databaseSql from "./database-sql-qa.json";
import sqlPracticalInterview from "./sql-practical-interview";
import sqlCodeExamples from "./sql-code-examples";
import sqlDataCodeExamples from "./sql-data-code-examples";
import sqlExpandedCodeExamples from "./sql-expanded-code-examples";
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
import topicTaxonomy from "./taxonomy.json";
import domains from "./domains.json";

const sourceEvidenceById = new Map(sourceEvidence.map((item) => [item.id, item]));
const sqlCodeExamplesById = new Map(
  [...sqlCodeExamples, ...sqlDataCodeExamples, ...sqlExpandedCodeExamples]
    .map((item) => [item.id, item.codeExamples]),
);
const categoryToDomain = domains.categoryToDomain as Record<string, string>;

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

function topicTag(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function applyInterviewDomain<T extends { category: string; kind?: string; tags?: string[] }>(question: T) {
  const originalCategory = question.category;
  const domain = categoryToDomain[originalCategory];
  if (!domain) throw new Error(`Interview category is missing a domain mapping: ${originalCategory}`);

  const originalTopicTag = topicTag(originalCategory);
  const tags = [originalTopicTag, ...(question.tags ?? [])].filter((tag, index, values) => values.indexOf(tag) === index);
  const topicLabel = originalCategory === domain ? undefined : originalCategory;
  const kind = [topicLabel, question.kind].filter(Boolean).join(" · ") || undefined;

  return {
    ...question,
    category: domain,
    kind,
    tags,
  };
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
].map(applySourceEvidence).map(applySqlCodeExamples).map(applyInterviewDomain);

const sources = [...baseSources, ...sourceRefreshSources];

export const interviewCatalog = {
  version: 16,
  title: "QA interview knowledge base",
  description: "Canonical interview questions grouped into practical QA domains, with original subtopics preserved as searchable tags and traceable technical sources.",
  lastReviewedAt: "2026-08-22",
  methodology: {
    coverage: "Ukrainian and international interview evidence is reviewed together. DOU 250+/400+ and current Hillel guidance retain local-market context, while Katalon, Indeed, GeeksforGeeks, Testsigma, BugBug, KORE1 and AssertHired provide independent current signals. New wording is merged into an existing canonical question unless the interview intent is materially distinct. SQL coverage also includes a maintained practical task layer with executable query examples for data-validation and SDET-style interviews. The public catalog now adds a stable domain layer above the original detailed taxonomy, so interview preparation can be scoped to Generic QA, Automation QA, SQL & Databases, Web & API, Mobile, Embedded & IoT, or AI & LLM QA without duplicating questions.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available. Interview banks support recurrence and interview intent; they are not treated as technical authorities by themselves. Every existing Databases, SQL and BI question now pairs the concept with an executable SQL example and explicit reasoning where SQL can act as the verification tool, and dedicated script-writing questions add hands-on interview practice.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks. Domain grouping is applied when the catalog is assembled; source question files retain their detailed editorial categories so validation and content ownership remain stable.",
    prevalence: "Every published question follows the maintained full-catalog review policy. Recurrence is counted by independent source family rather than raw URL count, so multiple DOU collections or several specialist pages from one publisher cannot inflate prevalence. Very common remains reserved for repeatedly recurring foundations; generated scenario variants cannot become Very common automatically; Embedded/IoT, AI/ML/LLM and regulated-domain questions remain Specialist. Personal stars are private user state and never affect prevalence.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy: domains.taxonomy,
  topicTaxonomy,
  sources,
  questions
};

export default interviewCatalog;
