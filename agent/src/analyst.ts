import type {
  CandidateProfile,
  JobAnalysis,
  ResumePackage,
  StoredJob,
} from "./domain.js";
import {
  adjustResumeWithOpenAi,
  analyzeJobWithOpenAi,
  deterministicAnalysis,
  deterministicResumePackage,
} from "./job-intelligence.js";

export { deterministicAnalysis, deterministicResumePackage };

function openAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-5.6",
  };
}

export async function analyzeJob(
  job: StoredJob,
  profile: CandidateProfile,
  model = process.env.OPENAI_MODEL ?? "gpt-5.6",
): Promise<{ analysis: JobAnalysis; mode: "agent" | "deterministic" }> {
  const config = openAiConfig();
  return analyzeJobWithOpenAi(job, profile, {
    ...config,
    model,
    onFallback: (error) => {
      console.error(
        `OpenAI analysis failed for ${job.id}, falling back to deterministic scoring: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });
}

export async function adjustResume(
  job: StoredJob,
  profile: CandidateProfile,
  model = process.env.OPENAI_MODEL ?? "gpt-5.6",
): Promise<{ pkg: ResumePackage; mode: "agent" | "deterministic" }> {
  const config = openAiConfig();
  return adjustResumeWithOpenAi(job, profile, {
    ...config,
    model,
    onFallback: (error) => {
      console.error(
        `OpenAI resume adjustment failed for ${job.id}, falling back to the deterministic template: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });
}
