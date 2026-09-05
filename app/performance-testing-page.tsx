"use client";

import performanceTestingCatalog from "@/content/performance-testing/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";

const curriculum: StructuredLearningCurriculum = {
  title: performanceTestingCatalog.title,
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
      heroMeta={({ sourceCount }) => [
        `${performanceTestingCatalog.chapters.length} methodical chapters`,
        `${sourceCount} primary references`,
        "Workload · metrics · tooling · diagnosis",
      ]}
      languages={["en"]}
      mode={mode}
      personalHref="/workspace/learn/performance"
      publicHref="/learn/performance"
      secondaryTitle="Performance testing"
      section="performance"
      sourceStatusLabel={() => "Primary references verified 5 Sep 2026"}
    />
  );
}
