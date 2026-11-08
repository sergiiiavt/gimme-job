import type { MetadataRoute } from "next";
import { allInterviewQuestionPages } from "./interview-question-seo";
import { learningTopicPages } from "./learning-topic-seo";
import { PUBLIC_SITEMAP_PATHS, SITE_ORIGIN } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const questionPaths = allInterviewQuestionPages().flatMap((page) => [page.englishPath, page.ukrainianPath]);
  const topicPaths = learningTopicPages().map((page) => page.path);
  return [...new Set([...PUBLIC_SITEMAP_PATHS, ...topicPaths, ...questionPaths])].map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
  }));
}
