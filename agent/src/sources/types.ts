import type { JobInput } from "../domain.js";
import { deduplicateVacancies, filterRelevantVacancies } from "../job-intake.js";
import { normalizeVacancyDescription } from "../vacancy-content.js";
import { recoverJobCompany } from "./company.js";

export interface JobSource {
  readonly name: string;
  collect(): Promise<JobInput[]>;
}

export interface SourceRunResult {
  source: string;
  jobs: JobInput[];
  error: string | null;
  seen?: number;
  rejected?: number;
  duplicates?: number;
}

function normalizeCollectedJob(job: JobInput): JobInput {
  return {
    ...job,
    title: job.title.trim(),
    company: job.company.trim() || "Unknown",
    location: job.location.trim() || "Unknown",
    description: normalizeVacancyDescription(job.description),
  };
}

async function recoverMissingCompanies(jobs: JobInput[]): Promise<JobInput[]> {
  const recovered: JobInput[] = [];
  const batchSize = 6;
  for (let index = 0; index < jobs.length; index += batchSize) {
    const batch = jobs.slice(index, index + batchSize);
    recovered.push(...await Promise.all(batch.map(recoverJobCompany)));
  }
  return recovered;
}

export async function collectAllSources(sources: JobSource[]): Promise<SourceRunResult[]> {
  const sourceResults = await Promise.all(
    sources.map(async (source): Promise<SourceRunResult> => {
      try {
        const normalized = (await source.collect()).map(normalizeCollectedJob);
        const jobs = await recoverMissingCompanies(normalized);
        return { source: source.name, jobs, error: null, seen: jobs.length };
      } catch (error) {
        return {
          source: source.name,
          jobs: [],
          error: error instanceof Error ? error.message : String(error),
          seen: 0,
        };
      }
    }),
  );

  const successful = sourceResults.filter((result) => result.error === null);
  const collected = successful.flatMap((result) => result.jobs);
  const relevance = filterRelevantVacancies(collected);
  const deduplicated = deduplicateVacancies(relevance.jobs);
  const failures = sourceResults.filter((result) => result.error !== null);

  if (successful.length === 0) return failures;

  return [
    ...failures,
    {
      source: "intake",
      jobs: deduplicated.jobs,
      error: null,
      seen: collected.length,
      rejected: relevance.rejected.length,
      duplicates: deduplicated.duplicateCount,
    },
  ];
}
