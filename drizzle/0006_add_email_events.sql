CREATE TABLE `email_events` (
  `id` text PRIMARY KEY NOT NULL,
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
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_events_provider_message_id_unique` ON `email_events` (`provider`,`provider_message_id`);
--> statement-breakpoint
CREATE INDEX `email_events_received_at_idx` ON `email_events` (`received_at`);
--> statement-breakpoint
CREATE INDEX `email_events_classification_received_at_idx` ON `email_events` (`classification`,`received_at`);
