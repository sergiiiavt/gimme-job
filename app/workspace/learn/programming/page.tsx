"use client";

import pythonCurriculum from "@/content/python-learning/catalog";
import LearningDocumentPage from "../../../learning-document-page";

export default function PersonalProgrammingLearningPage() {
  return (
    <LearningDocumentPage
      curriculum={pythonCurriculum}
      defaultTrackId="python"
      mode="personal"
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
