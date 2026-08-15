import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const interviewProgress = sqliteTable("interview_progress", {
  questionId: text("question_id").primaryKey(),
  status: text("status").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  source: text("source").notNull(),
  externalId: text("external_id"),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  remote: integer("remote").notNull().default(0),
  url: text("url").notNull(),
  applyUrl: text("apply_url").notNull(),
  description: text("description").notNull(),
  salaryText: text("salary_text"),
  postedAt: text("posted_at"),
  contactEmail: text("contact_email"),
  discoveredAt: text("discovered_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  status: text("status").notNull().default("NEW"),
  statusUpdatedAt: text("status_updated_at"),
  feedback: text("feedback"),
  feedbackAt: text("feedback_at"),
  rawJson: text("raw_json").notNull().default("{}"),
});

export const analyses = sqliteTable("analyses", {
  jobId: text("job_id").primaryKey(),
  mode: text("mode").notNull().default("deterministic"),
  score: integer("score").notNull(),
  verdict: text("verdict").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const resumeVariants = sqliteTable("resume_variants", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  markdown: text("markdown").notNull(),
  pdfBase64: text("pdf_base64"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const applicationDrafts = sqliteTable("application_drafts", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  recipient: text("recipient"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("PENDING_APPROVAL"),
  approvedAt: text("approved_at"),
  sentAt: text("sent_at"),
  providerMessageId: text("provider_message_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const emailEvents = sqliteTable("email_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("gmail"),
  providerMessageId: text("provider_message_id").notNull(),
  threadId: text("thread_id"),
  receivedAt: text("received_at").notNull(),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  subject: text("subject").notNull(),
  classification: text("classification").notNull().default("UNCLASSIFIED"),
  summary: text("summary"),
  company: text("company"),
  jobTitle: text("job_title"),
  recruiterName: text("recruiter_name"),
  jobId: text("job_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("email_events_provider_message_id_unique").on(table.provider, table.providerMessageId),
  index("email_events_received_at_idx").on(table.receivedAt),
  index("email_events_classification_received_at_idx").on(table.classification, table.receivedAt),
]);

export const observabilityEvents = sqliteTable("observability_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  event: text("event").notNull(),
  status: text("status").notNull(),
  occurredAt: text("occurred_at").notNull(),
  source: text("source"),
  mode: text("mode"),
  durationMs: integer("duration_ms"),
  itemsSeen: integer("items_seen"),
  itemsProcessed: integer("items_processed"),
  errorCount: integer("error_count").notNull().default(0),
  reasonCode: text("reason_code"),
  httpStatus: integer("http_status"),
}, (table) => [
  index("observability_events_occurred_at_idx").on(table.occurredAt),
  index("observability_events_event_occurred_at_idx").on(table.event, table.occurredAt),
]);

export const observabilitySnapshots = sqliteTable("observability_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  occurredAt: text("occurred_at").notNull(),
  totalJobs: integer("total_jobs").notNull(),
  remoteJobs: integer("remote_jobs").notNull(),
  reservationJobs: integer("reservation_jobs").notNull(),
  analyzedJobs: integer("analyzed_jobs").notNull(),
  strongJobs: integer("strong_jobs").notNull(),
  possibleJobs: integer("possible_jobs").notNull(),
  weakJobs: integer("weak_jobs").notNull(),
  rejectedJobs: integer("rejected_jobs").notNull(),
}, (table) => [
  index("observability_snapshots_occurred_at_idx").on(table.occurredAt),
]);
