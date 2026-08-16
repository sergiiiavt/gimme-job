import type { JobInput } from "../domain.js";
import { deduplicateVacancies, filterRelevantVacancies } from "../job-intake.js";

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

export async function collectAllSources(sources: JobSource[]): Promise<SourceRunResult[]> {
  const sourceResults = await Promise.all(
    sources.map(async (source): Promise<SourceRunResult> => {
      try {
        const jobs = await source.collect();
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
