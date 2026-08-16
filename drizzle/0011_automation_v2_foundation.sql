ALTER TABLE `user_email_events` ADD COLUMN `processing_status` text NOT NULL DEFAULT 'PENDING';
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `processing_started_at` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `processing_attempts` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `next_retry_at` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `processing_error` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `classified_at` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `classifier_version` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `prompt_version` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `ai_model` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `ai_input_tokens` integer;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `ai_output_tokens` integer;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `ai_total_tokens` integer;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `ai_latency_ms` integer;
--> statement-breakpoint
CREATE INDEX `user_email_events_processing_queue_idx`
ON `user_email_events` (`classification`, `processing_status`, `next_retry_at`, `received_at`);
--> statement-breakpoint
UPDATE `user_email_events`
SET
  `processing_status` = CASE WHEN `classification` = 'UNCLASSIFIED' THEN 'PENDING' ELSE 'CLASSIFIED' END,
  `classified_at` = CASE WHEN `classification` = 'UNCLASSIFIED' THEN NULL ELSE COALESCE(`updated_at`, `created_at`) END;
--> statement-breakpoint
CREATE TABLE `email_ai_daily_usage` (
  `usage_date` text NOT NULL,
  `scope` text NOT NULL,
  `scope_key` text NOT NULL,
  `reserved_calls` integer NOT NULL DEFAULT 0,
  `completed_calls` integer NOT NULL DEFAULT 0,
  `failed_calls` integer NOT NULL DEFAULT 0,
  `input_tokens` integer NOT NULL DEFAULT 0,
  `output_tokens` integer NOT NULL DEFAULT 0,
  `total_tokens` integer NOT NULL DEFAULT 0,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`usage_date`, `scope`, `scope_key`)
);
--> statement-breakpoint
CREATE INDEX `email_ai_daily_usage_scope_date_idx`
ON `email_ai_daily_usage` (`scope`, `usage_date`);
