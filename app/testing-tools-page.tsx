"use client";

import testingToolsCatalog from "@/content/testing-tools/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";

const conceptCounts = new Map(testingToolsCatalog.taxonomy.map((topic) => [
  topic.id,
  testingToolsCatalog.requiredConcepts.filter((concept) => concept.topicId === topic.id).length,
]));

const curriculum: StructuredLearningCurriculum = {
  title: testingToolsCatalog.title,
  titleUk: testingToolsCatalog.titleUk,
  description: testingToolsCatalog.description,
  taxonomy: testingToolsCatalog.chapters.map((chapter) => ({
    id: chapter.id,
    label: chapter.label,
    labelUk: chapter.labelUk,
    level: "article",
    description: chapter.description,
    descriptionUk: chapter.descriptionUk,
    markdown: chapter.markdown,
    markdownUk: chapter.markdownUk,
    sourceIds: chapter.sourceIds,
    count: conceptCounts.get(chapter.id),
  })),
  sources: testingToolsCatalog.sources.map((source) => ({
    id: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    kind: source.status,
    role: source.role,
  })),
  lessons: [],
};

type TestingToolsPageProps = Readonly<{ mode: "public" | "personal" }>;

export default function TestingToolsPage({ mode }: TestingToolsPageProps) {
  return (
    <LearningDocumentPage
      activeExternalId="testing-tools"
      curriculum={curriculum}
      heroMeta={({ language, module, sourceCount }) => [
        `${module.count ?? 0} ${language === "uk" ? "ключових понять" : "required concepts"}`,
        `${sourceCount} ${language === "uk" ? "основних джерел" : "primary references"}`,
        language === "uk" ? "Розгорнутий курс з інструментів діагностики" : "Long-form diagnostic tooling course",
      ]}
      languages={["en", "uk"]}
      mode={mode}
      personalHref="/workspace/learn/testing-tools"
      publicHref="/learn/testing-tools"
      secondaryTitle="Testing & diagnostic tools"
      section={null}
      sourceStatusLabel={({ language }) => language === "uk" ? "Перевірено 16 серпня 2026" : "Verified 16 Aug 2026"}
    />
  );
}
