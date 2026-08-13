import coreLanguage from "./core-language-qa.json";
import dataTypesStructures from "./data-types-structures-qa.json";
import stringsText from "./strings-text-qa.json";
import functionsFunctional from "./functions-functional-qa.json";
import oop from "./oop-qa.json";
import iteratorsGeneratorsDecorators from "./iterators-generators-decorators-qa.json";
import errorsContextManagers from "./errors-context-managers-qa.json";
import concurrency from "./concurrency-qa.json";
import memoryPerformance from "./memory-performance-qa.json";
import packagingEnvironments from "./packaging-environments-qa.json";
import typingStaticAnalysis from "./typing-static-analysis-qa.json";
import stdlibTooling from "./stdlib-tooling-qa.json";
import webAutomation from "./web-automation-qa.json";
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";

const questions = [
  ...coreLanguage.questions,
  ...dataTypesStructures.questions,
  ...stringsText.questions,
  ...functionsFunctional.questions,
  ...oop.questions,
  ...iteratorsGeneratorsDecorators.questions,
  ...errorsContextManagers.questions,
  ...concurrency.questions,
  ...memoryPerformance.questions,
  ...packagingEnvironments.questions,
  ...typingStaticAnalysis.questions,
  ...stdlibTooling.questions,
  ...webAutomation.questions,
];

export const pythonInterviewCatalog = {
  version: 1,
  title: "Python interview knowledge base",
  description: "Canonical Python interview questions with original answers, practical examples, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-13",
  methodology: {
    coverage: "Real Python, GeeksforGeeks, InterviewBit, Toptal and DataCamp are cross-checked for recurring interview themes across fundamentals, data structures, OOP, concurrency, typing and tooling. This is a deliberately smaller, expandable starting collection rather than an exhaustive one.",
    answers: "Every answer is written for this knowledge base and checked against the official Python documentation and the relevant PEP where one exists.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    prevalence: "Prevalence is an editorial four-band signal, not a fabricated percentage. It reflects how often a topic recurs across the cross-checked community sources and how broadly it applies across Python roles, including test-automation engineers.",
    media: "This collection currently ships without images; original diagrams can be added later using the same media schema as the QA interview catalog."
  },
  taxonomy,
  sources,
  questions,
};

export default pythonInterviewCatalog;
