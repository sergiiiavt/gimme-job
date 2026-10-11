import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "./seo.ts";

// /workspace stays crawlable so crawlers can see its noindex response header.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth", "/internal/", "/mcp"],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
