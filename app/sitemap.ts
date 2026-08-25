import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS, SITE_ORIGIN } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...new Set([...PUBLIC_SITEMAP_PATHS, "/learn/data"] as const)];
  return paths.map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
  }));
}
