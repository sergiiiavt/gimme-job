ALTER TABLE `user_email_events` ADD COLUMN `text_excerpt` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `classification_confidence` real;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `classification_source` text;
--> statement-breakpoint
ALTER TABLE `user_email_events` ADD COLUMN `action` text;
--> statement-breakpoint
UPDATE `user_email_events`
SET
  `classification` = 'SERVICE_MESSAGE',
  `classification_confidence` = 1.0,
  `classification_source` = 'RULE',
  `action` = 'NO_ACTION',
  `summary` = COALESCE(`summary`, 'Gmail forwarding confirmation'),
  `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
  `provider` = 'email_forwarding'
  AND lower(COALESCE(`sender_email`, '')) = 'forwarding-noreply@google.com'
  AND lower(`subject`) LIKE '%forwarding confirmation%';
--> statement-breakpoint
UPDATE `user_email_events`
SET
  `classification` = 'UNCLASSIFIED',
  `classification_confidence` = NULL,
  `classification_source` = NULL,
  `action` = NULL,
  `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
  `provider` = 'email_forwarding'
  AND `classification` = 'OTHER'
  AND NOT (
    lower(COALESCE(`sender_email`, '')) = 'forwarding-noreply@google.com'
    AND lower(`subject`) LIKE '%forwarding confirmation%'
  );
