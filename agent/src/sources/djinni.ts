import type { JobInput } from "../domain.js";
import { normalizeVacancyDescription } from "../vacancy-content.js";
import { canonicalizeUrl, isRemoteText, safeIsoDate } from "../utils.js";
import { fetchText } from "./http.js";
import type { JobSource } from "./types.js";

const ORIGIN = "https://djinni.co";
const MAX_PAGES = 20;
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Json : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function countryName(address: Json): string {
  const country = text(address.addressCountry);
  // Djinni emits ISO codes in applicantLocationRequirements and a localised
  // name in jobLocation. Either is more useful than "Unknown".
  return country === "UA" ? "Україна" : country;
}

function addressText(address: Json): string {
  const locality = Array.isArray(address.addressLocality)
    ? address.addressLocality.map(text).filter(Boolean).join(", ")
    : text(address.addressLocality);
  const parts = [locality, countryName(address), text(address.addressRegion)].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(", ") : "";
}

function locationText(posting: Json, remote: boolean): string {
  const fromPlace = addressText(object(object(posting.jobLocation).address));
  if (fromPlace) return fromPlace;

  const requirements = Array.isArray(posting.applicantLocationRequirements)
    ? posting.applicantLocationRequirements
    : [posting.applicantLocationRequirements];
  const areas = requirements.map((entry) => addressText(object(object(entry).address))).filter(Boolean);
  if (areas.length) return [...new Set(areas)].join(", ");

  // A fully remote posting that names no country still has a usable location.
  return remote ? "Remote" : "Unknown";
}

function salaryText(posting: Json): string | null {
  const salary = object(posting.baseSalary);
  const value = object(salary.value);
  const currency = text(salary.currency);
  const min = text(value.minValue);
  const max = text(value.maxValue);
  const flat = text(value.value);
  const range = min && max ? `${min}–${max}` : min || max || flat;
  if (!range) return null;
  return currency ? `${range} ${currency}` : range;
}

export function parseDjinniListing(html: string, source: string): JobInput[] {
  const blocks = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const postings: Json[] = [];

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1] ?? "");
    } catch {
      continue; // Ignore malformed metadata and keep reading the page.
    }
    for (const entry of Array.isArray(parsed) ? parsed : [parsed]) {
      const posting = object(entry);
      const type = posting["@type"];
      if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) postings.push(posting);
    }
  }

  return postings.flatMap((posting): JobInput[] => {
    const title = text(posting.title);
    const url = canonicalizeUrl(text(posting.url));
    if (!title || !url) return [];

    const description = normalizeVacancyDescription(text(posting.description));
    const company = text(object(posting.hiringOrganization).name) || "Unknown";
    const remote = text(posting.jobLocationType).toUpperCase() === "TELECOMMUTE"
      || isRemoteText(`${title}\n${description}`);
    const location = locationText(posting, remote);

    return [{
      source,
      externalId: text(posting.identifier) || url,
      title,
      company,
      location,
      remote,
      url,
      applyUrl: url,
      description,
      salaryText: salaryText(posting),
      postedAt: safeIsoDate(text(posting.datePosted)),
      contactEmail: null,
      raw: {
        discovery: "djinni-listing",
        companySource: "jsonld",
        descriptionSource: "jsonld",
        employmentType: text(posting.employmentType) || null,
        validThrough: safeIsoDate(text(posting.validThrough)),
      },
    }];
  });
}

/**
 * Collects Djinni vacancies from the listing pages' `schema.org/JobPosting`
 * metadata.
 *
 * Djinni's RSS feed carries no company and no location, so the previous RSS
 * adapter fetched a detail page per vacancy and still resolved the employer for
 * roughly one posting in a hundred. The listing page publishes the complete
 * record — employer, body, dates, salary — fifteen vacancies at a time.
 */
export class DjinniListingSource implements JobSource {
  readonly name: string;

  constructor(
    name: string,
    private readonly query: string,
  ) {
    this.name = `djinni:${name}`;
  }

  private pageUrl(page: number): string {
    const url = new URL("/jobs/", ORIGIN);
    url.searchParams.set("primary_keyword", this.query);
    if (page > 1) url.searchParams.set("page", String(page));
    return url.toString();
  }

  async collect(): Promise<JobInput[]> {
    const jobs: JobInput[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const html = await fetchText(this.pageUrl(page), { "user-agent": BROWSER_USER_AGENT });
      const batch = parseDjinniListing(html, this.name);
      let added = 0;
      for (const job of batch) {
        const key = String(job.externalId ?? job.url);
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push(job);
        added += 1;
      }
      // Djinni serves the first page again for an out-of-range page number, so
      // a batch that adds nothing new marks the end of the catalogue.
      if (batch.length === 0 || added === 0) break;
    }

    return jobs;
  }
}
