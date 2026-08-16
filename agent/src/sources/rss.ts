import { XMLParser } from "fast-xml-parser";
import type { JobInput } from "../domain.js";
import {
  extractJobPostingMetadata,
  htmlToVacancyText,
  normalizeVacancyDescription,
} from "../vacancy-content.js";
import {
  asArray,
  canonicalizeUrl,
  compactText,
  inferCompany,
  inferRoleTitle,
  isRemoteText,
  safeIsoDate,
} from "../utils.js";
import { fetchText } from "./http.js";
import type { JobSource } from "./types.js";

type XmlNode = Record<string, unknown>;

const MAX_DETAIL_FETCHES = 40;

function node(value: unknown): XmlNode {
  return typeof value === "object" && value !== null ? (value as XmlNode) : {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = compactText(value);
    if (text) return text;
  }
  return "";
}

function extractLink(value: unknown): string {
  for (const candidate of asArray(value)) {
    if (typeof candidate === "string") return canonicalizeUrl(candidate);
    const candidateNode = node(candidate);
    const href = firstText(candidateNode["@_href"], candidateNode["#text"]);
    if (href) return canonicalizeUrl(href);
  }
  return "";
}

function extractDivByClass(html: string, className: string): string {
  const openMatch = new RegExp(`<div[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, "i").exec(html);
  if (!openMatch) return "";
  let depth = 1;
  const cursor = openMatch.index + openMatch[0].length;
  const tags = /<div\b[^>]*>|<\/div>/gi;
  tags.lastIndex = cursor;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(cursor, match.index);
  }
  return html.slice(cursor);
}

export function parseRssDetailDescription(url: string, html: string): string {
  const metadata = extractJobPostingMetadata(html);
  if (metadata?.description) {
    const description = normalizeVacancyDescription(metadata.description);
    if (description) return description;
  }

  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { /* use generic fallbacks */ }

  const classCandidates = hostname.endsWith("dou.ua")
    ? ["vacancy-section", "b-typo"]
    : hostname.endsWith("djinni.co")
      ? ["job-details--about", "job-details__about", "job-description", "job-details"]
      : ["job-description", "vacancy-section"];

  for (const className of classCandidates) {
    const body = extractDivByClass(html, className);
    const description = normalizeVacancyDescription(htmlToVacancyText(body));
    if (description.length >= 100) return description;
  }
  return "";
}

export class RssJobSource implements JobSource {
  readonly name: string;

  constructor(
    name: string,
    private readonly url: string,
  ) {
    this.name = `rss:${name}`;
  }

  async collect(): Promise<JobInput[]> {
    const xml = await fetchText(this.url);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      textNodeName: "#text",
      trimValues: true,
    });
    const parsed = node(parser.parse(xml));
    const rssItems = asArray(node(node(parsed.rss).channel).item);
    const atomEntries = asArray(node(parsed.feed).entry);
    const items = [...rssItems, ...atomEntries];
    let feedHost = "";
    try { feedHost = new URL(this.url).hostname.toLowerCase(); } catch { /* ignore */ }

    const jobs = items
      .map((raw): JobInput | null => {
        const item = node(raw);
        const rawTitle = firstText(item.title, item.name);
        const url = extractLink(item.link) || extractLink(item.guid) || extractLink(item.id);
        if (!rawTitle || !url) return null;

        const descriptionHtml = firstText(item["encoded"], item.content, item.description, item.summary);
        const description = normalizeVacancyDescription(htmlToVacancyText(descriptionHtml));
        const creator = firstText(item.creator, item.author, item.company);
        const douTitle = feedHost.endsWith("dou.ua")
          ? rawTitle.match(/^(.+?)\s+в\s+(.+?)(?:,\s+(.+))?$/iu)
          : null;
        const title = douTitle?.[1]?.trim() || inferRoleTitle(rawTitle);
        const company = douTitle?.[2]?.trim() || creator || inferCompany(rawTitle);
        const location = douTitle?.[3]?.trim() || firstText(item.location) || "Unknown";
        const combined = `${title}\n${description}\n${location}`;

        return {
          source: this.name,
          externalId: firstText(item.guid, item.id) || url,
          title,
          company,
          location,
          remote: isRemoteText(combined),
          url,
          applyUrl: url,
          description,
          salaryText: null,
          postedAt: safeIsoDate(firstText(item.pubDate, item.published, item.updated)),
          contactEmail: null,
          raw,
        };
      })
      .filter((job): job is JobInput => job !== null);

    return Promise.all(jobs.map(async (job, index) => {
      if (index >= MAX_DETAIL_FETCHES) return job;
      try {
        const full = parseRssDetailDescription(job.url, await fetchText(job.url));
        if (full.length > job.description.length) {
          return {
            ...job,
            description: full,
            remote: job.remote || isRemoteText(`${job.title}\n${full}\n${job.location}`),
          };
        }
      } catch {
        // Preserve the feed body when a detail page is temporarily unavailable.
      }
      return job;
    }));
  }
}
