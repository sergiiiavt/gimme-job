"use client";

import { useSearchParams } from "next/navigation";
import pythonCurriculum from "@/content/python-learning/catalog";
import LearningDocumentPage from "./learning-document-page";

export default function ProgrammingLearningPage({ mode }: { mode: "public" | "personal" }) {
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic") ?? undefined;
  const requestedTrack = searchParams.get("track");

  return (
    <LearningDocumentPage
      curriculum={pythonCurriculum}
      defaultTrackId={requestedTrack === "typescript" ? "typescript" : "python"}
      initialModuleId={requestedTopic}
      mode={mode}
      personalHref="/workspace/learn/programming"
      publicHref="/learn/programming"
      secondaryTitle="Programming"
      section="programming"
      trackOptions={[
        { id: "python", label: "Python", available: true },
        { id: "typescript", label: "TypeScript", available: false, emptyState: "TypeScript learning material is under construction." },
      ]}
    />
  );
}
