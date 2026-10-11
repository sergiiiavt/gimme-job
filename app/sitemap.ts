import type { MetadataRoute } from "next";
import { allInterviewQuestionPages } from "./interview-question-seo";
import { PUBLIC_SITEMAP_PATHS, SITE_ORIGIN } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const questionPaths = allInterviewQuestionPages().flatMap((page) => [page.englishPath, page.ukrainianPath]);
  return [...PUBLIC_SITEMAP_PATHS, ...questionPaths].map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
  }));
}
