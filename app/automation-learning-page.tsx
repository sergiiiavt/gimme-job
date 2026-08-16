"use client";

import automationCurriculum from "@/content/automation-learning/catalog";
import LearningDocumentPage from "./learning-document-page";

export default function AutomationLearningPage({ mode }: { mode: "public" | "personal" }) {
  return (
    <LearningDocumentPage
      curriculum={automationCurriculum}
      defaultTrackId="framework"
      mode={mode}
      personalHref="/workspace/learn/automation"
      publicHref="/learn/automation"
      secondaryTitle="Test automation"
      section="automation"
      trackOptions={[
        { id: "framework", label: "Framework", available: true },
        { id: "test-architecture", label: "Test architecture", available: false, emptyState: "Test architecture learning material is under construction." },
      ]}
    />
  );
}
