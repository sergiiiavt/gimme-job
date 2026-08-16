import taxonomyData from "./taxonomy.json";
import sourcesData from "./sources.json";
import requiredConceptsData from "./required-concepts.json";
import chapter01 from "./01-qa-testing-fundamentals.md?raw";
import chapter02 from "./02-testing-process-lifecycle.md?raw";
import chapter03 from "./03-test-levels-types-approaches.md?raw";
import chapter04 from "./04-requirements-test-design.md?raw";
import chapter05 from "./05-documentation-defects.md?raw";
import chapter06 from "./06-risk-coverage-prioritization.md?raw";
import chapter07 from "./07-static-exploratory-collaborative.md?raw";
import chapter08 from "./08-agile-modern-delivery.md?raw";

export interface QaFundamentalsTopic {
  id: string;
  order: number;
  label: string;
  description: string;
  file: string;
  sourceIds: string[];
}

export interface QaFundamentalsSource {
  id: string;
  title: string;
  publisher: string;
  kind: string;
  version?: string;
  status: string;
  url: string;
  role: string;
  checkedAt: string;
}

export interface QaRequiredConcept {
  id: string;
  topicId: string;
  label: string;
}

export interface QaFundamentalsChapter extends QaFundamentalsTopic {
  markdown: string;
}

const markdownByTopic: Record<string, string> = {
  "qa-testing-fundamentals": chapter01,
  "testing-process-lifecycle": chapter02,
  "test-levels-types-approaches": chapter03,
  "requirements-test-design": chapter04,
  "documentation-defects": chapter05,
  "risk-coverage-prioritization": chapter06,
  "static-exploratory-collaborative": chapter07,
  "agile-modern-delivery": chapter08,
};

const taxonomy = taxonomyData as QaFundamentalsTopic[];
const sources = sourcesData as QaFundamentalsSource[];
const requiredConcepts = requiredConceptsData as QaRequiredConcept[];

export const qaFundamentalsCatalog = {
  title: "Software Testing & Quality Fundamentals",
  description: "A source-backed foundation in software quality, testing theory, test design, defects, risk, requirements and modern QA practice.",
  taxonomy,
  sources,
  requiredConcepts,
  chapters: taxonomy.map((topic): QaFundamentalsChapter => ({
    ...topic,
    markdown: markdownByTopic[topic.id] ?? "",
  })),
};

export default qaFundamentalsCatalog;
