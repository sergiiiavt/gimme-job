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
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";

const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...testingFoundations.questions, ...embedded.questions, ...modernSdet.questions, ...coreFoundations.questions, ...expanded.questions];

export const interviewCatalog = {
  version: 13,
  title: "QA interview knowledge base",
  description: "Canonical interview questions with original answers, practical signals, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-19",
  methodology: {
    coverage: "DOU, Katalon, Indeed and GeeksforGeeks are cross-checked for recurring interview themes. Explicit audited collections cover every topic and are validated so foundational concepts cannot be hidden inside generated scenarios, answers or tags.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    prevalence: "Every published question is reclassified by the maintained full-catalog review policy. The policy evaluates exact question wording, recurrence in the DOU, Katalon, Indeed and GeeksforGeeks interview banks, breadth across QA roles, and role-specificity. Very common is reserved for repeatedly recurring foundations; generated scenario variants cannot become Very common automatically; Embedded/IoT, AI/ML/LLM and regulated-domain questions remain Specialist. Personal stars are private user state and never affect prevalence.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy,
  sources,
  questions
};

export default interviewCatalog;
