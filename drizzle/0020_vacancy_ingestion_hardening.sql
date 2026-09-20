ALTER TABLE `jobs` ADD COLUMN `relevant` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `jobs` ADD COLUMN `display_source` text;
--> statement-breakpoint
ALTER TABLE `jobs` ADD COLUMN `dedupe_url` text;
--> statement-breakpoint
ALTER TABLE `jobs` ADD COLUMN `dedupe_company` text;
--> statement-breakpoint
ALTER TABLE `vacancy_sync_state` ADD COLUMN `sources_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE INDEX `jobs_relevant_recency_idx` ON `jobs` (`relevant`, COALESCE(`posted_at`, `discovered_at`) DESC, `discovered_at` DESC);
--> statement-breakpoint
CREATE INDEX `jobs_dedupe_url_idx` ON `jobs` (`dedupe_url`);
--> statement-breakpoint
CREATE INDEX `jobs_dedupe_company_idx` ON `jobs` (`dedupe_company`);
