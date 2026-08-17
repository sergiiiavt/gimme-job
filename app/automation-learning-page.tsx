"use client";

import automationCurriculum from "@/content/automation-learning/catalog";
import referenceFrameworkModule from "@/content/automation-learning/reference-framework";
import LearningDocumentPage from "./learning-document-page";

const curriculum = {
  ...automationCurriculum,
  taxonomy: [...automationCurriculum.taxonomy, referenceFrameworkModule],
};

const trackOptions = [
  { id: "foundations", label: "Foundations", labelUk: "Основи", available: true, moduleIds: ["automation-foundations"] },
  { id: "python-setup", label: "Python Setup", labelUk: "Python Setup", available: true, moduleIds: ["project-setup"] },
  { id: "pytest", label: "pytest", labelUk: "pytest", available: true, moduleIds: ["pytest-core"] },
  { id: "automation", label: "Web / API / Mobile", labelUk: "Web / API / Mobile", available: true, moduleIds: ["api-testing", "web-ui-testing", "mobile-testing", "contract-and-property"] },
  { id: "architecture", label: "Architecture", labelUk: "Архітектура", available: true, moduleIds: ["framework-architecture", "test-data", "flakiness", "ci-and-reporting", "quality-strategy"] },
  { id: "reference-framework", label: "Reference Framework", labelUk: "Reference Framework", available: true, moduleIds: ["reference-framework"] },
];

export default function AutomationLearningPage({ mode }: { mode: "public" | "personal" }) {
  return (
    <LearningDocumentPage
      curriculum={curriculum}
      defaultTrackId="foundations"
      mode={mode}
      personalHref="/workspace/learn/automation"
      publicHref="/learn/automation"
      secondaryTitle="Test automation"
      section="automation"
      trackOptions={trackOptions}
    />
  );
}
