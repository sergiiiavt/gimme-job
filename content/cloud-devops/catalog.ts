import taxonomyData from "./taxonomy.json";
import sourcesData from "./sources.json";
import chapter01 from "./01-infrastructure-as-code.md?raw";
import chapter02 from "./02-gimmejob-infrastructure-case-study.md?raw";
import chapter03 from "./03-deployment-gates.md?raw";
import chapter04 from "./04-gimmejob-deployment-gates-case-study.md?raw";

export type CloudDevopsChapterKind = "foundation" | "case-study";

export interface CloudDevopsTopic {
  id: string;
  order: number;
  label: string;
  description: string;
  file: string;
  kind: CloudDevopsChapterKind;
  sourceIds: string[];
}

export interface CloudDevopsSource {
  id: string;
  title: string;
  publisher: string;
  kind: string;
  status: string;
  url: string;
  role: string;
  checkedAt: string;
}

export interface CloudDevopsChapter extends CloudDevopsTopic {
  markdown: string;
}

const markdownByTopic: Record<string, string> = {
  "infrastructure-as-code": chapter01,
  "gimmejob-infrastructure-case-study": chapter02,
  "deployment-gates": chapter03,
  "gimmejob-deployment-gates-case-study": chapter04,
};

const taxonomy = taxonomyData as CloudDevopsTopic[];
const sources = sourcesData as CloudDevopsSource[];

export const cloudDevopsCatalog = {
  title: "Cloud & DevOps",
  description: "Long-form learning material that combines engineering fundamentals with reproducible case studies from the real GimmeJob production system.",
  taxonomy,
  sources,
  chapters: taxonomy.map((topic): CloudDevopsChapter => ({
    ...topic,
    markdown: markdownByTopic[topic.id] ?? "",
  })),
};

export default cloudDevopsCatalog;
