"use client";

import gitCatalog from "@/content/git-learning/catalog";
import LearningDocumentPage, { type StructuredLearningCurriculum } from "./learning-document-page";
import { reviewRequiredBannerStyle } from "./learning-review-status";

const curriculum: StructuredLearningCurriculum = {
  ...gitCatalog,
  taxonomy: gitCatalog.chapters.map((chapter) => ({ ...chapter, level: "article" })),
};

export default function GitLearningPage({ mode }: Readonly<{ mode: "public" | "personal" }>) {
  return (
    <>
      <style>{reviewRequiredBannerStyle}</style>
      <LearningDocumentPage
        activeExternalId="git"
        curriculum={curriculum}
        languages={["en", "uk"]}
        mode={mode}
        personalHref="/learn/git"
        publicHref="/learn/git"
        secondaryTitle="Git & collaboration"
        section={null}
        sourceStatusLabel={({ language }) => language === "uk" ? "Потребує перевірки" : "Review required"}
      />
    </>
  );
}
