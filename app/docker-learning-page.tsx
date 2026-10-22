"use client";

import dockerCatalog from "@/content/docker-learning/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";

const curriculum: StructuredLearningCurriculum = {
  ...dockerCatalog,
  taxonomy: dockerCatalog.chapters.map((chapter) => ({ ...chapter, level: "article" })),
};

export default function DockerLearningPage({ mode }: Readonly<{ mode: "public" | "personal" }>) {
  return (
    <LearningDocumentPage
      activeExternalId="docker"
      curriculum={curriculum}
      languages={["en", "uk"]}
      mode={mode}
      personalHref="/workspace/learn/docker"
      publicHref="/learn/docker"
      secondaryTitle="Docker & containers"
      section={null}
    />
  );
}
