import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS, SITE_ORIGIN } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
  }));
}
