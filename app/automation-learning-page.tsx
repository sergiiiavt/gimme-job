"use client";

import automationCurriculum from "@/content/automation-learning/catalog";
import referenceFrameworkModule from "@/content/automation-learning/reference-framework";
import { robotFrameworkChapterIds } from "@/content/automation-learning/robot-framework-path";
import LearningDocumentPage from "./learning-document-page";

const curriculum = {
  ...automationCurriculum,
  taxonomy: [...automationCurriculum.taxonomy, referenceFrameworkModule],
};

const trackOptions = [
  {
    id: "foundations",
    label: "Fundamentals & Architecture",
    labelUk: "Основи та архітектура",
    available: true,
    moduleIds: ["automation-foundations", "framework-architecture", "test-data", "flakiness", "ci-and-reporting", "quality-strategy"],
  },
  {
    id: "python-setup",
    label: "Python & pytest",
    labelUk: "Python та pytest",
    available: true,
    moduleIds: ["project-setup", "pytest-core"],
  },
  { id: "automation", label: "Web / API / Mobile", labelUk: "Web / API / Mobile", available: true, moduleIds: ["api-testing", "web-ui-testing", "mobile-testing", "contract-and-property"] },
  {
    id: "real-projects",
    label: "Desktop Automation Example",
    labelUk: "Desktop Automation Example",
    available: true,
    moduleIds: [
      "desktop-automation-overview",
      "desktop-automation-python",
      "desktop-automation-dotnet",
      "desktop-automation-ci",
    ],
  },
  { id: "reference-framework", label: "Framework Reference", labelUk: "Framework Reference", available: true, moduleIds: ["reference-framework"] },
  { id: "robot-framework", label: "Robot Framework", labelUk: "Robot Framework", available: true, moduleIds: robotFrameworkChapterIds },
];

// Old deep links continue opening the same chapter after the broader tracks are combined.
const trackAliases = { architecture: "foundations", pytest: "python-setup" };

const automationTrackLayout = `
.kb-subnav-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.kb-subnav-switch button {
  flex: none;
  min-width: 0;
  min-height: 40px;
  padding: 6px 7px;
  line-height: 1.15;
  white-space: normal;
  overflow-wrap: break-word;
}

`;

export default function AutomationLearningPage({ mode }: { mode: "public" | "personal" }) {
  return (
    <>
      <style>{automationTrackLayout}</style>
      <LearningDocumentPage
        curriculum={curriculum}
        defaultTrackId="foundations"
        mode={mode}
        personalHref="/workspace/learn/automation"
        publicHref="/learn/automation"
        secondaryTitle="Test automation"
        section="automation"
        trackOptions={trackOptions}
        trackAliases={trackAliases}
      />
    </>
  );
}
