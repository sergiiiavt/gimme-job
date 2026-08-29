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

const lessons = [
  ...beginnerLessons.lessons,
  ...intermediateLessons.lessons,
  ...advancedLessons.lessons,
  ...expertLessons.lessons,
  ...robotFrameworkLessons,
  ...desktopAutomationLessons,
];

export const automationCurriculum = {
  version: 1,
  title: "Test automation learning path",
  description: "A structured path through test automation for services, web, mobile and Windows desktop automation: foundations, framework design, runnable examples and real-project walkthroughs.",
  lastReviewedAt: "2026-08-29",
  methodology: {
    coverage: "Modules progress Beginner to Expert and follow the order in which a framework is actually built: foundations, then the cheap service layer, then the expensive interface layer, then hardening and strategy. Robot Framework is available as a focused parallel track. Real Project Walkthroughs then dissect complete repositories and CI flows block by block so the same concepts can be traced in production-like code instead of only isolated examples.",
    answers: "Every lesson's explanation and code sample is written for this path and checked against the official documentation of the tool it describes. Python-framework code samples are drawn from a runnable reference framework; Robot Framework examples include their required files and exact local run commands; real-project walkthroughs pin every explanation to a reviewed repository commit so code and explanation cannot silently drift apart.",
    publishing: "Only production-ready lessons are kept on the public site. Git pull requests provide review and history.",
    prevalence: "Module level reflects typical learning order rather than difficulty in isolation - later modules assume earlier ones. Robot Framework is taught as a currently maintained but specialized tool rather than the default recommendation for every new automation project. Real-project modules are advanced because they combine framework, operating-system, reporting and CI concepts in one execution trace.",
    media: "This path currently ships as text and code samples only; diagrams can be added later using the same media schema as the interview catalog."
  },
  referenceImplementation: {
    repo: "sergiiiavt/qa-automation-python",
    branch: "main",
    verifiedCommit: "f9ada16fd8eca02310a1d09d03034bb57895d985",
    verifiedAt: "2026-08-14",
  },
  taxonomy: [...taxonomy, robotFrameworkModule, desktopAutomationModule],
  sources: [...sources, ...robotFrameworkSources, ...desktopAutomationSources],
  lessons,
};

export default automationCurriculum;
