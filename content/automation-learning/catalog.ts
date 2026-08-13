import beginnerLessons from "./beginner-lessons.json";
import intermediateLessons from "./intermediate-lessons.json";
import advancedLessons from "./advanced-lessons.json";
import expertLessons from "./expert-lessons.json";
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";

const lessons = [
  ...beginnerLessons.lessons,
  ...intermediateLessons.lessons,
  ...advancedLessons.lessons,
  ...expertLessons.lessons,
];

export const automationCurriculum = {
  version: 1,
  title: "Test automation learning path",
  description: "A structured path through test automation for services, web and mobile in Python: first fixture to automation strategy, with runnable code samples and practice exercises.",
  lastReviewedAt: "2026-08-13",
  methodology: {
    coverage: "Modules progress Beginner to Expert and follow the order in which a framework is actually built: foundations, then the cheap service layer, then the expensive interface layer, then hardening and strategy. This is a deliberately scoped path rather than an exhaustive reference for any single tool.",
    answers: "Every lesson's explanation and code sample is written for this path and checked against the official documentation of the tool it describes. Code samples are drawn from a runnable reference framework rather than written in the abstract.",
    publishing: "Only production-ready lessons are kept on the public site. Git pull requests provide review and history.",
    prevalence: "Module level reflects typical learning order rather than difficulty in isolation - later modules assume earlier ones. The Advanced and Expert modules cover the problems that appear once a suite runs in parallel and has to be trusted by a team.",
    media: "This path currently ships as text and code samples only; diagrams can be added later using the same media schema as the interview catalog."
  },
  taxonomy,
  sources,
  lessons,
};

export default automationCurriculum;
