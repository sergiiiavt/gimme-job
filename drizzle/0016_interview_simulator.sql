CREATE TABLE `user_interview_sessions` (
  `user_id` text NOT NULL,
  `id` text NOT NULL,
  `track` text NOT NULL,
  `language` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ACTIVE',
  `question_plan_json` text NOT NULL DEFAULT '[]',
  `total_questions` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  PRIMARY KEY (`user_id`, `id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_interview_sessions_user_updated_idx`
ON `user_interview_sessions` (`user_id`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `user_interview_sessions_user_status_idx`
ON `user_interview_sessions` (`user_id`, `status`, `updated_at`);
--> statement-breakpoint

CREATE TABLE `user_interview_attempts` (
  `user_id` text NOT NULL,
  `id` text NOT NULL,
  `session_id` text NOT NULL,
  `question_id` text NOT NULL,
  `track` text NOT NULL,
  `category` text NOT NULL,
  `level` text NOT NULL,
  `answer` text NOT NULL,
  `score` integer NOT NULL,
  `rating` text NOT NULL,
  `evaluation_json` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`, `session_id`) REFERENCES `user_interview_sessions`(`user_id`, `id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_interview_attempts_user_session_question_unique`
ON `user_interview_attempts` (`user_id`, `session_id`, `question_id`);
--> statement-breakpoint
CREATE INDEX `user_interview_attempts_user_category_created_idx`
ON `user_interview_attempts` (`user_id`, `category`, `created_at`);
--> statement-breakpoint
CREATE INDEX `user_interview_attempts_user_created_idx`
ON `user_interview_attempts` (`user_id`, `created_at`);
