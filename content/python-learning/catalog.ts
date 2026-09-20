import beginnerLessons from "./beginner-lessons.json";
import intermediateLessons from "./intermediate-lessons.json";
import advancedLessons from "./advanced-lessons.json";
import expertLessons from "./expert-lessons.json";
import baseSources from "../python-interview/sources.json";
import learningSources from "./sources.json";
import taxonomy from "./taxonomy.json";

const sources = [...baseSources, ...learningSources];

const lessons = [
  ...beginnerLessons.lessons,
  ...intermediateLessons.lessons,
  ...advancedLessons.lessons,
  ...expertLessons.lessons,
];

export const pythonCurriculum = {
  version: 3,
  title: "Python learning path",
  description: "A structured Python curriculum from first script through practical automation and advanced language internals, with code samples and practice exercises.",
  lastReviewedAt: "2026-09-20",
  methodology: {
    coverage: "Modules progress Beginner to Expert and cover a validator-enforced core baseline across language syntax, everyday standard-library work, CLI scripting, automation, testing, packaging and advanced internals. The Quick Reference can remain broader than the lesson set, but critical practical topics cannot exist only as reference snippets.",
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
