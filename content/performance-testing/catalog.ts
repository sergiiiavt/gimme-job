import catalogData from "./catalog.json";

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
  level: string;
  description: string;
  sourceIds: string[];
  markdown: string;
}

export interface PerformanceLearningCatalog {
  title: string;
  description: string;
  sources: PerformanceLearningSource[];
  chapters: PerformanceLearningChapter[];
}

export const performanceTestingCatalog = catalogData as PerformanceLearningCatalog;

export default performanceTestingCatalog;
