import type { JobInput } from "../domain.js";
import {
  canonicalizeUrl,
  isRemoteText,
  safeIsoDate,
  stripHtml,
} from "../utils.js";
import { fetchJson } from "./http.js";
import type { JobSource } from "./types.js";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return typeof value === "object" && value !== null ? (value as JsonObject) : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

export class GreenhouseSource implements JobSource {
  readonly name: string;

  constructor(
    private readonly company: string,
    private readonly board: string,
  ) {
    this.name = `greenhouse:${company}`;
  }

  async collect(): Promise<JobInput[]> {
    const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(this.board)}/jobs?content=true`;
    const response = await fetchJson<{ jobs?: unknown[] }>(endpoint);
    return (response.jobs ?? []).map((raw): JobInput => {
      const job = object(raw);
      const location = text(object(job.location).name) || "Unknown";
      const description = stripHtml(text(job.content));
      const url = canonicalizeUrl(text(job.absolute_url));
      return {
        source: this.name,
        externalId: text(job.id) || url,
        title: text(job.title) || text(job.name) || "Untitled role",
        company: this.company,
        location,
        remote: isRemoteText(`${location} ${description}`),
        url,
        applyUrl: url,
        description,
        salaryText: null,
        postedAt: safeIsoDate(job.updated_at),
        contactEmail: null,
        raw,
      };
    });
  }
}
export class LeverSource implements JobSource {
  readonly name: string;

  constructor(
    private readonly company: string,
    private readonly board: string,
  ) {
    this.name = `lever:${company}`;
  }

  async collect(): Promise<JobInput[]> {
    const endpoint = `https://api.lever.co/v0/postings/${encodeURIComponent(this.board)}?mode=json`;
    const response = await fetchJson<unknown[]>(endpoint);
    return response.map((raw): JobInput => {
      const job = object(raw);
      const categories = object(job.categories);
      const location = text(categories.location) || "Unknown";
      const description =
        text(job.descriptionPlain) || stripHtml(text(job.description)) || stripHtml(text(job.lists));
      const url = canonicalizeUrl(text(job.hostedUrl));
      const applyUrl = canonicalizeUrl(text(job.applyUrl) || url);
      return {
        source: this.name,
        externalId: text(job.id) || url,
        title: text(job.text) || "Untitled role",
        company: this.company,
        location,
        remote:
          text(job.workplaceType).toLowerCase() === "remote" ||
          isRemoteText(`${location} ${description}`),
        url,
        applyUrl,
        description,
        salaryText: text(job.salaryRange) || null,
        postedAt: safeIsoDate(job.createdAt),
        contactEmail: null,
        raw,
      };
    });
  }
}

export class AshbySource implements JobSource {
  readonly name: string;

  constructor(
    private readonly company: string,
    private readonly board: string,
  ) {
    this.name = `ashby:${company}`;
  }

  async collect(): Promise<JobInput[]> {
    const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(this.board)}?includeCompensation=true`;
    const response = await fetchJson<{ jobs?: unknown[] }>(endpoint);
    return (response.jobs ?? []).map((raw): JobInput => {
      const job = object(raw);
      const secondary = Array.isArray(job.secondaryLocations)
        ? job.secondaryLocations.map((entry) => text(object(entry).location)).filter(Boolean)
        : stringList(job.secondaryLocations);
      const location = [text(job.location), ...secondary].filter(Boolean).join(", ") || "Unknown";
      const description = text(job.descriptionPlain) || stripHtml(text(job.descriptionHtml));
      const url = canonicalizeUrl(text(job.jobUrl));
      return {
        source: this.name,
        externalId: text(job.id) || url,
        title: text(job.title) || "Untitled role",
        company: this.company,
        location,
        remote: Boolean(job.isRemote) || isRemoteText(`${location} ${description}`),
        url,
        applyUrl: canonicalizeUrl(text(job.applyUrl) || url),
        description,
        salaryText: text(job.compensation) || null,
        postedAt: safeIsoDate(job.publishedAt),
        contactEmail: null,
        raw,
      };
    });
  }
}
