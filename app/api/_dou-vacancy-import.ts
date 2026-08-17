type Json = Record<string, unknown>;

const MAX_IMPORT_JOBS = 500;
const DOU_HOST = "jobs.dou.ua";

export function normalizeDouImportJobs(payload: unknown): Json[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }
  const jobs = (payload as Json).jobs;
  if (!Array.isArray(jobs)) throw new Error("jobs must be an array.");
  if (jobs.length > MAX_IMPORT_JOBS) throw new Error(`jobs must contain at most ${MAX_IMPORT_JOBS} vacancies.`);

  return jobs.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Job ${index + 1} must be an object.`);
    }
    const job = value as Json;
    const rawUrl = typeof job.url === "string" ? job.url.trim() : "";
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error(`Job ${index + 1} has an invalid URL.`);
    }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== DOU_HOST || !/^\/companies\/.+\/vacancies\/\d+\/?$/.test(url.pathname)) {
      throw new Error(`Job ${index + 1} is not a DOU vacancy URL.`);
    }
    url.search = "";
    url.hash = "";
    const externalId = url.pathname.match(/\/vacancies\/(\d+)\/?$/)?.[1] ?? null;
    return {
      ...job,
      source: "rss:dou-qa",
      externalId,
      url: url.toString(),
      applyUrl: url.toString(),
    };
  });
}
