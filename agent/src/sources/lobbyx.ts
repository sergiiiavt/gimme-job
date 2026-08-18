import type { JobInput } from "../domain.js";
import { htmlToVacancyText, normalizeVacancyDescription } from "../vacancy-content.js";
import { canonicalizeUrl, decodeHtmlEntities, isRemoteText, safeIsoDate } from "../utils.js";
import { inferCompanyFromText } from "./company.js";
import { fetchJson, fetchText } from "./http.js";
import type { JobSource } from "./types.js";

const API_BASE = "https://thelobbyx.com/wp-json/wp/v2/tors";
const OPEN_STATUS_TERM_ID = 84;
const MAX_DETAIL_FETCHES = 40;

interface TorListItem {
  id: number;
  date: string | null;
  link: string;
  title: { rendered: string };
}

function extractDivByClass(html: string, className: string): string {
  const openTagPattern = new RegExp(`<div[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>`, "i");
  const openMatch = openTagPattern.exec(html);
  if (!openMatch) return "";

  let depth = 1;
  const cursor = openMatch.index + openMatch[0].length;
  const tagPattern = /<div\b[^>]*>|<\/div>/gi;
  tagPattern.lastIndex = cursor;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(cursor, match.index);
  }
  return html.slice(cursor);
}

export function inferCompanyFromDescription(description: string): string {
  return inferCompanyFromText(description) || "Unknown";
}

export interface LobbyXListing {
  id: number;
  url: string;
  title: string;
  postedAt: string | null;
}

export function parseLobbyXListing(items: TorListItem[]): LobbyXListing[] {
  return items
    .filter((item) => item.link && item.title?.rendered)
    .map((item) => ({
      id: item.id,
      url: canonicalizeUrl(item.link),
      title: decodeHtmlEntities(item.title.rendered).trim(),
      postedAt: safeIsoDate(item.date),
    }));
}

export function parseLobbyXDescription(html: string): string {
  return normalizeVacancyDescription(htmlToVacancyText(extractDivByClass(html, "vacancy-description")));
}

export class LobbyXSource implements JobSource {
  readonly name: string;

  constructor(
    name: string,
    private readonly query: string,
  ) {
    this.name = `lobbyx:${name}`;
  }

  async collect(): Promise<JobInput[]> {
    const endpoint = `${API_BASE}?search=${encodeURIComponent(this.query)}&tors-status=${OPEN_STATUS_TERM_ID}&per_page=50`;
    const items = await fetchJson<TorListItem[]>(endpoint);
    const listings = parseLobbyXListing(items).slice(0, MAX_DETAIL_FETCHES);

    return Promise.all(
      listings.map(async (listing): Promise<JobInput> => {
        const description = await fetchText(listing.url)
          .then(parseLobbyXDescription)
          .catch(() => "");
        const company = inferCompanyFromDescription(description);
        const combined = `${listing.title}\n${description}`;

        return {
          source: this.name,
          externalId: String(listing.id),
          title: listing.title,
          company,
          location: "Ukraine",
          remote: isRemoteText(combined),
          url: listing.url,
          applyUrl: listing.url,
          description,
          salaryText: null,
          postedAt: listing.postedAt,
          contactEmail: null,
          raw: listing,
        };
      }),
    );
  }
}
