CREATE TABLE `user_interview_stars` (
  `user_id` text NOT NULL,
  `question_id` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `question_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_interview_stars_user_id_idx` ON `user_interview_stars` (`user_id`);
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'testing-purpose-and-limits', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'seven-testing-principles', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'testing-principle-defect-clustering', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'testing-principle-tests-wear-out', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-levels', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'testing-types', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'static-versus-dynamic-testing', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'smoke-sanity-purpose', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'confirmation-versus-regression', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-technique-families', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'equivalence-and-boundaries', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'decision-table', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'state-transition', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'exploratory-session', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'pairwise-combinatorial-testing', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'branch-statement-coverage', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-design-from-risk', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-design-techniques-inventory', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-process-activities', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-scenario-case-suite', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-progress-completion-reports', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-plan-versus-strategy', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-plan-right-sizing', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'checklist-versus-test-case', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'traceability-useful', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-artifact-review', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'acceptance-criteria-refinement', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'testing-incomplete-requirements-time-pressure', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-estimation-techniques', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'acceptance-testing-uat-alpha-beta', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'integration-test-approaches', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'static-review-analysis-techniques', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'use-case-test-design', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'experience-based-techniques-comparison', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-plan-essential-contents', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'good-test-case-characteristics', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'testing-work-products-map', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'good-requirement-quality-characteristics', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'requirement-acceptance-criteria-business-rule', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'requirements-review-techniques', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'requirement-verification-methods', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-estimation-technique-families', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'three-point-test-estimation', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-effort-versus-duration', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-estimation-work-breakdown-hidden-work', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `user_interview_stars` (`user_id`, `question_id`, `created_at`)
SELECT `users`.`id`, 'test-reestimation-actuals-feedback', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `users`.`email` = 'sergii.iavt@gmail.com'
ON CONFLICT(`user_id`, `question_id`) DO NOTHING;
