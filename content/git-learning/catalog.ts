import taxonomy from "./taxonomy.json";
import sources from "./sources.json";
import chapter01 from "./01-foundations.md?raw";
import chapter01Uk from "./01-foundations.uk.md?raw";
import chapter02 from "./02-setup-authentication.md?raw";
import chapter02Uk from "./02-setup-authentication.uk.md?raw";
import chapter03 from "./03-staging-commits.md?raw";
import chapter03Uk from "./03-staging-commits.uk.md?raw";
import chapter04 from "./04-history-comparison.md?raw";
import chapter04Uk from "./04-history-comparison.uk.md?raw";
import chapter05 from "./05-branches-worktrees.md?raw";
import chapter05Uk from "./05-branches-worktrees.uk.md?raw";
import chapter06 from "./06-remotes-synchronization.md?raw";
import chapter06Uk from "./06-remotes-synchronization.uk.md?raw";
import chapter07 from "./07-merge-rebase.md?raw";
import chapter07Uk from "./07-merge-rebase.uk.md?raw";
import chapter08 from "./08-conflict-resolution.md?raw";
import chapter08Uk from "./08-conflict-resolution.uk.md?raw";
import chapter09 from "./09-undo-recovery.md?raw";
import chapter09Uk from "./09-undo-recovery.uk.md?raw";
import chapter10 from "./10-pull-requests-review.md?raw";
import chapter10Uk from "./10-pull-requests-review.uk.md?raw";
import chapter11 from "./11-ci-releases.md?raw";
import chapter11Uk from "./11-ci-releases.uk.md?raw";
import chapter12 from "./12-debugging-bisect.md?raw";
import chapter12Uk from "./12-debugging-bisect.uk.md?raw";
import chapter13 from "./13-security-hygiene.md?raw";
import chapter13Uk from "./13-security-hygiene.uk.md?raw";
import chapter14 from "./14-capstone-reference.md?raw";
import chapter14Uk from "./14-capstone-reference.uk.md?raw";

const documents = [
  [chapter01, chapter01Uk],
  [chapter02, chapter02Uk],
  [chapter03, chapter03Uk],
  [chapter04, chapter04Uk],
  [chapter05, chapter05Uk],
  [chapter06, chapter06Uk],
  [chapter07, chapter07Uk],
  [chapter08, chapter08Uk],
  [chapter09, chapter09Uk],
  [chapter10, chapter10Uk],
  [chapter11, chapter11Uk],
  [chapter12, chapter12Uk],
  [chapter13, chapter13Uk],
  [chapter14, chapter14Uk],
];

export const gitCatalog = {
  title: "Git & collaboration",
  titleUk: "Git і командна робота",
  status: "under-review",
  description: "A sequential learning path from Git fundamentals to safe collaboration, review, delivery and recovery, with a local two-contributor lab.",
  taxonomy,
  sources,
  chapters: taxonomy.map((topic, index) => ({
    ...topic,
    markdown: documents[index][0],
    markdownUk: documents[index][1],
  })),
};

export default gitCatalog;
