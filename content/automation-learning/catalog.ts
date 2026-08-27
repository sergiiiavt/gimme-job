import beginnerLessons from "./beginner-lessons.json";
import intermediateLessons from "./intermediate-lessons.json";
import advancedLessons from "./advanced-lessons.json";
import expertLessons from "./expert-lessons.json";
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";
import { robotFrameworkLessons, robotFrameworkModule, robotFrameworkSources } from "./robot-framework";

const lessons = [
  ...beginnerLessons.lessons,
  ...intermediateLessons.lessons,
  ...advancedLessons.lessons,
  ...expertLessons.lessons,
  ...robotFrameworkLessons,
];

export const automationCurriculum = {
  version: 1,
  title: "Test automation learning path",
  description: "A structured path through test automation for services, web and mobile in Python and Robot Framework: first fixture or keyword to automation strategy, with practical code samples and exercises.",
  lastReviewedAt: "2026-08-27",
  methodology: {
    coverage: "Modules progress Beginner to Expert and follow the order in which a framework is actually built: foundations, then the cheap service layer, then the expensive interface layer, then hardening and strategy. Robot Framework is available as a focused parallel track that applies the same engineering principles through keyword-driven automation. This is a deliberately scoped path rather than an exhaustive reference for any single tool.",
    answers: "Every lesson's explanation and code sample is written for this path and checked against the official documentation of the tool it describes. Python-framework code samples are drawn from a runnable reference framework; Robot Framework examples include their required files, dependency setup and exact local run commands instead of being presented as browser-sandbox Python.",
    publishing: "Only production-ready lessons are kept on the public site. Git pull requests provide review and history.",
    prevalence: "Module level reflects typical learning order rather than difficulty in isolation - later modules assume earlier ones. Robot Framework is taught as a currently maintained but specialized tool rather than the default recommendation for every new automation project.",
    media: "This path currently ships as text and code samples only; diagrams can be added later using the same media schema as the interview catalog."
  },
  referenceImplementation: {
    repo: "sergiiiavt/qa-automation-python",
    branch: "main",
    verifiedCommit: "f9ada16fd8eca02310a1d09d03034bb57895d985",
    verifiedAt: "2026-08-14",
  },
  taxonomy: [...taxonomy, robotFrameworkModule],
  sources: [...sources, ...robotFrameworkSources],
  lessons,
};

export default automationCurriculum;
