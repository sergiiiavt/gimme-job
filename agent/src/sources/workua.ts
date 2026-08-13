import type { JobInput } from "../domain.js";
import {
  canonicalizeUrl,
  decodeHtmlEntities,
  inferRoleTitle,
  isRemoteText,
  stripHtml,
} from "../utils.js";
import { fetchText } from "./http.js";
import type { JobSource } from "./types.js";

const BASE_URL = "https://www.work.ua";

// work.ua job cards vary in structure (salary badges, verified-company markers,
// work-format tags), so company/location are recovered independently from every
// "strong-600"/empty-class leaf span in the card rather than one rigid shape.
const CARD_PATTERN =
  /href="(\/[a-z]{2}\/jobs\/\d+\/)"[^>]*>([^<]*)<\/a>\s*<\/h2>([\s\S]{0,2500}?)<p class="ellipsis[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
const STRONG_SPAN_PATTERN = /<span class="strong-600">([^<]*)<\/span>/g;
const PLAIN_SPAN_PATTERN = /<span class="">([^<]*)<\/span>/g;

function extractCompany(meta: string): string {
  const candidates = [...meta.matchAll(STRONG_SPAN_PATTERN)].map((match) =>
    decodeHtmlEntities(match[1] ?? "").trim(),
  );
  const company = candidates.find((text) => text && text !== "Company is hidden" && !/\d/.test(text));
  return company || "Unknown";
}

function extractLocation(meta: string): string {
  const candidates = [...meta.matchAll(PLAIN_SPAN_PATTERN)]
    .map((match) => decodeHtmlEntities(match[1] ?? "").trim())
    .filter(Boolean);
  const location = candidates.at(-1)?.replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
  return location || "Unknown";
}

export interface WorkUaListing {
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
}

export function parseWorkUaListing(html: string, baseUrl = BASE_URL): WorkUaListing[] {
  const listings: WorkUaListing[] = [];
  for (const match of html.matchAll(CARD_PATTERN)) {
    const [, relativeUrl, rawTitle, meta, rawDescription] = match;
    const title = decodeHtmlEntities(rawTitle ?? "").trim();
    if (!title || !relativeUrl) continue;

    listings.push({
      url: canonicalizeUrl(`${baseUrl}${relativeUrl}`),
      title: inferRoleTitle(title),
      company: extractCompany(meta ?? ""),
      location: extractLocation(meta ?? ""),
      description: stripHtml(rawDescription ?? ""),
    });
  }
  return listings;
}

export class WorkUaSource implements JobSource {
  readonly name: string;

  constructor(
    name: string,
    private readonly query: string,
  ) {
    this.name = `workua:${name}`;
  }

  async collect(): Promise<JobInput[]> {
    const url = `${BASE_URL}/en/jobs/?search=${encodeURIComponent(this.query)}`;
    const html = await fetchText(url);

    return parseWorkUaListing(html).map((listing): JobInput => {
      const combined = `${listing.title}\n${listing.description}\n${listing.location}`;
      return {
        source: this.name,
        externalId: listing.url,
        title: listing.title,
        company: listing.company,
        location: listing.location,
        remote: isRemoteText(combined),
        url: listing.url,
        applyUrl: listing.url,
        description: listing.description,
        salaryText: null,
        postedAt: null,
        contactEmail: null,
        raw: listing,
      };
    });
  }
}
