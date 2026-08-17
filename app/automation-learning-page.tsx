"use client";

import automationCurriculum from "@/content/automation-learning/catalog";
import LearningDocumentPage from "./learning-document-page";

export default function AutomationLearningPage({ mode }: { mode: "public" | "personal" }) {
  return (
    <LearningDocumentPage
      curriculum={automationCurriculum}
      mode={mode}
      personalHref="/workspace/learn/automation"
      publicHref="/learn/automation"
      secondaryTitle="Test automation"
      section="automation"
    />
  );
}
