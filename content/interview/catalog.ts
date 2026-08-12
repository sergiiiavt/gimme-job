import common from "./common-qa.json";
import canonical from "./canonical-baseline.json";
import databaseSql from "./database-sql-qa.json";
import observabilityProduction from "./observability-production-qa.json";
import restoredCoverage from "./restored-coverage-qa.json";
import testingFoundations from "./testing-foundations-qa.json";
import embedded from "./embedded-qa.json";
import modernSdet from "./modern-sdet-qa.json";
import coreFoundations from "./core-foundations-qa.json";
import editorialStars from "./editorial-starred-question-ids.json";
import expanded from "./expanded-qa.json";
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";

const editorialStarredIds = new Set(editorialStars.questionIds);
const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...testingFoundations.questions, ...embedded.questions, ...modernSdet.questions, ...coreFoundations.questions, ...expanded.questions]
  .map((question) => editorialStarredIds.has(question.id) ? { ...question, editorialStar: true } : question);

export const interviewCatalog = {
  version: 10,
  title: "QA interview knowledge base",
  description: "Canonical interview questions with original answers, practical signals, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-12",
  methodology: {
    coverage: "DOU, Katalon, Indeed and GeeksforGeeks are cross-checked for recurring interview themes. Explicit audited collections cover every topic and are validated so foundational concepts cannot be hidden inside generated scenarios, answers or tags.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    prevalence: "Prevalence is an editorial four-band signal, not a fabricated percentage. It combines overlap across the four interview banks with how broadly a concept applies across QA roles; specialist prompts remain available without being presented as common. A separate editorial star marks the core foundation set without replacing prevalence. Stars are public curation for now and are intentionally separate from future personal state.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy,
  sources,
  questions
};

export default interviewCatalog;
