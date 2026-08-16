"use client";

import qaFundamentalsCatalog from "@/content/qa-fundamentals/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";

const conceptCounts = new Map(qaFundamentalsCatalog.taxonomy.map((topic) => [
  topic.id,
  qaFundamentalsCatalog.requiredConcepts.filter((concept) => concept.topicId === topic.id).length,
]));

const curriculum: StructuredLearningCurriculum = {
  title: qaFundamentalsCatalog.title,
  titleUk: qaFundamentalsCatalog.titleUk,
  description: qaFundamentalsCatalog.description,
  taxonomy: qaFundamentalsCatalog.chapters.map((chapter) => ({
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
  sources: qaFundamentalsCatalog.sources.map((source) => ({
    id: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    kind: source.status,
    role: source.role,
  })),
  lessons: [],
};

export default function QaFundamentalsPage({ mode }: { mode: "public" | "personal" }) {
  return (
    <LearningDocumentPage
      activeExternalId="qa-fundamentals"
      curriculum={curriculum}
      heroMeta={({ language, module, sourceCount }) => [
        `${module.count ?? 0} ${language === "uk" ? "ключових понять" : "required concepts"}`,
        `${sourceCount} ${language === "uk" ? "основних джерел" : "primary references"}`,
        language === "uk" ? "Розгорнутий навчальний матеріал" : "Long-form learning material",
      ]}
      languages={["en", "uk"]}
      mode={mode}
      personalHref="/workspace/learn/qa-fundamentals"
      publicHref="/learn/qa-fundamentals"
      secondaryTitle="QA fundamentals"
      section={null}
      sourceStatusLabel={({ language }) => language === "uk" ? "Перевірено 16 серпня 2026" : "Verified 16 Aug 2026"}
    />
  );
}
