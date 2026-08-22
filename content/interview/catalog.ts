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
import subtopics from "./subtopics.json";

const sourceEvidenceById = new Map(sourceEvidence.map((item) => [item.id, item]));
const sqlCodeExamplesById = new Map(
  [...sqlCodeExamples, ...sqlDataCodeExamples, ...sqlExpandedCodeExamples]
    .map((item) => [item.id, item.codeExamples]),
);
const categoryToDomain = domains.categoryToDomain as Record<string, string>;

type SubtopicRule = {
  category?: string;
  kind?: string;
  target: string;
  any?: string[];
};

type SubtopicConfig = {
  taxonomy: Array<{ id: string; label: string; category: string; description: string }>;
  rules?: SubtopicRule[];
  fallbackByCategory?: Record<string, string>;
  fallback: string;
};

const subtopicDomains = subtopics.domains as Record<string, SubtopicConfig>;

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesSubtopicTerm(searchable: string, term: string) {
  const needle = term.toLowerCase();
  if (/^[a-z0-9+#.]{1,3}$/.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(searchable);
  }
  return searchable.includes(needle);
}

function classifySubtopic(question: { id: string; category: string; kind?: string; question: string; tags?: string[] }, domainCategory: string) {
  const config = subtopicDomains[domainCategory];
  if (!config) return question.category;

  const searchable = [question.id, question.category, question.kind ?? "", question.question, ...(question.tags ?? [])]
    .join(" ")
    .toLowerCase();
  const matchedRule = config.rules?.find((rule) => {
    if (rule.category && rule.category !== question.category) return false;
    if (rule.kind && rule.kind !== question.kind) return false;
    return !rule.any?.length || rule.any.some((term) => matchesSubtopicTerm(searchable, term));
  });

  return matchedRule?.target ?? config.fallbackByCategory?.[question.category] ?? config.fallback;
}

const allQuestions = [
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
const runtimePathname = typeof window === "undefined" ? "" : window.location.pathname.replace(/\/+$/, "");
const runtimeSearchParams = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
const requestedDomainId = runtimeSearchParams?.get("domain") ?? "generic-qa";
const selectedDomain = domains.taxonomy.find((item) => item.id === requestedDomainId && item.category)
  ?? domains.taxonomy.find((item) => item.id === "generic-qa");
const selectedDomainCategory = selectedDomain?.category ?? "Generic QA";
const selectedSubtopics = subtopicDomains[selectedDomainCategory];
const scopeToDomain = runtimePathname === "/interview" && !runtimeSearchParams?.has("question");
const scopedQuestions = scopeToDomain
  ? allQuestions
      .filter((question) => categoryToDomain[question.category] === selectedDomainCategory)
      .map((question) => ({ ...question, category: classifySubtopic(question, selectedDomainCategory) }))
  : allQuestions;
const populatedScopedCategories = new Set(scopedQuestions.map((question) => question.category));
const scopedTopicTaxonomy = scopeToDomain
  ? [
      {
        id: "all",
        label: `All ${selectedDomain?.label ?? "Generic QA"}`,
        description: `All interview questions in the ${selectedDomain?.label ?? "Generic QA"} domain.`,
      },
      ...(selectedSubtopics?.taxonomy.filter((item) => populatedScopedCategories.has(item.category))
        ?? topicTaxonomy.filter((item) => item.category && categoryToDomain[item.category] === selectedDomainCategory)),
      ...topicTaxonomy.filter((item) => item.id === "methodology"),
    ]
  : topicTaxonomy;

export const interviewCatalog = {
  version: 17,
  title: scopeToDomain ? `${selectedDomain?.label ?? "Generic QA"} interview questions` : "QA interview knowledge base",
  description: "Canonical interview questions organized by a top-level interview domain and logical subtopics, with original answers, practical signals, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-22",
  methodology: {
    coverage: "Ukrainian and international interview evidence is reviewed together. DOU 250+/400+ and current Hillel guidance retain local-market context, while Katalon, Indeed, GeeksforGeeks, Testsigma, BugBug, KORE1 and AssertHired provide independent current signals. New wording is merged into an existing canonical question unless the interview intent is materially distinct. SQL coverage also includes a maintained practical task layer with executable query examples for data-validation and SDET-style interviews. The UI uses top-level interview domains and a second level of logical subtopics derived from the existing questions without rewriting them.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available. Interview banks support recurrence and interview intent; they are not treated as technical authorities by themselves. Every existing Databases, SQL and BI question now pairs the concept with an executable SQL example and explicit reasoning where SQL can act as the verification tool, and dedicated script-writing questions add hands-on interview practice.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks. Domain selection scopes the assembled client catalog and assigns presentation-only subtopics without changing question IDs, wording, answers, examples, source evidence or the authored source categories in Git. Empty presentation groups are omitted instead of showing zero-count navigation entries.",
    prevalence: "Every published question follows the maintained full-catalog review policy. Recurrence is counted by independent source family rather than raw URL count, so multiple DOU collections or several specialist pages from one publisher cannot inflate prevalence. Very common remains reserved for repeatedly recurring foundations; generated scenario variants cannot become Very common automatically; Embedded/IoT, AI/ML/LLM and regulated-domain questions remain Specialist. Personal stars are private user state and never affect prevalence.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy: scopedTopicTaxonomy,
  domains: domains.taxonomy,
  categoryToDomain,
  sources,
  questions: scopedQuestions
};

export default interviewCatalog;
