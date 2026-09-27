"use client";

import performanceTestingCatalog from "@/content/performance-testing/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";

const curriculum: StructuredLearningCurriculum = {
  title: performanceTestingCatalog.title,
  titleUk: performanceTestingCatalog.titleUk,
  description: performanceTestingCatalog.description,
  taxonomy: performanceTestingCatalog.chapters,
  sources: performanceTestingCatalog.sources,
  lessons: [],
};

type PerformanceTestingPageProps = Readonly<{ mode: "public" | "personal" }>;

export default function PerformanceTestingPage({ mode }: PerformanceTestingPageProps) {
  return (
    <LearningDocumentPage
      curriculum={curriculum}
      languages={["en", "uk"]}
      mode={mode}
      personalHref="/workspace/learn/performance"
      publicHref="/learn/performance"
      secondaryTitle="Performance testing"
      section="performance"
      sourceStatusLabel={({ language }) => language === "uk" ? "Джерела розділу перевірені" : "Chapter references verified"}
    />
  );
}
