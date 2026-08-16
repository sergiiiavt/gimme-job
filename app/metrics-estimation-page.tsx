"use client";

import metricsEstimationCatalog from "@/content/metrics-estimation/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";
import { markdownSlug } from "./qa-markdown";

const conceptCounts = new Map(metricsEstimationCatalog.taxonomy.map((topic) => [
  topic.id,
  metricsEstimationCatalog.requiredConcepts.filter((concept) => concept.topicId === topic.id).length,
]));

const usageByHeadingByTopic = new Map(metricsEstimationCatalog.taxonomy.map((topic) => [
  topic.id,
  Object.fromEntries(
    metricsEstimationCatalog.requiredConcepts
      .filter((concept) => concept.topicId === topic.id && concept.usage)
      .map((concept) => [markdownSlug(concept.label), concept.usage!]),
  ),
]));

const curriculum: StructuredLearningCurriculum = {
  title: metricsEstimationCatalog.title,
  titleUk: metricsEstimationCatalog.titleUk,
  description: metricsEstimationCatalog.description,
  taxonomy: metricsEstimationCatalog.chapters.map((chapter) => ({
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
    usageByHeading: usageByHeadingByTopic.get(chapter.id),
  })),
  sources: metricsEstimationCatalog.sources.map((source) => ({
    id: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    kind: source.status,
    role: source.role,
  })),
  lessons: [],
};

type MetricsEstimationPageProps = Readonly<{ mode: "public" | "personal" }>;

export default function MetricsEstimationPage({ mode }: MetricsEstimationPageProps) {
  return (
    <LearningDocumentPage
      activeExternalId="metrics-estimation"
      curriculum={curriculum}
      heroMeta={({ language, module, sourceCount }) => [
        `${module.count ?? 0} ${language === "uk" ? "ключових понять" : "required concepts"}`,
        `${sourceCount} ${language === "uk" ? "основних джерел" : "primary references"}`,
        language === "uk" ? "Розгорнутий курс з метрик та оцінювання" : "Long-form measurement & estimation course",
      ]}
      languages={["en", "uk"]}
      mode={mode}
      personalHref="/workspace/learn/metrics-estimation"
      publicHref="/learn/metrics-estimation"
      secondaryTitle="QA metrics & estimation"
      section={null}
      sourceStatusLabel={({ language }) => language === "uk" ? "Перевірено 16 серпня 2026" : "Verified 16 Aug 2026"}
    />
  );
}
