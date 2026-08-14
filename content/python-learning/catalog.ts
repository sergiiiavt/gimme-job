import beginnerLessons from "./beginner-lessons.json";
import intermediateLessons from "./intermediate-lessons.json";
import advancedLessons from "./advanced-lessons.json";
import expertLessons from "./expert-lessons.json";
import sources from "../python-interview/sources.json";
import taxonomy from "./taxonomy.json";

const lessons = [
  ...beginnerLessons.lessons,
  ...intermediateLessons.lessons,
  ...advancedLessons.lessons,
  ...expertLessons.lessons,
];

export const pythonCurriculum = {
  version: 2,
  title: "Python learning path",
  description: "A structured Python curriculum from first script to advanced language internals, with runnable code samples and practice exercises.",
  lastReviewedAt: "2026-08-14",
  methodology: {
    coverage: "Modules progress Beginner to Expert, each grounded in the official Python documentation and, where relevant, the PEP that introduced a feature. This is a deliberately scoped starting curriculum rather than an exhaustive reference.",
    answers: "Every lesson's explanation and code sample is written for this curriculum and checked against the official Python documentation and the relevant PEP where one exists.",
    publishing: "Only production-ready lessons are kept on the public site. Git pull requests provide review and history.",
    prevalence: "Module level (Beginner, Intermediate, Advanced, Expert) reflects typical learning order, not difficulty in isolation — later modules assume earlier ones.",
    media: "This curriculum currently ships as text and code samples only; diagrams can be added later using the same media schema as the interview catalog."
  },
  taxonomy,
  sources,
  lessons,
};

export default pythonCurriculum;
