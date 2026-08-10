import { XMLParser } from "fast-xml-parser";
import type { JobInput } from "../domain.js";
import {
  asArray,
  canonicalizeUrl,
  compactText,
  inferCompany,
  inferRoleTitle,
  isRemoteText,
  safeIsoDate,
  stripHtml,
} from "../utils.js";
import { fetchText } from "./http.js";
import type { JobSource } from "./types.js";

type XmlNode = Record<string, unknown>;

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

    return items
      .map((raw): JobInput | null => {
        const item = node(raw);
        const rawTitle = firstText(item.title, item.name);
        const url = extractLink(item.link) || extractLink(item.guid) || extractLink(item.id);
        if (!rawTitle || !url) return null;

        const descriptionHtml = firstText(
          item["encoded"],
          item.content,
          item.description,
          item.summary,
        );
        const description = stripHtml(descriptionHtml);
        const creator = firstText(item.creator, item.author, item.company);
        const company = creator || inferCompany(rawTitle);
        const location = firstText(item.location) || "Unknown";
        const combined = `${rawTitle}\n${description}\n${location}`;

        return {
          source: this.name,
          externalId: firstText(item.guid, item.id) || url,
          title: inferRoleTitle(rawTitle),
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
  }
}
