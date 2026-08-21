import common from "./common-qa.json";
import canonical from "./canonical-baseline.json";
import databaseSql from "./database-sql-qa.json";
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

function applySourceEvidence<T extends { id: string; sourceIds: string[]; prevalence: string }>(question: T): T {
  const evidence = sourceEvidenceById.get(question.id);
  if (!evidence) return question;

  return {
    ...question,
    sourceIds: [...new Set([...question.sourceIds, ...evidence.sourceIds])],
    prevalence: "prevalence" in evidence ? evidence.prevalence : question.prevalence,
  } as T;
}

const questions = [
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
  ...sourceRefresh.questions,
].map(applySourceEvidence);

const sources = [...baseSources, ...sourceRefreshSources];

export const interviewCatalog = {
  version: 14,
  title: "QA interview knowledge base",
  description: "Canonical interview questions with original answers, practical signals, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-21",
  methodology: {
    coverage: "Ukrainian and international interview evidence is reviewed together. DOU 250+/400+ and current Hillel guidance retain local-market context, while Katalon, Indeed, GeeksforGeeks, Testsigma, BugBug, KORE1 and AssertHired provide independent current signals. New wording is merged into an existing canonical question unless the interview intent is materially distinct.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available. Interview banks support recurrence and interview intent; they are not treated as technical authorities by themselves.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    prevalence: "Every published question follows the maintained full-catalog review policy. Recurrence is counted by independent source family rather than raw URL count, so multiple DOU collections or several specialist pages from one publisher cannot inflate prevalence. Very common remains reserved for repeatedly recurring foundations; generated scenario variants cannot become Very common automatically; Embedded/IoT, AI/ML/LLM and regulated-domain questions remain Specialist. Personal stars are private user state and never affect prevalence.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy,
  sources,
  questions
};

export default interviewCatalog;
