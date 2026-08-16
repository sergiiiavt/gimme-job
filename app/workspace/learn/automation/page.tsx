"use client";

import automationCurriculum from "@/content/automation-learning/catalog";
import LearningDocumentPage from "../../../learning-document-page";

export default function PersonalAutomationLearningPage() {
  return (
    <LearningDocumentPage
      curriculum={automationCurriculum}
      defaultTrackId="framework"
      mode="personal"
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
