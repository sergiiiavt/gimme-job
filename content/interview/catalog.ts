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
  version: 12,
  title: "QA interview knowledge base",
  description: "Canonical interview questions with original answers, practical signals, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-19",
  methodology: {
    coverage: "DOU, Katalon, Indeed and GeeksforGeeks are cross-checked for recurring interview themes. Explicit audited collections cover every topic and are validated so foundational concepts cannot be hidden inside generated scenarios, answers or tags.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    prevalence: "Prevalence is a reviewed four-band signal for how likely the exact question is to appear in interviews, not a fabricated percentage. Authored questions keep explicit reviewed bands. Generated scenario variants are classified conservatively: classic practical exercises are Common, broad generated variants are Occasional, and role-specific generated variants are Specialist. Personal stars are private user state and never alter prevalence.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy,
  sources,
  questions
};

export default interviewCatalog;
