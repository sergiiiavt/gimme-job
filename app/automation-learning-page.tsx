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
  { id: "robot-framework", label: "Specific", labelUk: "Specific", available: true, moduleIds: ["robot-framework"] },
];

const trackGroups = [
  { id: "concepts", label: "Concepts & Design", labelUk: "Концепції та архітектура", trackIds: ["foundations", "architecture"] },
  { id: "python", label: "Python Automation", labelUk: "Автоматизація на Python", trackIds: ["python-setup", "pytest", "automation"] },
  { id: "examples", label: "Examples & References", labelUk: "Приклади та довідники", trackIds: ["real-projects", "reference-framework"] },
  { id: "specialized", label: "Specialized", labelUk: "Спеціалізоване", trackIds: ["robot-framework"] },
];

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

.kb-subnav-switch[data-grouped="true"] {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kb-subnav-switch-group {
  min-width: 0;
  border: 1px solid #e1e6df;
  border-radius: 8px;
  background: rgba(255, 255, 255, .55);
  padding: 8px;
}

.kb-subnav-switch-heading {
  margin: 0 0 7px;
  color: #69766d;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .02em;
}

.kb-subnav-switch-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.kb-subnav-switch-options > button:last-child:nth-child(odd):not(:first-child) {
  grid-column: 1 / -1;
  justify-self: center;
  width: calc(50% - 3px);
}

.kb-subnav-switch-options > button:only-child {
  grid-column: 1 / -1;
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
        trackGroups={trackGroups}
      />
    </>
  );
}
