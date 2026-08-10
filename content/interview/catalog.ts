import common from "./common-qa.json";
import expanded from "./expanded-qa.json";
import sources from "./sources.json";
import taxonomy from "./taxonomy.json";

export const interviewCatalog = {
  version: 2,
  title: "QA interview knowledge base",
  description: "Canonical interview questions with original answers, practical signals, tags and traceable technical sources.",
  lastReviewedAt: "2026-08-11",
  methodology: {
    coverage: "Community question banks identify interview themes. Duplicate, outdated and tool-trivia prompts are consolidated into canonical questions instead of being copied.",
    answers: "Every answer is written for this knowledge base and checked against official syllabi, standards, specifications or product documentation where available.",
    publishing: "Only production-ready content is kept on the public site. Git pull requests provide review and history; D1 stores only private progress, notes and bookmarks.",
    media: "Original diagrams and properly licensed images are stored with the site. Every image requires alternative text, a caption and source credit."
  },
  taxonomy,
  sources,
  questions: [...common.questions, ...expanded.questions]
};

export default interviewCatalog;
