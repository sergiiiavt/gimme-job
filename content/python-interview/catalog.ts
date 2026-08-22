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
import aqaSpecific from "./aqa-specific-qa.json";
import practical from "./practical-qa.json";
import codeExamples from "./code-examples.json";
import topicOverrides from "./topic-overrides.json";
import baseSources from "./sources.json";
import aqaSources from "./aqa-interview-sources.json";
import taxonomy from "./taxonomy.json";
import interviewSubtopics from "../interview/subtopics.json";

const pythonCodeExamplesById = new Map(
  codeExamples.map((item) => [item.id, item.codeExamples] as const),
);
const pythonTopicOverrideById = new Map(
  topicOverrides.map((item) => [item.id, item.category] as const),
);

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

const pythonSubtopics = (interviewSubtopics.domains as Record<string, SubtopicConfig>).Python;

function classifyPythonSubtopic(question: { id: string; category: string; kind?: string; question: string; tags?: string[] }) {
  const searchable = [question.id, question.category, question.kind ?? "", question.question, ...(question.tags ?? [])]
    .join(" ")
    .toLowerCase();
  const matchedRule = pythonSubtopics.rules?.find((rule) => {
    if (rule.category && rule.category !== question.category) return false;
    if (rule.kind && rule.kind !== question.kind) return false;
    return !rule.any?.length || rule.any.some((term) => searchable.includes(term.toLowerCase()));
  });

  return matchedRule?.target ?? pythonSubtopics.fallbackByCategory?.[question.category] ?? pythonSubtopics.fallback;
}

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
  ...aqaSpecific.questions,
  ...practical.questions,
].map((question) => {
  const category = pythonTopicOverrideById.get(question.id);
  const withTopic = category ? { ...question, category } : question;
  const enhancement = pythonCodeExamplesById.get(question.id);
  const enhanced = enhancement ? { ...withTopic, codeExamples: enhancement } : withTopic;
  return { ...enhanced, category: classifyPythonSubtopic(enhanced) };
});

const sources = [...baseSources, ...aqaSources];
const pythonTaxonomy = [
  taxonomy.find((item) => item.id === "all")!,
  ...pythonSubtopics.taxonomy,
  taxonomy.find((item) => item.id === "methodology")!,
];

export const pythonInterviewCatalog = {
  version: 5,
  title: "Python interview knowledge base",
  description: "Canonical Python interview questions grouped into focused language and AQA subtopics, with original answers, practical code-writing tasks, executable-style examples, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-22",
  methodology: {
    coverage: "General Python interview themes are cross-checked against Real Python, GeeksforGeeks, InterviewBit, Toptal and DataCamp. Python AQA coverage is additionally checked against current 2026 SDET and pytest interview banks, Playwright interview material, Ukrainian Python automation hiring signals and practitioner framework guidance. Only recurring or role-relevant AQA concepts are added; useful but weakly evidenced pytest APIs are left out rather than used to pad the topic. The authored questions stay unchanged while the broad Python AQA group is presented as focused pytest, mocking, browser, API, reliability, framework/CI and practical subtopics.",
    answers: "Every answer is written for this knowledge base and checked against the official Python documentation and the relevant PEP where one exists. AQA-specific answers also use the official pytest, pytest-xdist, Selenium and Playwright documentation for tool behavior. High-frequency topics use practical examples that reflect automation work rather than trivia.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks. Presentation subtopics do not change question IDs, wording, answers, examples or source evidence.",
    prevalence: "Prevalence is an editorial four-band signal, not a fabricated percentage. For Python AQA questions it reflects recurrence across current interview sources plus current hiring relevance; official documentation establishes correctness but does not by itself make a topic common in interviews.",
    media: "This collection currently ships without images; original diagrams can be added later using the same media schema as the QA interview catalog."
  },
  taxonomy: pythonTaxonomy,
  sources,
  questions,
};

export default pythonInterviewCatalog;
