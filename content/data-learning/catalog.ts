import sources from "./sources.json";
import sqlModules from "./sql-modules";

export const sqlCurriculum = {
  version: 1,
  status: "under-review",
  title: "SQL learning path",
  description: "A complete SQL path from relational foundations and SELECT through joins, aggregation, CTEs, window functions, transactions, schema design, performance, security, and QA data validation.",
  lastReviewedAt: "2026-08-25",
  methodology: {
    coverage: "W3Schools is used as a beginner-friendly breadth and sequence checklist; official PostgreSQL documentation is the primary semantic reference for deeper SQL behavior, and SQLite documentation is used for the site's in-browser runtime behavior.",
    answers: "Examples are original to this curriculum and intentionally use the same seeded tables as the site's isolated SQLite runner wherever the syntax is portable and safe to execute.",
    publishing: "The curriculum is public but marked Under review while cross-dialect wording, runnable examples, and source mapping are validated. This status is intentionally between Under construction and review-complete content.",
    prevalence: "Module levels reflect learning dependency: Beginner establishes query fluency, Intermediate builds relational/data-modification skills, Advanced adds analytical/performance/testing patterns, and Expert focuses on production habits and mastery.",
    media: "The current SQL path prioritizes text, executable examples, database inspection, and exercises. Diagrams can be added later where they improve relational-model or query-plan explanations."
  },
  taxonomy: sqlModules,
  sources,
};

export default sqlCurriculum;
