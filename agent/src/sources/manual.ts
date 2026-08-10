import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { JobInput } from "../domain.js";
import { canonicalizeUrl, isRemoteText } from "../utils.js";
import type { JobSource } from "./types.js";

const ManualJobSchema = z.object({
  source: z.string().default("manual"),
  externalId: z.string().nullable().default(null),
  title: z.string().min(1),
  company: z.string().default("Unknown"),
  location: z.string().default("Unknown"),
  remote: z.boolean().optional(),
  url: z.url(),
  applyUrl: z.url().optional(),
  description: z.string().default(""),
  salaryText: z.string().nullable().default(null),
  postedAt: z.string().nullable().default(null),
  contactEmail: z.string().nullable().default(null),
});

export class ManualJobSource implements JobSource {
  readonly name: string;

  constructor(private readonly filePath: string) {
    this.name = `manual:${path.basename(filePath)}`;
  }

  async collect(): Promise<JobInput[]> {
    if (!existsSync(this.filePath)) return [];
    const rawJobs = z.array(ManualJobSchema).parse(JSON.parse(readFileSync(this.filePath, "utf8")));
    return rawJobs.map((job) => ({
      source: job.source,
      externalId: job.externalId,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote ?? isRemoteText(`${job.location} ${job.description}`),
      url: canonicalizeUrl(job.url),
      applyUrl: canonicalizeUrl(job.applyUrl ?? job.url),
      description: job.description,
      salaryText: job.salaryText,
      postedAt: job.postedAt,
      contactEmail: job.contactEmail,
      raw: job,
    }));
  }
}
