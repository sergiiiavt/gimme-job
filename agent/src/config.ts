import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CandidateProfileSchema,
  SourcesConfigSchema,
  type CandidateProfile,
  type SourcesConfig,
} from "./domain.js";

export interface AppPaths {
  db: string;
  profile: string;
  sources: string;
  googleCredentials: string;
  googleToken: string;
  exports: string;
}

export function loadEnvironment(cwd = process.cwd()): void {
  const envPath = path.join(cwd, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

export function getPaths(cwd = process.cwd()): AppPaths {
  return {
    db: path.resolve(cwd, process.env.JOB_AGENT_DB ?? "./data/job-agent.db"),
    profile: path.resolve(cwd, process.env.JOB_AGENT_PROFILE ?? "./config/profile.json"),
    sources: path.resolve(cwd, process.env.JOB_AGENT_SOURCES ?? "./config/sources.json"),
    googleCredentials: path.resolve(
      cwd,
      process.env.GOOGLE_CREDENTIALS_PATH ?? "./data/google-credentials.json",
    ),
    googleToken: path.resolve(
      cwd,
      process.env.GOOGLE_TOKEN_PATH ?? "./data/google-token.json",
    ),
    exports: path.resolve(cwd, "./data/exports"),
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function loadProfile(filePath: string): CandidateProfile {
  if (!existsSync(filePath)) {
    throw new Error(`Profile not found: ${filePath}. Run \"npm run init-db\" first.`);
  }
  return CandidateProfileSchema.parse(readJson(filePath));
}

export function loadSources(filePath: string): SourcesConfig {
  if (!existsSync(filePath)) {
    throw new Error(`Sources config not found: ${filePath}. Run \"npm run init-db\" first.`);
  }
  return SourcesConfigSchema.parse(readJson(filePath));
}

export function initializeConfig(cwd = process.cwd()): AppPaths {
  const paths = getPaths(cwd);
  mkdirSync(path.dirname(paths.db), { recursive: true });
  mkdirSync(path.dirname(paths.profile), { recursive: true });
  mkdirSync(paths.exports, { recursive: true });

  if (!existsSync(paths.profile)) {
    copyFileSync(path.join(cwd, "config/profile.example.json"), paths.profile);
  }
  if (!existsSync(paths.sources)) {
    copyFileSync(path.join(cwd, "config/sources.example.json"), paths.sources);
  }

  const manualPath = path.join(cwd, "data/manual-jobs.json");
  if (!existsSync(manualPath)) {
    copyFileSync(path.join(cwd, "data/manual-jobs.example.json"), manualPath);
  }
  return paths;
}
