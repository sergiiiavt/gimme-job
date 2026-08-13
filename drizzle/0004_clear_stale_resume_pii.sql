-- One-off cleanup: resume_variants/application_drafts rows generated before
-- the "email only" public-contact-info decision could contain a phone number,
-- and analysis/resume output is now publicly visible (no auth gate). Clearing
-- both tables so every job regenerates clean output on the next "Adjust resume".
DELETE FROM resume_variants;
--> statement-breakpoint
DELETE FROM application_drafts;
