import path from "node:path";
import type { AppPaths } from "../config.js";
import type { SourcesConfig } from "../domain.js";
import { authorizeGmail, GmailJobSource } from "../gmail.js";
import { AshbySource, GreenhouseSource, LeverSource } from "./ats.js";
import { LobbyXSource } from "./lobbyx.js";
import { ManualJobSource } from "./manual.js";
import { RobotaUaSource } from "./robotaua.js";
import { RssJobSource } from "./rss.js";
import type { JobSource } from "./types.js";
import { WorkUaSource } from "./workua.js";

export async function buildSources(
  config: SourcesConfig,
  paths: AppPaths,
  cwd = process.cwd(),
  options: { manualOnly?: boolean } = {},
): Promise<JobSource[]> {
  const manualSources = config.manualFiles.map(
    (file) => new ManualJobSource(path.resolve(cwd, file)),
  );
  if (options.manualOnly) return manualSources;

  const sources: JobSource[] = [
    ...config.rss.map((entry) => new RssJobSource(entry.name, entry.url)),
    ...config.greenhouse.map((entry) => new GreenhouseSource(entry.name, entry.board)),
    ...config.lever.map((entry) => new LeverSource(entry.name, entry.board)),
    ...config.ashby.map((entry) => new AshbySource(entry.name, entry.board)),
    ...config.workUa.map((entry) => new WorkUaSource(entry.name, entry.query)),
    ...config.robotaUa.map((entry) => new RobotaUaSource(entry.name, entry.query)),
    ...config.lobbyX.map((entry) => new LobbyXSource(entry.name, entry.query)),
    ...manualSources,
  ];

  if (config.gmail.enabled) {
    const auth = await authorizeGmail(paths.googleCredentials, paths.googleToken);
    sources.push(new GmailJobSource(auth, config.gmail.query, config.gmail.maxResults));
  }
  return sources;
}
