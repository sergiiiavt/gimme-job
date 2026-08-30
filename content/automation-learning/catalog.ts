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
import {
  buildDesktopMethodicalConcept,
  desktopAutomationMethodicalIntros,
} from "./desktop-automation-methodology";

const desktopAutomationModuleId = (order: number) => {
  if (order <= 49) return "desktop-automation-overview";
  if (order <= 57) return "desktop-automation-python";
  if (order <= 63) return "desktop-automation-dotnet";
  return "desktop-automation-ci";
};

const desktopAutomationExampleLessons = desktopAutomationLessons.map((lesson) => ({
  ...lesson,
  moduleId: desktopAutomationModuleId(lesson.order),
  concept: buildDesktopMethodicalConcept(lesson.concept, "en"),
  conceptUk: buildDesktopMethodicalConcept(lesson.conceptUk, "uk"),
}));

const desktopAutomationModules = [
  {
    ...desktopAutomationModule,
    id: "desktop-automation-overview",
    label: "Desktop Automation Example: Overview",
    labelUk: "Desktop Automation Example: Огляд",
    navLabel: "Overview",
    navLabelUk: "Огляд",
    description: "Build the desktop-automation mental model first: execution lifecycle, Windows UI Automation, repository layers and how the two implementations correspond.",
    descriptionUk: "Спочатку побудуйте mental model desktop automation: execution lifecycle, Windows UI Automation, repository layers і відповідність двох implementations.",
    introMarkdown: desktopAutomationMethodicalIntros.overview.en,
    introMarkdownUk: desktopAutomationMethodicalIntros.overview.uk,
  },
  {
    ...desktopAutomationModule,
    id: "desktop-automation-python",
    label: "Python + pytest + pywinauto",
    labelUk: "Python + pytest + pywinauto",
    navLabel: "Python + pytest",
    navLabelUk: "Python + pytest",
    description: "Study the Python implementation as one lifecycle: pytest fixtures, UIA discovery, deterministic interaction, synchronization, assertions, evidence and cleanup.",
    descriptionUk: "Розберіть Python implementation як один lifecycle: pytest fixtures, UIA discovery, deterministic interaction, synchronization, assertions, evidence і cleanup.",
    introMarkdown: desktopAutomationMethodicalIntros.python.en,
    introMarkdownUk: desktopAutomationMethodicalIntros.python.uk,
  },
  {
    ...desktopAutomationModule,
    id: "desktop-automation-dotnet",
    label: "C# + NUnit + FlaUI",
    labelUk: "C# + NUnit + FlaUI",
    navLabel: "C# + NUnit",
    navLabelUk: "C# + NUnit",
    description: "Study the same desktop-automation concepts in .NET and see how test intent is separated from reusable NUnit/FlaUI framework mechanics.",
    descriptionUk: "Розберіть ті самі desktop-automation concepts у .NET і подивіться, як test intent відділено від reusable NUnit/FlaUI framework mechanics.",
    introMarkdown: desktopAutomationMethodicalIntros.dotnet.en,
    introMarkdownUk: desktopAutomationMethodicalIntros.dotnet.uk,
  },
  {
    ...desktopAutomationModule,
    id: "desktop-automation-ci",
    label: "Execution, CI, Allure & deployment",
    labelUk: "Execution, CI, Allure і deployment",
    navLabel: "CI + reporting",
    navLabelUk: "CI + reporting",
    description: "Connect local execution to CI: environment preparation, Windows GUI execution, evidence preservation, Allure aggregation and report deployment.",
    descriptionUk: "Зв'яжіть local execution із CI: environment preparation, Windows GUI execution, evidence preservation, Allure aggregation і deployment report.",
    introMarkdown: desktopAutomationMethodicalIntros.ci.en,
    introMarkdownUk: desktopAutomationMethodicalIntros.ci.uk,
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
  description: "A structured path through test automation for services, web, mobile and Windows desktop automation: foundations, framework design, runnable examples and guided implementation studies.",
  lastReviewedAt: "2026-08-30",
  methodology: {
    coverage: "Modules progress Beginner to Expert and follow the order in which a framework is actually built: foundations, then the cheap service layer, then the expensive interface layer, then hardening and strategy. Robot Framework is available as a focused parallel track. The Desktop Automation Example is a methodological study of one implementation: first the desktop-automation model, then the Python lifecycle, the equivalent .NET framework design, and finally local/CI execution and reporting.",
    answers: "Every lesson's explanation and code sample is written for this path and checked against the official documentation of the tool it describes. Python-framework code samples are drawn from a runnable reference framework; Robot Framework examples include their required files and exact local run commands; the Desktop Automation Example keeps exact repository code but presents it as concept → project implementation → detailed execution explanation → design reasoning, with reusable key points and common pitfalls.",
    publishing: "Only production-ready lessons are kept on the public site. Git pull requests provide review and history.",
    prevalence: "Module level reflects typical learning order rather than difficulty in isolation - later modules assume earlier ones. Robot Framework is taught as a currently maintained but specialized tool rather than the default recommendation for every new automation project. The desktop-automation example is advanced because it combines framework, operating-system, synchronization, reporting and CI concepts in one coherent system.",
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
