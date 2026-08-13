import type { JobInput } from "../domain.js";
import { canonicalizeUrl, decodeHtmlEntities, isRemoteText, safeIsoDate, stripHtml } from "../utils.js";
import { fetchJson, fetchText } from "./http.js";
import type { JobSource } from "./types.js";

const API_BASE = "https://thelobbyx.com/wp-json/wp/v2/tors";
const OPEN_STATUS_TERM_ID = 84; // "tors-status" taxonomy term "is-open"
const MAX_DETAIL_FETCHES = 30;

interface TorListItem {
  id: number;
  date: string | null;
  link: string;
  title: { rendered: string };
}

// The custom "tors" post type doesn't expose post_content via the REST API,
// so the description has to come from the detail page's own markup. Nested
// <div>s rule out a flat regex, hence the depth-aware scan.
function extractDivByClass(html: string, className: string): string {
  const openTagPattern = new RegExp(`<div[^>]*class="[^"]*${className}[^"]*"[^>]*>`);
  const openMatch = openTagPattern.exec(html);
  if (!openMatch) return "";

  let depth = 1;
  const cursor = openMatch.index + openMatch[0].length;
  const tagPattern = /<div\b[^>]*>|<\/div>/g;
  tagPattern.lastIndex = cursor;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(cursor, match.index);
  }
  return html.slice(cursor);
}

// Ukrainian job posts on this site conventionally open with "Company Name — ...",
// right after a generic "Огляд"/"Overview" heading, so search the opening
// paragraph rather than anchoring strictly to the first character.
const COMPANY_PREFIX_PATTERN =
  /(?:^|\n)([A-ZА-ЯЁІЇЄ][\p{L}0-9«»'".,-]*(?:\s[A-ZА-ЯЁІЇЄ«][\p{L}0-9«»'".,-]*){0,4})\s*[—-]\s/u;

export function inferCompanyFromDescription(description: string): string {
  return COMPANY_PREFIX_PATTERN.exec(description.slice(0, 300))?.[1]?.trim() || "Unknown";
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
  return stripHtml(extractDivByClass(html, "vacancy-description"));
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
