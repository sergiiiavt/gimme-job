CREATE TABLE `observability_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` text NOT NULL,
	`source` text,
	`mode` text,
	`duration_ms` integer,
	`items_seen` integer,
	`items_processed` integer,
	`error_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observability_events_occurred_at_idx` ON `observability_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `observability_events_event_occurred_at_idx` ON `observability_events` (`event`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `observability_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` text NOT NULL,
	`total_jobs` integer NOT NULL,
	`remote_jobs` integer NOT NULL,
	`reservation_jobs` integer NOT NULL,
	`analyzed_jobs` integer NOT NULL,
	`strong_jobs` integer NOT NULL,
	`possible_jobs` integer NOT NULL,
	`weak_jobs` integer NOT NULL,
	`rejected_jobs` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observability_snapshots_occurred_at_idx` ON `observability_snapshots` (`occurred_at`);