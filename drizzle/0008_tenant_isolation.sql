CREATE TABLE `user_settings` (
  `user_id` text NOT NULL,
  `key` text NOT NULL,
  `value_json` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `key`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_settings_user_id_idx` ON `user_settings` (`user_id`);
--> statement-breakpoint
CREATE TABLE `user_interview_progress` (
  `user_id` text NOT NULL,
  `question_id` text NOT NULL,
  `status` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `question_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_interview_progress_user_id_updated_at_idx` ON `user_interview_progress` (`user_id`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `job_tracking` (
  `user_id` text NOT NULL,
  `job_id` text NOT NULL,
  `status` text DEFAULT 'NEW' NOT NULL,
  `status_updated_at` text,
  `feedback` text,
  `feedback_at` text,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `job_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_tracking_user_id_status_idx` ON `job_tracking` (`user_id`, `status`);
--> statement-breakpoint
CREATE TABLE `user_analyses` (
  `user_id` text NOT NULL,
  `job_id` text NOT NULL,
  `mode` text DEFAULT 'deterministic' NOT NULL,
  `score` integer NOT NULL,
  `verdict` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `job_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_analyses_user_id_verdict_idx` ON `user_analyses` (`user_id`, `verdict`);
--> statement-breakpoint
CREATE TABLE `user_resume_variants` (
  `user_id` text NOT NULL,
  `job_id` text NOT NULL,
  `id` text NOT NULL,
  `markdown` text NOT NULL,
  `pdf_base64` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `job_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_resume_variants_user_id_id_unique` ON `user_resume_variants` (`user_id`, `id`);
--> statement-breakpoint
CREATE TABLE `user_application_drafts` (
  `user_id` text NOT NULL,
  `job_id` text NOT NULL,
  `id` text NOT NULL,
  `recipient` text,
  `subject` text NOT NULL,
  `body` text NOT NULL,
  `status` text DEFAULT 'PENDING_APPROVAL' NOT NULL,
  `approved_at` text,
  `sent_at` text,
  `provider_message_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `job_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_application_drafts_user_id_id_unique` ON `user_application_drafts` (`user_id`, `id`);
--> statement-breakpoint
CREATE INDEX `user_application_drafts_user_id_status_idx` ON `user_application_drafts` (`user_id`, `status`);
--> statement-breakpoint
CREATE TABLE `user_email_events` (
  `id` text NOT NULL,
  `user_id` text NOT NULL,
  `provider` text DEFAULT 'gmail' NOT NULL,
  `provider_message_id` text NOT NULL,
  `thread_id` text,
  `received_at` text NOT NULL,
  `sender_name` text,
  `sender_email` text,
  `subject` text NOT NULL,
  `classification` text DEFAULT 'UNCLASSIFIED' NOT NULL,
  `summary` text,
  `company` text,
  `job_title` text,
  `recruiter_name` text,
  `job_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_events_provider_message_id_unique` ON `user_email_events` (`user_id`, `provider`, `provider_message_id`);
--> statement-breakpoint
CREATE INDEX `user_email_events_user_id_received_at_idx` ON `user_email_events` (`user_id`, `received_at`);
--> statement-breakpoint
CREATE INDEX `user_email_events_user_id_classification_received_at_idx` ON `user_email_events` (`user_id`, `classification`, `received_at`);
