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
import practical from "./practical-qa.json";
import codeExamples from "./code-examples.json";
import topicOverrides from "./topic-overrides.json";
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";

const pythonCodeExamplesById = new Map(
  codeExamples.map((item) => [item.id, item.codeExamples] as const),
);
const pythonTopicOverrideById = new Map(
  topicOverrides.map((item) => [item.id, item.category] as const),
);

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
  ...practical.questions,
].map((question) => {
  const category = pythonTopicOverrideById.get(question.id);
  const withTopic = category ? { ...question, category } : question;
  const enhancement = pythonCodeExamplesById.get(question.id);
  return enhancement ? { ...withTopic, codeExamples: enhancement } : withTopic;
});

export const pythonInterviewCatalog = {
  version: 4,
  title: "Python interview knowledge base",
  description: "Canonical Python interview questions with original answers, practical code-writing tasks, executable-style examples, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-22",
  methodology: {
    coverage: "Real Python, GeeksforGeeks, InterviewBit, Toptal and DataCamp are cross-checked for recurring interview themes across fundamentals, data structures, OOP, concurrency, typing and tooling. A dedicated Python AQA topic groups pytest, mocking, API-client, browser-automation, configuration and practical test-framework questions without duplicating their canonical records. A focused practical layer adds common code-writing exercises without turning the collection into an unbounded algorithm bank.",
    answers: "Every answer is written for this knowledge base and checked against the official Python documentation and the relevant PEP where one exists. High-frequency topics also use structured Python code examples with explanation and expected behavior.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    prevalence: "Prevalence is an editorial four-band signal, not a fabricated percentage. It reflects how often a topic recurs across the cross-checked community sources and how broadly it applies across Python roles, including test-automation engineers.",
    media: "This collection currently ships without images; original diagrams can be added later using the same media schema as the QA interview catalog."
  },
  taxonomy,
  sources,
  questions,
};

export default pythonInterviewCatalog;
