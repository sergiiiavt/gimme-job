"use client";

import automationCurriculum from "@/content/automation-learning/catalog";
import referenceFrameworkModule from "@/content/automation-learning/reference-framework";
import { AUTOMATION_DEFAULT_TRACK_ID, automationTrackAliases, automationTrackOptions } from "@/content/automation-learning/tracks";
import LearningDocumentPage from "./learning-document-page";

const curriculum = {
  ...automationCurriculum,
  taxonomy: [...automationCurriculum.taxonomy, referenceFrameworkModule],
};

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
        defaultTrackId={AUTOMATION_DEFAULT_TRACK_ID}
        mode={mode}
        personalHref="/workspace/learn/automation"
        publicHref="/learn/automation"
        secondaryTitle="Test automation"
        section="automation"
        trackOptions={automationTrackOptions}
        trackAliases={automationTrackAliases}
      />
    </>
  );
}
