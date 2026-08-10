import type { JobInput } from "../domain.js";

export interface JobSource {
  readonly name: string;
  collect(): Promise<JobInput[]>;
}

export interface SourceRunResult {
  source: string;
  jobs: JobInput[];
  error: string | null;
}

export async function collectAllSources(sources: JobSource[]): Promise<SourceRunResult[]> {
  return Promise.all(
    sources.map(async (source) => {
      try {
        return { source: source.name, jobs: await source.collect(), error: null };
      } catch (error) {
        return {
          source: source.name,
          jobs: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
