CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `google_sub` text NOT NULL,
  `email` text NOT NULL,
  `email_verified` integer DEFAULT 0 NOT NULL,
  `name` text,
  `picture_url` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_id_idx` ON `user_sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_sessions_expires_at_idx` ON `user_sessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `oauth_attempts` (
  `state_hash` text PRIMARY KEY NOT NULL,
  `mode` text NOT NULL,
  `user_id` text,
  `code_verifier` text NOT NULL,
  `next_path` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_attempts_expires_at_idx` ON `oauth_attempts` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `gmail_connections` (
  `user_id` text PRIMARY KEY NOT NULL,
  `google_sub` text NOT NULL,
  `email` text NOT NULL,
  `refresh_token_encrypted` text NOT NULL,
  `scopes` text NOT NULL,
  `token_expires_at` text,
  `history_id` text,
  `watch_expiration` text,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `connected_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gmail_connections_email_idx` ON `gmail_connections` (`email`);
--> statement-breakpoint
CREATE INDEX `gmail_connections_status_idx` ON `gmail_connections` (`status`);
