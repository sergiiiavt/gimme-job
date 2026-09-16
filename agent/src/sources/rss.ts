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
  mapWithConcurrency,
  safeIsoDate,
} from "../utils.js";
import { fetchText } from "./http.js";
import type { JobSource } from "./types.js";

type XmlNode = Record<string, unknown>;
type DouLoadPayload = { html?: unknown; last?: unknown };

/**
 * Detail-page budget for one `collect()` call.
 *
 * A Cloudflare Worker invocation is bounded in subrequests and CPU, so a
 * Worker-hosted sync must not try to fetch a whole catalogue's detail pages.
 * The Node runner that syncs DOU hourly has no such ceiling and passes
 * `Number.POSITIVE_INFINITY` to enrich every discovered vacancy.
 */
export const DEFAULT_DETAIL_BUDGET = 40;
const DETAIL_CONCURRENCY = 6;
const DOU_PAGE_SIZE = 20;
const DOU_MAX_PAGES = 30;
const DOU_ORIGIN = "https://jobs.dou.ua";
const DOU_DEFAULT_QUERY = "category=QA";
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
    const url = new URL(value, DOU_ORIGIN);
    // Promoted cards carry ?from=list_hot. Keeping it would change the canonical
    // URL — and therefore the identity — of a vacancy as soon as it stops being
    // promoted, inserting a second row for the same posting.
    url.searchParams.delete("from");
    return canonicalizeUrl(url.toString());
  } catch {
    return "";
  }
}

function douExternalId(url: string): string | null {
  const match = /\/vacancies\/(\d+)(?:\/|$|\?)/i.exec(url);
  return match?.[1] ?? null;
}

/**
 * DOU renders the employer as `<a class="company">`, and repeats the same
 * employer as a slug in `/companies/<slug>/vacancies/`. The anchor is the
 * authoritative name; the slug is a deterministic fallback for the rare card
 * that omits it.
 */
function douCompanySource(anchorCompany: string, blockCompany: string): string {
  if (anchorCompany) return "listing-anchor";
  return blockCompany ? "listing-block" : "url-slug";
}

function douCompanyFromUrl(url: string): string {
  const slug = /\/companies\/([^/]+)\//i.exec(url)?.[1] ?? "";
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const DOU_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

/**
 * DOU card dates read `17 серпня` — day and month, never a year. A date more
 * than a day ahead of today belongs to the previous year.
 */
export function parseDouCardDate(value: string, now = new Date()): string | null {
  const match = /^\s*(\d{1,2})\s+([а-яіїєґ']+)\s*$/iu.exec(value);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = DOU_MONTHS.indexOf(match[2].toLowerCase());
  if (month < 0 || day < 1 || day > 31) return null;

  const candidate = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  if (candidate.getUTCDate() !== day || candidate.getUTCMonth() !== month) return null;
  if (candidate.getTime() - now.getTime() > 86_400_000) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() - 1);
  }
  return candidate.toISOString();
}

function longestText(values: string[]): string {
  return values.reduce((longest, value) => value.length > longest.length ? value : longest, "");
}

function douCardCount(html: string): number {
  return extractElementsByClass(html, "li", "l-vacancy").length;
}

export function parseDouVacancyListing(html: string, source: string): JobInput[] {
  return extractElementsByClass(html, "li", "l-vacancy")
    .map((block): JobInput | null => {
      const titleLink = anchorByClass(block, "vt");
      if (!titleLink) return null;
      const url = absoluteDouUrl(titleLink.href);
      if (!url) return null;

      const companyAnchor = anchorByClass(block, "company");
      const companyBlock = extractElementByClass(block, "span", "company") || extractElementByClass(block, "div", "company");
      const anchorCompany = companyAnchor ? companyAnchor.text.replace(/^в\s+/iu, "").trim() : "";
      const blockCompany = htmlText(companyBlock).replace(/^в\s+/iu, "").trim();
      const company = anchorCompany || blockCompany || douCompanyFromUrl(url) || "Unknown";
      const companySource = douCompanySource(anchorCompany, blockCompany);
      const cityBlock = extractElementByClass(block, "span", "cities") || extractElementByClass(block, "div", "cities");
      const location = htmlText(cityBlock) || "Unknown";
      const postedAt = parseDouCardDate(htmlText(extractDivByClass(block, "date")));
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
        postedAt,
        contactEmail: null,
        raw: { discovery: "dou-listing", companySource, descriptionSource: "listing-teaser" },
      };
    })
    .filter((job): job is JobInput => job !== null);
}

