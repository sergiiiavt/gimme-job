ALTER TABLE `users` ADD COLUMN `password_hash` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `email_ingest_aliases` (
  `user_id` text PRIMARY KEY NOT NULL,
  `token` text NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_ingest_aliases_token_unique` ON `email_ingest_aliases` (`token`);
--> statement-breakpoint
CREATE TABLE `auth_login_limits` (
  `key` text PRIMARY KEY NOT NULL,
  `failures` integer DEFAULT 0 NOT NULL,
  `window_started_at` text NOT NULL,
  `blocked_until` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_login_limits_updated_at_idx` ON `auth_login_limits` (`updated_at`);
--> statement-breakpoint
CREATE TABLE `legacy_workspace_claims` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `user_id` text NOT NULL,
  `claimed_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
