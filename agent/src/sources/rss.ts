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
type DouLoadPayload = { html?: unknown; last?: unknown };

const MAX_DETAIL_FETCHES = 40;
const DOU_PAGE_SIZE = 20;
const DOU_MAX_PAGES = 30;
const DOU_ORIGIN = "https://jobs.dou.ua";
const DOU_QA_LISTING_URL = `${DOU_ORIGIN}/vacancies/?category=QA`;
const DOU_QA_LOAD_URL = `${DOU_ORIGIN}/vacancies/xhr-load/?category=QA`;
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

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

function extractElementByClass(html: string, tagName: string, className: string): string {
  const escapedTag = tagName.replace(/[^a-z0-9]/gi, "");
  const openMatch = new RegExp(`<${escapedTag}[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, "i").exec(html);
  if (!openMatch) return "";
  let depth = 1;
  const cursor = openMatch.index + openMatch[0].length;
  const tags = new RegExp(`<${escapedTag}\\b[^>]*>|<\\/${escapedTag}>`, "gi");
  tags.lastIndex = cursor;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(cursor, match.index);
  }
  return html.slice(cursor);
}

function extractElementsByClass(html: string, tagName: string, className: string): string[] {
  const escapedTag = tagName.replace(/[^a-z0-9]/gi, "");
  const open = new RegExp(`<${escapedTag}[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, "gi");
  const blocks: string[] = [];
  let openMatch: RegExpExecArray | null;
  while ((openMatch = open.exec(html))) {
    let depth = 1;
    const cursor = openMatch.index + openMatch[0].length;
    const tags = new RegExp(`<${escapedTag}\\b[^>]*>|<\\/${escapedTag}>`, "gi");
    tags.lastIndex = cursor;
    let match: RegExpExecArray | null;
    while ((match = tags.exec(html))) {
      depth += match[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        blocks.push(html.slice(openMatch.index, tags.lastIndex));
        open.lastIndex = tags.lastIndex;
        break;
      }
    }
    if (depth !== 0) break;
  }
  return blocks;
}

function extractDivByClass(html: string, className: string): string {
  return extractElementByClass(html, "div", className);
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function htmlText(value: string): string {
  return compactText(htmlToVacancyText(value));
}

function attribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(attributes);
  return match?.[1]?.trim() ?? "";
}

function anchorByClass(html: string, className: string): { href: string; text: string } | null {
  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchors.exec(html))) {
    const classes = attribute(match[1], "class").split(/\s+/).filter(Boolean);
    if (!classes.includes(className)) continue;
    const href = attribute(match[1], "href");
    const text = htmlText(match[2]);
    if (href && text) return { href, text };
  }
  return null;
}

function absoluteDouUrl(value: string): string {
  try {
    return canonicalizeUrl(new URL(value, DOU_ORIGIN).toString());
  } catch {
    return "";
  }
}

function douExternalId(url: string): string | null {
  const match = /\/vacancies\/(\d+)\/?$/i.exec(url);
  return match?.[1] ?? null;
}

function longestText(values: string[]): string {
  return values.reduce((longest, value) => value.length > longest.length ? value : longest, "");
}

export function parseDouVacancyListing(html: string, source: string): JobInput[] {
  return extractElementsByClass(html, "li", "l-vacancy")
    .map((block): JobInput | null => {
      const titleLink = anchorByClass(block, "vt");
      if (!titleLink) return null;
      const url = absoluteDouUrl(titleLink.href);
      if (!url) return null;

      const companyBlock = extractElementByClass(block, "span", "company") || extractElementByClass(block, "div", "company");
      const company = htmlText(companyBlock).replace(/^в\s+/iu, "").trim() || "Unknown";
      const cityBlock = extractElementByClass(block, "span", "cities") || extractElementByClass(block, "div", "cities");
      const location = htmlText(cityBlock) || "Unknown";
      const teaser = longestText([
        htmlText(extractDivByClass(block, "sh-info")),
        htmlText(extractDivByClass(block, "text")),
        htmlText(extractDivByClass(block, "descr")),
      ]);
      const title = titleLink.text;
      const combined = `${title}\n${teaser}\n${location}`;

      return {
        source,
        externalId: douExternalId(url) || url,
        title,
        company,
        location,
        remote: isRemoteText(combined),
        url,
        applyUrl: url,
        description: normalizeVacancyDescription(teaser),
        salaryText: null,
        postedAt: null,
        contactEmail: null,
        raw: { discovery: "dou-listing" },
      };
    })
    .filter((job): job is JobInput => job !== null);
}

