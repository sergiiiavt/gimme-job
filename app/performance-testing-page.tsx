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
      heroMeta={({ language, sourceCount }) => [
        `${performanceTestingCatalog.chapters.length} ${language === "uk" ? "методичних розділів" : "methodical chapters"}`,
        `${sourceCount} ${language === "uk" ? "джерел розділу" : "chapter references"}`,
        language === "uk" ? "Навантаження · метрики · інструменти · діагностика" : "Workload · metrics · tooling · diagnosis",
      ]}
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
