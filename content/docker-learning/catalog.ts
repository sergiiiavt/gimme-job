import taxonomy from "./taxonomy.json";
import sources from "./sources.json";
import chapter01 from "./01-foundations.md?raw";
import chapter01Uk from "./01-foundations.uk.md?raw";
import chapter02 from "./02-setup.md?raw";
import chapter02Uk from "./02-setup.uk.md?raw";
import chapter03 from "./03-container-lifecycle.md?raw";
import chapter03Uk from "./03-container-lifecycle.uk.md?raw";
import chapter04 from "./04-images-registries.md?raw";
import chapter04Uk from "./04-images-registries.uk.md?raw";
import chapter05 from "./05-dockerfiles.md?raw";
import chapter05Uk from "./05-dockerfiles.uk.md?raw";
import chapter06 from "./06-builds.md?raw";
import chapter06Uk from "./06-builds.uk.md?raw";
import chapter07 from "./07-storage.md?raw";
import chapter07Uk from "./07-storage.uk.md?raw";
import chapter08 from "./08-networking.md?raw";
import chapter08Uk from "./08-networking.uk.md?raw";
import chapter09 from "./09-compose.md?raw";
import chapter09Uk from "./09-compose.uk.md?raw";
import chapter10 from "./10-configuration.md?raw";
import chapter10Uk from "./10-configuration.uk.md?raw";
import chapter11 from "./11-testing-ci.md?raw";
import chapter11Uk from "./11-testing-ci.uk.md?raw";
import chapter12 from "./12-security.md?raw";
import chapter12Uk from "./12-security.uk.md?raw";
import chapter13 from "./13-troubleshooting.md?raw";
import chapter13Uk from "./13-troubleshooting.uk.md?raw";
import chapter14 from "./14-production.md?raw";
import chapter14Uk from "./14-production.uk.md?raw";
import chapter15 from "./15-ecosystem.md?raw";
import chapter15Uk from "./15-ecosystem.uk.md?raw";
import chapter16 from "./16-capstone.md?raw";
import chapter16Uk from "./16-capstone.uk.md?raw";

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
  [chapter15, chapter15Uk],
  [chapter16, chapter16Uk],
];

// The shared page renders registered sources separately. Keep that appendix out of
// the chapter/RAG body so retrieval cannot link to a non-rendered Sources section.
const chapterBody = (markdown: string) => markdown.split("\n## Sources\n", 1)[0];

export const dockerCatalog = {
  title: "Docker & containers",
  titleUk: "Docker і контейнери",
  description: "A sequential path from container fundamentals to operating and testing complete applications, with a runnable capstone.",
  taxonomy,
  sources,
  chapters: taxonomy.map((topic, index) => ({
    ...topic,
    markdown: chapterBody(documents[index][0]),
    markdownUk: chapterBody(documents[index][1]),
  })),
};

export default dockerCatalog;