function csrfToken(html: string): string {
  return /window\.CSRF_TOKEN\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ?? "";
}

function cookieHeader(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  if (!raw) return "";
  return raw
    .split(/,(?=\s*[^;,]+=)/)
    .map((cookie) => cookie.split(";", 1)[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchDouListingPage(): Promise<{ html: string; csrf: string; cookie: string }> {
  const response = await fetch(DOU_QA_LISTING_URL, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "uk-UA,uk;q=0.9,en;q=0.8",
      "user-agent": BROWSER_USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${DOU_QA_LISTING_URL}`);
  const html = await response.text();
  const csrf = csrfToken(html);
  if (!csrf) throw new Error("DOU vacancy page did not expose CSRF token required for pagination.");
  return { html, csrf, cookie: cookieHeader(response) };
}

async function fetchDouMore(count: number, csrf: string, cookie: string): Promise<{ html: string; last: boolean }> {
  const body = new URLSearchParams({ csrfmiddlewaretoken: csrf, count: String(count) });
  const response = await fetch(DOU_QA_LOAD_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "uk-UA,uk;q=0.9,en;q=0.8",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: DOU_ORIGIN,
      referer: DOU_QA_LISTING_URL,
      "user-agent": BROWSER_USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
      ...(cookie ? { cookie } : {}),
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${DOU_QA_LOAD_URL}`);

  const text = await response.text();
  try {
    const payload = JSON.parse(text) as DouLoadPayload;
    return {
      html: typeof payload.html === "string" ? payload.html : "",
      last: payload.last === true || payload.last === "true",
    };
  } catch {
    return { html: text, last: false };
  }
}

async function enrichDouDetails(jobs: JobInput[]): Promise<JobInput[]> {
  return Promise.all(jobs.map(async (job, index) => {
    if (index >= MAX_DETAIL_FETCHES) return job;
    try {
      const detailHtml = await fetchText(job.url);
      const metadata = extractJobPostingMetadata(detailHtml);
      const full = parseRssDetailDescription(job.url, detailHtml);
      return {
        ...job,
        company: metadata?.company || job.company,
        description: full.length > job.description.length ? full : job.description,
        postedAt: safeIsoDate(metadata?.datePosted) || job.postedAt,
        remote: job.remote || isRemoteText(`${job.title}\n${full}\n${job.location}`),
      };
    } catch {
      return job;
    }
  }));
}

async function collectDouQaVacancies(source: string): Promise<JobInput[]> {
  const first = await fetchDouListingPage();
  const jobs = parseDouVacancyListing(first.html, source);
  const seenUrls = new Set(jobs.map((job) => job.url));
  let count = jobs.length;

  for (let page = 1; page < DOU_MAX_PAGES; page += 1) {
    const loaded = await fetchDouMore(count, first.csrf, first.cookie);
    const batch = parseDouVacancyListing(loaded.html, source);
    let added = 0;
    for (const job of batch) {
      if (seenUrls.has(job.url)) continue;
      seenUrls.add(job.url);
      jobs.push(job);
      added += 1;
    }
    count += batch.length;
    if (loaded.last || batch.length === 0 || added === 0 || batch.length < DOU_PAGE_SIZE) break;
  }

  return enrichDouDetails(jobs);
}

export function parseRssDetailDescription(url: string, html: string): string {
  const metadata = extractJobPostingMetadata(html);
  if (metadata?.description) {
    const description = normalizeVacancyDescription(metadata.description);
    if (description) return description;
  }

  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { /* use generic fallbacks */ }

  const classCandidates = hostMatches(hostname, "dou.ua")
    ? ["vacancy-section", "b-typo"]
    : hostMatches(hostname, "djinni.co")
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
    let feedHost = "";
    try { feedHost = new URL(this.url).hostname.toLowerCase(); } catch { /* ignore */ }
    if (hostMatches(feedHost, "dou.ua") && /(?:search|category)=QA(?:&|$)/i.test(this.url)) {
      return collectDouQaVacancies(this.name);
    }

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

    const jobs = items
      .map((raw): JobInput | null => {
        const item = node(raw);
        const rawTitle = firstText(item.title, item.name);
        const url = extractLink(item.link) || extractLink(item.guid) || extractLink(item.id);
        if (!rawTitle || !url) return null;

        const descriptionHtml = firstText(item["encoded"], item.content, item.description, item.summary);
        const description = normalizeVacancyDescription(htmlToVacancyText(descriptionHtml));
        const creator = firstText(item.creator, item.author, item.company);
        const douTitle = hostMatches(feedHost, "dou.ua")
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
