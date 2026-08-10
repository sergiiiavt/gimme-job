import { XMLParser } from "fast-xml-parser";

export const DEFAULT_DOU_FEED = "https://jobs.dou.ua/vacancies/feeds/?search=QA";

function valueText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && typeof value["#text"] === "string") return value["#text"].trim();
  return "";
}

function stripHtml(value) {
  return valueText(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDouJobs(xml, limit = 100) {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
  const channel = parser.parse(xml)?.rss?.channel;
  const items = Array.isArray(channel?.item) ? channel.item : channel?.item ? [channel.item] : [];

  return items.slice(0, limit).flatMap((item) => {
    const fullTitle = valueText(item?.title);
    const url = valueText(item?.link);
    if (!fullTitle || !url) return [];

    const titleParts = fullTitle.match(/^(.+?)\s+в\s+(.+?)(?:,\s+(.+))?$/i);
    const description = stripHtml(item?.description);
    const title = titleParts?.[1] ?? fullTitle;
    const company = titleParts?.[2] ?? "DOU company";
    const location = titleParts?.[3] ?? "Ukraine";

    return [{
      source: "rss:dou-qa",
      externalId: valueText(item?.guid) || null,
      title,
      company,
      location,
      remote: /remote|віддал/i.test(`${fullTitle} ${description}`),
      url,
      applyUrl: url,
      description,
      salaryText: null,
      postedAt: valueText(item?.pubDate) || null,
      contactEmail: null,
    }];
  });
}

export async function fetchDouJobs(url = DEFAULT_DOU_FEED) {
  const response = await fetch(url, {
    headers: { "user-agent": "GimmeJob/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`DOU feed returned HTTP ${response.status}.`);

  const jobs = parseDouJobs(await response.text());
  if (!jobs.length) throw new Error("DOU feed did not contain any vacancies.");
  return jobs;
}
