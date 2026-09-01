"use client";

import { useSearchParams } from "next/navigation";
import pythonCurriculum from "@/content/python-learning/catalog";
import csharpCurriculum from "@/content/csharp-learning/catalog";
import LearningDocumentPage from "./learning-document-page";
import { waitingForReviewBannerStyle } from "./learning-review-status";

const pythonModuleIds = pythonCurriculum.taxonomy.filter((module) => module.level).map((module) => module.id);
const csharpModuleIds = csharpCurriculum.taxonomy.map((module) => module.id);

const programmingCurriculum = {
  ...pythonCurriculum,
  title: "Programming learning path",
  titleUk: "Навчальний шлях з програмування",
  description: "Programming fundamentals organized into language-specific tracks.",
  taxonomy: [...pythonCurriculum.taxonomy, ...csharpCurriculum.taxonomy],
  sources: [...pythonCurriculum.sources, ...csharpCurriculum.sources],
};

export default function ProgrammingLearningPage({ mode }: { mode: "public" | "personal" }) {
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic") ?? undefined;
  const requestedTrack = searchParams.get("track");
  const defaultTrackId = requestedTrack === "csharp" || requestedTrack === "typescript" ? requestedTrack : "python";
  const showReviewBanner = requestedTrack === "csharp";

  return (
    <>
      {showReviewBanner && <style>{waitingForReviewBannerStyle}</style>}
      <LearningDocumentPage
        curriculum={programmingCurriculum}
        defaultTrackId={defaultTrackId}
        heroMeta={({ language, lessonCount, module, sourceCount }) => module?.id.startsWith("csharp-")
          ? [
              language === "uk" ? "Базова тема" : "Foundational topic",
              `${sourceCount} ${language === "uk" ? "джерел" : "references"}`,
              language === "uk" ? "Методичний матеріал" : "Methodical material",
            ]
          : [
              `${lessonCount} ${language === "uk" ? "тем" : "lessons"}`,
              `${sourceCount} ${language === "uk" ? "джерел" : "references"}`,
              language === "uk" ? "Розгорнутий навчальний матеріал" : "Long-form learning material",
            ]}
        initialModuleId={requestedTopic}
        mode={mode}
        personalHref="/workspace/learn/programming"
        publicHref="/learn/programming"
        secondaryTitle="Programming"
        section="programming"
        trackOptions={[
          { id: "python", label: "Python", available: true, moduleIds: pythonModuleIds },
          { id: "csharp", label: "C#", available: true, moduleIds: csharpModuleIds },
          { id: "typescript", label: "TypeScript", available: false, emptyState: "TypeScript learning material is under construction." },
        ]}
      />
    </>
  );
}
