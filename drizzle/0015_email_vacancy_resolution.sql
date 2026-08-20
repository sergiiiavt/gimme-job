ALTER TABLE `user_email_events` ADD COLUMN `match_status` text NOT NULL DEFAULT 'PENDING';
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `match_method` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `match_confidence` real;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `match_evidence_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `resolved_at` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `status_applied_at` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `status_apply_note` text;
--> statement-breakpoint

CREATE INDEX `user_email_events_user_match_status_idx`
ON `user_email_events` (`user_id`, `match_status`, `received_at`);
--> statement-breakpoint

UPDATE `user_email_events`
SET `match_status` = 'NOT_APPLICABLE',
    `status_apply_note` = 'not_applicable'
WHERE classification IN ('JOB_ALERT', 'SERVICE_MESSAGE', 'NON_JOB', 'OTHER');
