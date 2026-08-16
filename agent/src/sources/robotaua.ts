import type { JobInput } from "../domain.js";
import {
  extractJobPostingMetadata,
  htmlToVacancyText,
  normalizeVacancyDescription,
} from "../vacancy-content.js";
import { isRemoteText, safeIsoDate } from "../utils.js";
import { fetchJson, fetchText } from "./http.js";
import type { JobSource } from "./types.js";

const API_URL = "https://api.rabota.ua/vacancy/search";
const PUBLIC_URL = "https://robota.ua";
const PAGE_SIZE = 50;
const MAX_PAGES = 3;
const MAX_DETAIL_FETCHES = 50;

interface RobotaUaDocument {
  id?: string | number;
  notebookId?: string | number;
  name?: string;
  companyName?: string;
  cityName?: string;
  date?: string;
  shortDescription?: string;
  description?: string;
  salary?: string | number;
  salaryFrom?: string | number;
  salaryTo?: string | number;
  salaryComment?: string;
}

interface RobotaUaResponse {
  total?: number;
  documents?: RobotaUaDocument[];
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function salaryText(document: RobotaUaDocument): string | null {
  const comment = text(document.salaryComment);
  if (comment) return comment;
  const from = text(document.salaryFrom);
  const to = text(document.salaryTo);
  if (from && to) return `${from}–${to}`;
  if (from) return `from ${from}`;
  if (to) return `up to ${to}`;
  const salary = text(document.salary);
  return salary && salary !== "0" ? salary : null;
}

function vacancyUrl(document: RobotaUaDocument): string | null {
  const id = text(document.id);
  const notebookId = text(document.notebookId);
  if (!id || !notebookId) return null;
  return `${PUBLIC_URL}/company${encodeURIComponent(notebookId)}/vacancy${encodeURIComponent(id)}`;
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

export function parseRobotaUaDescription(html: string, fallback = ""): string {
  const jobPosting = extractJobPostingMetadata(html);
  if (jobPosting?.description) {
    const description = normalizeVacancyDescription(jobPosting.description);
    if (description) return description;
  }

  const candidates = [...html.matchAll(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
    .map((match) => decodeJsonString(match[1] ?? ""))
    .map((value) => normalizeVacancyDescription(htmlToVacancyText(value)))
    .filter((value) => value.length >= 100)
    .sort((left, right) => right.length - left.length);
  return candidates[0] || normalizeVacancyDescription(fallback);
}

export function parseRobotaUaResponse(payload: unknown, sourceName = "robotaua-qa"): JobInput[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const response = payload as RobotaUaResponse;
  const documents = Array.isArray(response.documents) ? response.documents : [];

  return documents.flatMap((document): JobInput[] => {
    const url = vacancyUrl(document);
    const title = text(document.name);
    if (!url || !title) return [];
    const description = normalizeVacancyDescription(text(document.description) || text(document.shortDescription));
    const company = text(document.companyName) || "Unknown";
    const location = text(document.cityName) || "Unknown";
    const combined = `${title}\n${description}\n${location}`;

    return [{
      source: `robotaua:${sourceName}`,
      externalId: text(document.id) || null,
      title,
      company,
      location,
      remote: isRemoteText(combined),
      url,
      applyUrl: url,
      description,
      salaryText: salaryText(document),
      postedAt: safeIsoDate(document.date) ?? null,
      contactEmail: null,
      raw: document,
    }];
  });
}

export class RobotaUaSource implements JobSource {
  readonly name: string;

  constructor(
    name: string,
    private readonly query: string,
  ) {
    this.name = `robotaua:${name}`;
  }

  async collect(): Promise<JobInput[]> {
    const jobs: JobInput[] = [];
    let total = Number.POSITIVE_INFINITY;

    for (let page = 0; page < MAX_PAGES && jobs.length < total; page += 1) {
      const url = `${API_URL}?keyWords=${encodeURIComponent(this.query)}&count=${PAGE_SIZE}&page=${page}`;
      const payload = await fetchJson<RobotaUaResponse>(url);
      const pageJobs = parseRobotaUaResponse(payload, this.name.replace(/^robotaua:/, ""));
      jobs.push(...pageJobs);
      total = typeof payload.total === "number" && payload.total >= 0 ? payload.total : jobs.length;
      if (pageJobs.length === 0) break;
    }

    return Promise.all(jobs.map(async (job, index) => {
      if (index >= MAX_DETAIL_FETCHES) return job;
      try {
        const description = parseRobotaUaDescription(await fetchText(job.url), job.description);
        if (description.length > job.description.length) {
          return {
            ...job,
            description,
            remote: job.remote || isRemoteText(`${job.title}\n${description}\n${job.location}`),
          };
        }
      } catch {
        // Search API data remains usable if an individual detail request fails.
      }
      return job;
    }));
  }
}
