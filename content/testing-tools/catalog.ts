import taxonomyData from "./taxonomy.json";
import sourcesData from "./sources.json";
import requiredConceptsData from "./required-concepts.json";
import chapter01En from "./chapter-01.en.json";
import chapter01Uk from "./chapter-01.uk.json";
import chapter02En from "./chapter-02.en.json";
import chapter02Uk from "./chapter-02.uk.json";
import chapter03En from "./chapter-03.en.json";
import chapter03Uk from "./chapter-03.uk.json";
import chapter04En from "./chapter-04.en.json";
import chapter04Uk from "./chapter-04.uk.json";
import chapter05En from "./chapter-05.en.json";
import chapter05Uk from "./chapter-05.uk.json";
import chapter06En from "./chapter-06.en.json";
import chapter06Uk from "./chapter-06.uk.json";
import chapter07En from "./chapter-07.en.json";
import chapter07Uk from "./chapter-07.uk.json";
import chapter08En from "./chapter-08.en.json";
import chapter08Uk from "./chapter-08.uk.json";

export interface LearningTopic {
  id: string;
  order: number;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  sourceIds: string[];
}

export interface LearningSource {
  id: string;
  title: string;
  publisher: string;
  kind: string;
  status: string;
  url: string;
  role: string;
  checkedAt: string;
}

export interface RequiredConcept {
  id: string;
  topicId: string;
  label: string;
}

interface EnglishChapterDocument {
  id: string;
  markdown: string;
}

interface UkrainianChapterDocument {
  id: string;
  markdownUk: string;
}

export interface LearningChapter extends LearningTopic {
  markdown: string;
  markdownUk: string;
}

const taxonomy = taxonomyData as LearningTopic[];
const sources = sourcesData as LearningSource[];
const requiredConcepts = requiredConceptsData as RequiredConcept[];
const englishDocuments = [
  chapter01En, chapter02En, chapter03En, chapter04En,
  chapter05En, chapter06En, chapter07En, chapter08En,
] as EnglishChapterDocument[];
const ukrainianDocuments = [
  chapter01Uk, chapter02Uk, chapter03Uk, chapter04Uk,
  chapter05Uk, chapter06Uk, chapter07Uk, chapter08Uk,
] as UkrainianChapterDocument[];
const englishById = new Map(englishDocuments.map((document) => [document.id, document.markdown]));
const ukrainianById = new Map(ukrainianDocuments.map((document) => [document.id, document.markdownUk]));

export const catalog = {
  title: "Testing & Diagnostic Tools",
  titleUk: "Інструменти тестування та діагностики",
  description: "A workflow-first, source-backed path through the diagnostic tools QA engineers use to inspect, reproduce and explain system behaviour.",
  descriptionUk: "Підкріплений джерелами workflow-first шлях через інструменти, якими QA engineers досліджують, відтворюють і пояснюють поведінку системи.",
  taxonomy,
  sources,
  requiredConcepts,
  chapters: taxonomy.map((topic): LearningChapter => ({
    ...topic,
    markdown: englishById.get(topic.id) ?? "",
    markdownUk: ukrainianById.get(topic.id) ?? "",
  })),
};

export default catalog;
