import beginnerLessons from "./beginner-lessons.json";
import intermediateLessons from "./intermediate-lessons.json";
import advancedLessons from "./advanced-lessons.json";
import expertLessons from "./expert-lessons.json";
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";
import { robotFrameworkLessons, robotFrameworkModule, robotFrameworkSources } from "./robot-framework";
import {
  desktopAutomationLessons,
  desktopAutomationModule,
  desktopAutomationSources,
} from "./desktop-automation-walkthrough";

const desktopAutomationModuleId = (order: number) => {
  if (order <= 49) return "desktop-automation-overview";
  if (order <= 57) return "desktop-automation-python";
  if (order <= 63) return "desktop-automation-dotnet";
  return "desktop-automation-ci";
};

const desktopAutomationExampleLessons = desktopAutomationLessons.map((lesson) => ({
  ...lesson,
  moduleId: desktopAutomationModuleId(lesson.order),
}));

const desktopAutomationModules = [
  {
    ...desktopAutomationModule,
    id: "desktop-automation-overview",
    label: "Desktop Automation Example: Overview",
    labelUk: "Desktop Automation Example: Огляд",
    navLabel: "Overview",
    navLabelUk: "Огляд",
    description: "Start with the repository and execution map before opening the Python, .NET or CI implementations.",
    descriptionUk: "Почніть зі структури repository та execution map перед переходом до Python, .NET або CI implementation.",
  },
  {
    ...desktopAutomationModule,
    id: "desktop-automation-python",
    label: "Python + pytest + pywinauto",
    labelUk: "Python + pytest + pywinauto",
    navLabel: "Python + pytest",
    navLabelUk: "Python + pytest",
    description: "Trace the Python implementation from dependencies and pytest lifecycle through UIA discovery, input, synchronization and assertions.",
    descriptionUk: "Простежте Python implementation від dependencies і pytest lifecycle до UIA discovery, input, synchronization та assertions.",
    introMarkdown: undefined,
    introMarkdownUk: undefined,
  },
  {
    ...desktopAutomationModule,
    id: "desktop-automation-dotnet",
    label: "C# + NUnit + FlaUI",
    labelUk: "C# + NUnit + FlaUI",
    navLabel: "C# + NUnit",
    navLabelUk: "C# + NUnit",
    description: "Trace the same desktop problem in .NET: project configuration, NUnit lifecycle, FlaUI/UIA3 mechanics and scenario design.",
    descriptionUk: "Розберіть ту саму desktop задачу в .NET: project configuration, NUnit lifecycle, FlaUI/UIA3 mechanics і scenario design.",
    introMarkdown: undefined,
    introMarkdownUk: undefined,
  },
  {
    ...desktopAutomationModule,
    id: "desktop-automation-ci",
    label: "Execution, CI, Allure & deployment",
    labelUk: "Execution, CI, Allure і deployment",
    navLabel: "CI + reporting",
    navLabelUk: "CI + reporting",
    description: "Follow local PowerShell execution and GitHub Actions through environment setup, test execution, evidence, Allure aggregation and report deployment.",
    descriptionUk: "Простежте local PowerShell execution та GitHub Actions через environment setup, test execution, evidence, Allure aggregation і deployment report.",
    introMarkdown: undefined,
    introMarkdownUk: undefined,
  },
];

const lessons = [
  ...beginnerLessons.lessons,
  ...intermediateLessons.lessons,
  ...advancedLessons.lessons,
  ...expertLessons.lessons,
  ...robotFrameworkLessons,
  ...desktopAutomationExampleLessons,
];

export const automationCurriculum = {
  version: 1,
  title: "Test automation learning path",
  description: "A structured path through test automation for services, web, mobile and Windows desktop automation: foundations, framework design, runnable examples and guided implementation walkthroughs.",
  lastReviewedAt: "2026-08-30",
  methodology: {
    coverage: "Modules progress Beginner to Expert and follow the order in which a framework is actually built: foundations, then the cheap service layer, then the expensive interface layer, then hardening and strategy. Robot Framework is available as a focused parallel track. The Desktop Automation Example then dissects one implementation and its CI flow block by block so the same concepts can be traced in working code instead of only isolated examples.",
    answers: "Every lesson's explanation and code sample is written for this path and checked against the official documentation of the tool it describes. Python-framework code samples are drawn from a runnable reference framework; Robot Framework examples include their required files and exact local run commands; the desktop-automation example maps each explanation to a concrete repository block and execution step.",
    publishing: "Only production-ready lessons are kept on the public site. Git pull requests provide review and history.",
    prevalence: "Module level reflects typical learning order rather than difficulty in isolation - later modules assume earlier ones. Robot Framework is taught as a currently maintained but specialized tool rather than the default recommendation for every new automation project. The desktop-automation example is advanced because it combines framework, operating-system, reporting and CI concepts in one execution trace.",
    media: "This path currently ships as text and code samples only; diagrams can be added later using the same media schema as the interview catalog."
  },
  referenceImplementation: {
    repo: "sergiiiavt/qa-automation-python",
    branch: "main",
    verifiedCommit: "f9ada16fd8eca02310a1d09d03034bb57895d985",
    verifiedAt: "2026-08-14",
  },
  taxonomy: [...taxonomy, robotFrameworkModule, ...desktopAutomationModules],
  sources: [...sources, ...robotFrameworkSources, ...desktopAutomationSources],
  lessons,
};

export default automationCurriculum;
