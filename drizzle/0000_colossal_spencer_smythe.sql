CREATE TABLE `analyses` (
	`job_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'deterministic' NOT NULL,
	`score` integer NOT NULL,
	`verdict` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `application_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`recipient` text,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'PENDING_APPROVAL' NOT NULL,
	`approved_at` text,
	`sent_at` text,
	`provider_message_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_drafts_job_id_unique` ON `application_drafts` (`job_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`location` text NOT NULL,
	`remote` integer DEFAULT 0 NOT NULL,
	`url` text NOT NULL,
	`apply_url` text NOT NULL,
	`description` text NOT NULL,
	`salary_text` text,
	`posted_at` text,
	`contact_email` text,
	`discovered_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`raw_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_fingerprint_unique` ON `jobs` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `resume_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`markdown` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resume_variants_job_id_unique` ON `resume_variants` (`job_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
