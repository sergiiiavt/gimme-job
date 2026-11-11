import type { NextConfig } from "next";

// Google uses canonical and hreflang links in <head>. The override also
// keeps Vinext's default search and link-preview crawlers on blocking metadata.
const metadataCrawlers = new RegExp([
  /(?:^|[^\w-])[\w-]+-Google|Google-[\w-]+|Googlebot|googleweblight/.source,
  "Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|ia_archiver|Bingbot|BingPreview|applebot|Yeti",
  "bitlybot|tumblr|vkShare|quora link preview|redditbot|facebookexternalhit|facebookcatalog|meta-externalagent|meta-externalfetcher",
  "Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview",
].join("|"), "i");

const nextConfig: NextConfig = {
  htmlLimitedBots: metadataCrawlers,
};

export default nextConfig;