function douListingUrl(query: string): string {
  return `${DOU_ORIGIN}/vacancies/?${query}`;
}

function douLoadUrl(query: string): string {
  return `${DOU_ORIGIN}/vacancies/xhr-load/?${query}`;
}

/**
 * The configured source URL decides which DOU catalogue is collected. Both the
 * RSS feed (`feeds/?search=QA`) and the listing page (`?category=QA`) name the
 * same query parameters, so the configured value is honoured rather than
 * silently replaced with a hard-coded category.
 */
export function douListingQuery(sourceUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (!hostMatches(url.hostname.toLowerCase(), "dou.ua")) return null;

  const category = url.searchParams.get("category")?.trim();
  if (category) return `category=${encodeURIComponent(category)}`;
  const search = url.searchParams.get("search")?.trim();
  if (search) return `search=${encodeURIComponent(search)}`;
  return url.pathname.startsWith("/vacancies") ? DOU_DEFAULT_QUERY : null;
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

async function fetchDouListingPage(query: string): Promise<{ html: string; csrf: string; cookie: string }> {
  const listingUrl = douListingUrl(query);
  const response = await fetch(listingUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "uk-UA,uk;q=0.9,en;q=0.8",
      "user-agent": BROWSER_USER_AGENT,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${listingUrl}`);
  const html = await response.text();
  const csrf = csrfToken(html);
  if (!csrf) throw new Error("DOU vacancy page did not expose CSRF token required for pagination.");
  return { html, csrf, cookie: cookieHeader(response) };
}

async function fetchDouMore(query: string, count: number, csrf: string, cookie: string): Promise<{ html: string; last: boolean }> {
  const body = new URLSearchParams({ csrfmiddlewaretoken: csrf, count: String(count) });
  const loadUrl = douLoadUrl(query);
  const response = await fetch(loadUrl, {
    method: "POST",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "uk-UA,uk;q=0.9,en;q=0.8",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: DOU_ORIGIN,
      referer: douListingUrl(query),
      "user-agent": BROWSER_USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
      ...(cookie ? { cookie } : {}),
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${loadUrl}`);

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

/**
 * Enriches discovered vacancies up to `budget`. Where the budget allows the
 * whole catalogue, nothing is left on a ~200-character listing teaser; where it
 * does not, the remainder keeps its teaser and is enriched by the run that owns
 * the larger budget.
 */
async function enrichDouDetails(jobs: JobInput[], budget: number): Promise<JobInput[]> {
  const enriched = jobs.slice(0, budget);
  const remainder = jobs.slice(enriched.length);
  const detailed = await mapWithConcurrency(enriched, DETAIL_CONCURRENCY, async (job) => {
    try {
      const detailHtml = await fetchText(job.url);
      const detail = parseRssDetail(job.url, detailHtml);
      const description = detail.description.length > job.description.length ? detail.description : job.description;
      const raw = { ...(job.raw as Record<string, unknown>) };
      if (detail.description.length > job.description.length) raw.descriptionSource = "detail-page";
      if (!isDouUsableCompany(job.company) && detail.company) raw.companySource = "detail-metadata";
      return {
        ...job,
        company: isDouUsableCompany(job.company) ? job.company : detail.company || job.company,
        description,
        postedAt: job.postedAt ?? detail.postedAt,
        remote: job.remote || isRemoteText(`${job.title}\n${description}\n${job.location}`),
        raw,
      };
    } catch {
      return job;
    }
  });

  return [...detailed, ...remainder];
}

function isDouUsableCompany(value: string): boolean {
  return Boolean(value) && value !== "Unknown";
}

async function collectDouQaVacancies(source: string, query: string, budget: number): Promise<JobInput[]> {
  const first = await fetchDouListingPage(query);
  const jobs = parseDouVacancyListing(first.html, source);
  const seenUrls = new Set(jobs.map((job) => job.url));
  let count = douCardCount(first.html);

  for (let page = 1; page < DOU_MAX_PAGES; page += 1) {
    const loaded = await fetchDouMore(query, count, first.csrf, first.cookie);
    const rawBatchCount = douCardCount(loaded.html);
    const batch = parseDouVacancyListing(loaded.html, source);
    let added = 0;
    for (const job of batch) {
      if (seenUrls.has(job.url)) continue;
      seenUrls.add(job.url);
      jobs.push(job);
      added += 1;
    }
    count += rawBatchCount;
    if (loaded.last || rawBatchCount === 0 || added === 0 || rawBatchCount < DOU_PAGE_SIZE) break;
  }

  return enrichDouDetails(jobs, budget);
}

export interface RssDetail {
  description: string;
  company: string;
  postedAt: string | null;
}

/**
 * A detail page that publishes `schema.org/JobPosting` gives up the employer
 * and the posting date alongside the body. Returning only the description threw
 * those away and forced a second, guess-based recovery pass over the same page.
 */
export function parseRssDetail(url: string, html: string): RssDetail {
  const metadata = extractJobPostingMetadata(html);
  const company = metadata?.company?.trim() ?? "";
  const postedAt = safeIsoDate(metadata?.datePosted);

  const structured = metadata?.description ? normalizeVacancyDescription(metadata.description) : "";
  if (structured) return { description: structured, company, postedAt };

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
    if (description.length >= 100) return { description, company, postedAt };
  }
  return { description: "", company, postedAt };
}

export function parseRssDetailDescription(url: string, html: string): string {
  return parseRssDetail(url, html).description;
}

export interface RssSourceOptions {
  /** Detail pages fetched per collect(). Pass Infinity where no runtime ceiling applies. */
  detailBudget?: number;
}

export class RssJobSource implements JobSource {
  readonly name: string;
  private readonly detailBudget: number;

  constructor(
    name: string,
    private readonly url: string,
    options: RssSourceOptions = {},
  ) {
    this.name = `rss:${name}`;
    this.detailBudget = options.detailBudget ?? DEFAULT_DETAIL_BUDGET;
  }

  async collect(): Promise<JobInput[]> {
    let feedHost = "";
    try { feedHost = new URL(this.url).hostname.toLowerCase(); } catch { /* ignore */ }
    const douQuery = douListingQuery(this.url);
    if (douQuery) {
      try {
        return await collectDouQaVacancies(this.name, douQuery, this.detailBudget);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`DOU full discovery failed for ${this.name}; falling back to RSS: ${message}`);
      }
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

    const enriched = jobs.slice(0, this.detailBudget);
    const remainder = jobs.slice(enriched.length);

    const detailed = await mapWithConcurrency(enriched, DETAIL_CONCURRENCY, async (job) => {
      try {
        const detail = parseRssDetail(job.url, await fetchText(job.url));
        const description = detail.description.length > job.description.length ? detail.description : job.description;
        return {
          ...job,
          // The detail page's JobPosting metadata is authoritative for the
          // employer: a feed that omits the company must not be "recovered"
          // by guessing at the description prose later in the pipeline.
          company: isDouUsableCompany(job.company) ? job.company : detail.company || job.company,
          description,
          postedAt: job.postedAt ?? detail.postedAt,
          remote: job.remote || isRemoteText(`${job.title}\n${description}\n${job.location}`),
        };
      } catch {
        // Preserve the feed body when a detail page is temporarily unavailable.
        return job;
      }
    });

    return [...detailed, ...remainder];
  }
}
