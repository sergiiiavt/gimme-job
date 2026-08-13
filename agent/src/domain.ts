import { z } from "zod";

export const ExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  period: z.string(),
  achievements: z.array(z.string()),
});

export const CandidateProfileSchema = z.object({
  name: z.string(),
  headline: z.string(),
  summary: z.string(),
  targetRoles: z.array(z.string()).min(1),
  locations: z.array(z.string()),
  languages: z.array(z.string()),
  skills: z.array(z.string()),
  mustHaveSignals: z.array(z.string()),
  preferredSignals: z.array(z.string()),
  excludedSignals: z.array(z.string()),
  facts: z.array(z.string()),
  experience: z.array(ExperienceSchema),
  education: z.array(z.string()),
  links: z.array(z.string()),
  contact: z.object({
    email: z.string(),
    phone: z.string(),
    location: z.string(),
  }),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const RssSourceSchema = z.object({
  name: z.string(),
  url: z.url(),
});

export const BoardSourceSchema = z.object({
  name: z.string(),
  board: z.string(),
});

export const QuerySourceSchema = z.object({
  name: z.string(),
  query: z.string(),
});

export const SourcesConfigSchema = z.object({
  rss: z.array(RssSourceSchema).default([]),
  greenhouse: z.array(BoardSourceSchema).default([]),
  lever: z.array(BoardSourceSchema).default([]),
  ashby: z.array(BoardSourceSchema).default([]),
  workUa: z.array(QuerySourceSchema).default([]),
  lobbyX: z.array(QuerySourceSchema).default([]),
  gmail: z.object({
    enabled: z.boolean().default(false),
    query: z.string().default("label:JobAlerts newer_than:14d"),
    maxResults: z.number().int().positive().max(500).default(100),
    allowedSendDomains: z.array(z.string()).default([]),
  }),
  manualFiles: z.array(z.string()).default([]),
});

export type SourcesConfig = z.infer<typeof SourcesConfigSchema>;

export type JobStatus = "NEW" | "REVIEWED" | "ARCHIVED";

export const JobPipelineStatusSchema = z.enum([
  "NEW",
  "INTERESTED",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "NOT_INTERESTED",
  "ARCHIVED",
]);
export const JobFeedbackSchema = z.enum(["RELEVANT", "NOT_RELEVANT"]);
export const JobTrackingUpdateSchema = z.object({
  status: JobPipelineStatusSchema.optional(),
  feedback: JobFeedbackSchema.nullable().optional(),
}).refine(
  (value) => value.status !== undefined || value.feedback !== undefined,
  "Provide status or feedback.",
);

export type JobPipelineStatus = z.infer<typeof JobPipelineStatusSchema>;
export type JobFeedback = z.infer<typeof JobFeedbackSchema>;
export type JobTrackingUpdate = z.infer<typeof JobTrackingUpdateSchema>;

export interface JobTrackingRecord {
  jobId: string;
  status: JobPipelineStatus;
  statusUpdatedAt: string | null;
  feedback: JobFeedback | null;
  feedbackAt: string | null;
  updatedAt: string;
}

export interface JobInput {
  source: string;
  externalId: string | null;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  applyUrl: string;
  description: string;
  salaryText: string | null;
  postedAt: string | null;
  contactEmail: string | null;
  raw: unknown;
}

export interface StoredJob extends JobInput {
  id: string;
  fingerprint: string;
  discoveredAt: string;
  updatedAt: string;
  status: JobStatus;
}

export const JobAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["strong", "possible", "weak", "reject"]),
  roleFit: z.string(),
  matchingSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  hardBlockers: z.array(z.string()),
  evidence: z.array(z.string()),
  requirements: z.array(z.string()),
  requirementKeywords: z.array(z.string()),
  marketSignals: z.object({
    seniority: z.string(),
    employmentType: z.string(),
    remotePolicy: z.string(),
    salary: z.string(),
    reservation: z.string(),
    language: z.string(),
  }),
  recommendation: z.string(),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export const TailoredResumeSchema = z.object({
  markdown: z.string(),
  changes: z.array(z.string()),
  truthWarnings: z.array(z.string()),
});

export const ApplicationDraftSchema = z.object({
  channel: z.enum(["email", "form"]),
  recipientGuess: z.string().nullable(),
  subject: z.string(),
  body: z.string(),
});

export const JobPackageSchema = z.object({
  analysis: JobAnalysisSchema,
  tailoredResume: TailoredResumeSchema,
  applicationDraft: ApplicationDraftSchema,
});

export type JobPackage = z.infer<typeof JobPackageSchema>;

export type DraftStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SENT";

export interface ApplicationDraftRecord {
  id: string;
  jobId: string;
  recipient: string | null;
  subject: string;
  body: string;
  status: DraftStatus;
  approvedAt: string | null;
  sentAt: string | null;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketRow {
  job: StoredJob;
  analysis: JobAnalysis | null;
}

export interface MarketReport {
  generatedAt: string;
  totalJobs: number;
  analyzedJobs: number;
  remoteShare: number;
  salaryDisclosureShare: number;
  reservationMentions: number;
  topSources: Array<{ name: string; count: number }>;
  topRoles: Array<{ name: string; count: number }>;
  topLocations: Array<{ name: string; count: number }>;
  topRequirements: Array<{ name: string; count: number }>;
  topCandidateGaps: Array<{ name: string; count: number }>;
  verdicts: Record<string, number>;
  trendComparison: {
    previousGeneratedAt: string | null;
    remoteShareDelta: number | null;
    salaryDisclosureShareDelta: number | null;
    requirementDeltas: Array<{
      name: string;
      current: number;
      previous: number;
      delta: number;
    }>;
  };
}
