import catalogData from "./catalog.json";
import localizationUkData from "./localization.uk.json";
import chapter01Uk from "./chapter-01.uk.json";
import chapter02Uk from "./chapter-02.uk.json";
import chapter03Uk from "./chapter-03.uk.json";
import chapter04Uk from "./chapter-04.uk.json";
import chapter05Uk from "./chapter-05.uk.json";
import chapter06Uk from "./chapter-06.uk.json";
import chapter07Uk from "./chapter-07.uk.json";
import chapter08Uk from "./chapter-08.uk.json";
import gimmeJobLocustEn from "./gimmejob-locust.en.json";
import gimmeJobLocustUk from "./gimmejob-locust.uk.json";
import gimmeJobLocustExecutionData from "./gimmejob-locust-execution.json";
import gimmeJobLocustSourcesData from "./sources-gimmejob-locust.json";

export interface PerformanceLearningSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: string;
  role: string;
}

export interface PerformanceLearningChapter {
  id: string;
  label: string;
  labelUk: string;
  level: string;
  description: string;
  descriptionUk: string;
  sourceIds: string[];
  markdown: string;
  markdownUk: string;
}

export interface PerformanceLearningCatalog {
  title: string;
  titleUk: string;
  description: string;
  descriptionUk: string;
  sources: PerformanceLearningSource[];
  chapters: PerformanceLearningChapter[];
}

interface BasePerformanceChapter {
  id: string;
  label: string;
  level: string;
  description: string;
  sourceIds: string[];
  markdown: string;
}

interface BasePerformanceCatalog {
  title: string;
  description: string;
  sources: PerformanceLearningSource[];
  chapters: BasePerformanceChapter[];
}

interface UkrainianMetadata {
  title: string;
  description: string;
  chapters: Array<{
    id: string;
    labelUk: string;
    descriptionUk: string;
  }>;
}

interface UkrainianChapterDocument {
  id: string;
  markdownUk: string;
}

interface GimmeJobLocustEnglishDocument {
  id: string;
  markdown: string;
}

interface GimmeJobLocustExecutionDocument {
  en: string;
  uk: string;
}

const baseCatalog = catalogData as BasePerformanceCatalog;
const ukrainianMetadata = localizationUkData as UkrainianMetadata;
const ukMetadataById = new Map(ukrainianMetadata.chapters.map((chapter) => [chapter.id, chapter]));
const ukrainianDocuments = [
  chapter01Uk,
  chapter02Uk,
  chapter03Uk,
  chapter04Uk,
  chapter05Uk,
  chapter06Uk,
  chapter07Uk,
  chapter08Uk,
  gimmeJobLocustUk,
] as UkrainianChapterDocument[];
const ukrainianMarkdownById = new Map(ukrainianDocuments.map((document) => [document.id, document.markdownUk]));
const gimmeJobLocustSources = gimmeJobLocustSourcesData as PerformanceLearningSource[];
const gimmeJobLocustEnglish = gimmeJobLocustEn as GimmeJobLocustEnglishDocument;
const gimmeJobLocustExecution = gimmeJobLocustExecutionData as GimmeJobLocustExecutionDocument;

const GIMMEJOB_REPO = "sergiiiavt/gimme-job";
const repoPathPattern = /`((?:app|content|scripts|tests|\.github)\/[^`\n]+)`/g;
const obsoleteLocustSectionsPattern = /\n## 17\.[\s\S]*?(?=\n## Summary)/;

function linkGimmeJobRepoPaths(markdown: string) {
  return markdown.replace(repoPathPattern, (_match, path: string) => (
    `[\`${path}\`](https://github.com/${GIMMEJOB_REPO}/blob/main/${path})`
  ));
}

function syncCurrentLocustTags(markdown: string) {
  return markdown
    .replace('@tag("smoke", "api", "worker")', '@tag("health", "smoke", "api", "worker")')
    .replace('@tag("edge", "html")', '@tag("home", "public-read", "edge", "html")')
    .replace('@tag("worker", "html")', '@tag("reference", "public-read", "worker", "html")')
    .replace('@tag("d1", "api")', '@tag("jobs", "public-read", "d1", "api")')
    .replace('@tag("d1", "api", "heavy")', '@tag("dashboard", "public-read", "d1", "api", "heavy")');
}

function prepareGimmeJobLocustMarkdown(markdown: string, executionMaterial: string) {
  const withoutObsoleteSections = markdown.replace(obsoleteLocustSectionsPattern, "");
  const currentCode = syncCurrentLocustTags(withoutObsoleteSections);
  const withExecutionMaterial = currentCode.replace(
    "\n## Summary",
    `\n\n${executionMaterial.trim()}\n\n## Summary`,
  );
  return linkGimmeJobRepoPaths(withExecutionMaterial);
}

const localizedBaseChapters: PerformanceLearningChapter[] = baseCatalog.chapters.map((chapter) => {
  const localized = ukMetadataById.get(chapter.id);
  const markdownUk = ukrainianMarkdownById.get(chapter.id);
  if (!localized || !markdownUk) {
    throw new Error(`Missing Ukrainian performance-learning translation for ${chapter.id}`);
  }
  return {
    ...chapter,
    labelUk: localized.labelUk,
    descriptionUk: localized.descriptionUk,
    markdownUk,
  };
});

const locustMetadata = ukMetadataById.get(gimmeJobLocustEnglish.id);
const locustMarkdownUk = ukrainianMarkdownById.get(gimmeJobLocustEnglish.id);
if (!locustMetadata || !locustMarkdownUk) {
  throw new Error("Missing Ukrainian GimmeJob Locust learning translation");
}

const gimmeJobLocustChapter: PerformanceLearningChapter = {
  id: gimmeJobLocustEnglish.id,
  label: "9. GimmeJob Locust: real project walkthrough",
  labelUk: locustMetadata.labelUk,
  level: "article",
  description: "Learn Locust from the real GimmeJob workload: virtual users, task weights and tags, pacing, RPS, response validation, production safety, thresholds and cross-platform observability.",
  descriptionUk: locustMetadata.descriptionUk,
  sourceIds: gimmeJobLocustSources.map((source) => source.id),
  markdown: prepareGimmeJobLocustMarkdown(gimmeJobLocustEnglish.markdown, gimmeJobLocustExecution.en),
  markdownUk: prepareGimmeJobLocustMarkdown(locustMarkdownUk, gimmeJobLocustExecution.uk),
};

export const performanceTestingCatalog: PerformanceLearningCatalog = {
  title: baseCatalog.title,
  titleUk: ukrainianMetadata.title,
  description: baseCatalog.description,
  descriptionUk: ukrainianMetadata.description,
  sources: [...baseCatalog.sources, ...gimmeJobLocustSources],
  chapters: [...localizedBaseChapters, gimmeJobLocustChapter],
};

export default performanceTestingCatalog;
