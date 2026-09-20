CREATE TABLE `vacancy_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'IDLE' NOT NULL,
	`trigger` text,
	`started_at` text,
	`completed_at` text,
	`seen` integer DEFAULT 0 NOT NULL,
	`inserted` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`error` text,
	`catalog_version` text
);
--> statement-breakpoint
CREATE INDEX `jobs_recency_idx` ON `jobs` (COALESCE(`posted_at`, `discovered_at`) DESC, `discovered_at` DESC);--> statement-breakpoint
CREATE INDEX `jobs_updated_at_idx` ON `jobs` (`updated_at` DESC);
