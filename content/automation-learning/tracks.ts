import { robotFrameworkChapterIds } from "./robot-framework-path";

export type AutomationTrackOption = {
  id: string;
  label: string;
  labelUk: string;
  available: boolean;
  moduleIds: string[];
};

export const AUTOMATION_DEFAULT_TRACK_ID = "foundations";

/**
 * The Test automation page opens a module only inside the track that lists it, so a
 * module's canonical link must carry that track.
 */
export const automationTrackOptions: AutomationTrackOption[] = [
  {
    id: AUTOMATION_DEFAULT_TRACK_ID,
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
export const automationTrackAliases: Record<string, string> = { architecture: "foundations", pytest: "python-setup" };

export function automationTrackForModule(moduleId: string): string | undefined {
  return automationTrackOptions.find((option) => option.available && option.moduleIds.includes(moduleId))?.id;
}
