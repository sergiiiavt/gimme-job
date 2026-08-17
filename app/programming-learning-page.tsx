"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import pythonCurriculum from "@/content/python-learning/catalog";
import LearningDocumentPage from "./learning-document-page";

export default function ProgrammingLearningPage({ mode }: { mode: "public" | "personal" }) {
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic");
  const requestedTrack = searchParams.get("track");

  const curriculum = useMemo(() => {
    if (!requestedTopic) return pythonCurriculum;
    const requestedModule = pythonCurriculum.taxonomy.find((item) => item.id === requestedTopic);
    if (!requestedModule) return pythonCurriculum;
    return {
      ...pythonCurriculum,
      taxonomy: [requestedModule, ...pythonCurriculum.taxonomy.filter((item) => item.id !== requestedTopic)],
    };
  }, [requestedTopic]);

  return (
    <LearningDocumentPage
      curriculum={curriculum}
      defaultTrackId={requestedTrack === "typescript" ? "typescript" : "python"}
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
