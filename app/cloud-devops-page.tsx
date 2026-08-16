"use client";

import cloudDevopsCatalog from "@/content/cloud-devops/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";

const curriculum: StructuredLearningCurriculum = {
  title: cloudDevopsCatalog.title,
  description: cloudDevopsCatalog.description,
  taxonomy: cloudDevopsCatalog.chapters.map((chapter) => ({
    id: chapter.id,
    label: chapter.label,
    navLabel: chapter.kind === "case-study" ? `${chapter.label} · Case study` : chapter.label,
    level: "article",
    description: chapter.description,
    markdown: chapter.markdown,
    sourceIds: chapter.sourceIds,
    kind: chapter.kind,
  })),
  sources: cloudDevopsCatalog.sources.map((source) => ({
    id: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    kind: source.status,
    role: source.role,
  })),
  lessons: [],
};

export default function CloudDevopsPage({ mode }: { mode: "public" | "personal" }) {
  return (
    <LearningDocumentPage
      curriculum={curriculum}
      heroMeta={({ module, sourceCount }) => [
        module.kind === "case-study" ? "Real GimmeJob production case study" : "Engineering foundation",
        `${sourceCount} primary / implementation references`,
        "Long-form learning material",
      ]}
      languages={["en"]}
      mode={mode}
      personalHref="/workspace/learn/cloud-devops"
      publicHref="/learn/cloud-devops"
      secondaryTitle="Cloud & DevOps"
      section="devops"
      sourceStatusLabel={() => "Verified 16 Aug 2026"}
    />
  );
}
