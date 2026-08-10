import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
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
