CREATE TABLE `user_vacancy_audit_log` (
  `id` text NOT NULL,
  `user_id` text NOT NULL,
  `job_id` text NOT NULL,
  `actor_type` text NOT NULL,
  `actor_label` text NOT NULL,
  `action` text NOT NULL,
  `field` text,
  `before_value` text,
  `after_value` text,
  `metadata_json` text NOT NULL DEFAULT '{}',
  `created_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_vacancy_audit_log_user_job_created_idx`
ON `user_vacancy_audit_log` (`user_id`, `job_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `user_vacancy_audit_log_actor_created_idx`
ON `user_vacancy_audit_log` (`actor_type`, `created_at`);
--> statement-breakpoint

CREATE TRIGGER `audit_job_tracking_insert`
AFTER INSERT ON `job_tracking`
WHEN NEW.status <> 'NEW'
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'user', 'You', 'status_changed', 'status',
    'NEW', NEW.status, '{}', COALESCE(NEW.status_updated_at, NEW.updated_at)
  );
END;
--> statement-breakpoint
CREATE TRIGGER `audit_job_tracking_update`
AFTER UPDATE OF status ON `job_tracking`
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'user', 'You', 'status_changed', 'status',
    OLD.status, NEW.status, '{}', COALESCE(NEW.status_updated_at, NEW.updated_at)
  );
END;
--> statement-breakpoint

CREATE TRIGGER `audit_user_analyses_insert`
AFTER INSERT ON `user_analyses`
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'automation', 'GimmeJob automation', 'analysis_created', 'analysis',
    NULL,
    CAST(NEW.score AS text) || '/100 · ' || NEW.verdict,
    json_object('mode', NEW.mode, 'score', NEW.score, 'verdict', NEW.verdict),
    NEW.updated_at
  );
END;
--> statement-breakpoint
CREATE TRIGGER `audit_user_analyses_update`
AFTER UPDATE OF mode, score, verdict, payload_json ON `user_analyses`
WHEN OLD.mode <> NEW.mode
  OR OLD.score <> NEW.score
  OR OLD.verdict <> NEW.verdict
  OR OLD.payload_json <> NEW.payload_json
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'automation', 'GimmeJob automation', 'analysis_regenerated', 'analysis',
    CAST(OLD.score AS text) || '/100 · ' || OLD.verdict,
    CAST(NEW.score AS text) || '/100 · ' || NEW.verdict,
    json_object('mode', NEW.mode, 'score', NEW.score, 'verdict', NEW.verdict),
    NEW.updated_at
  );
END;
--> statement-breakpoint

CREATE TRIGGER `audit_user_resume_variants_insert`
AFTER INSERT ON `user_resume_variants`
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'automation', 'GimmeJob automation', 'resume_created', 'tailored_resume',
    NULL, 'Generated tailored resume', '{}', NEW.updated_at
  );
END;
--> statement-breakpoint
CREATE TRIGGER `audit_user_resume_variants_update`
AFTER UPDATE OF markdown, pdf_base64 ON `user_resume_variants`
WHEN OLD.markdown <> NEW.markdown
  OR COALESCE(OLD.pdf_base64, '') <> COALESCE(NEW.pdf_base64, '')
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'automation', 'GimmeJob automation', 'resume_regenerated', 'tailored_resume',
    'Existing tailored resume', 'Regenerated tailored resume', '{}', NEW.updated_at
  );
END;
--> statement-breakpoint

CREATE TRIGGER `audit_user_application_drafts_insert`
AFTER INSERT ON `user_application_drafts`
WHEN NEW.status = 'PENDING_APPROVAL'
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'automation', 'GimmeJob automation', 'application_draft_created', 'application_draft',
    NULL, 'Draft prepared for approval', '{}', NEW.updated_at
  );
END;
--> statement-breakpoint
CREATE TRIGGER `audit_user_application_drafts_regenerated`
AFTER UPDATE OF recipient, subject, body, status ON `user_application_drafts`
WHEN NEW.status = 'PENDING_APPROVAL'
  AND (
    COALESCE(OLD.recipient, '') <> COALESCE(NEW.recipient, '')
    OR OLD.subject <> NEW.subject
    OR OLD.body <> NEW.body
    OR OLD.status <> NEW.status
  )
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'automation', 'GimmeJob automation', 'application_draft_regenerated', 'application_draft',
    CASE WHEN OLD.status = 'REJECTED' THEN 'Rejected draft' ELSE 'Existing draft' END,
    'Draft prepared for approval', '{}', NEW.updated_at
  );
END;
--> statement-breakpoint
CREATE TRIGGER `audit_user_application_drafts_user_status`
AFTER UPDATE OF status ON `user_application_drafts`
WHEN OLD.status <> NEW.status
  AND NEW.status IN ('APPROVED', 'REJECTED', 'SENT')
BEGIN
  INSERT INTO `user_vacancy_audit_log` (
    id, user_id, job_id, actor_type, actor_label, action, field,
    before_value, after_value, metadata_json, created_at
  ) VALUES (
    'audit_' || lower(hex(randomblob(16))), NEW.user_id, NEW.job_id,
    'user', 'You', 'application_draft_status_changed', 'application_draft_status',
    OLD.status, NEW.status, '{}', NEW.updated_at
  );
END;
