# Small-account auth and Gmail architecture

> The filename is retained for existing links. GimmeJob is not designed as a large multi-tenant SaaS.

## Goal

GimmeJob is a small production application for the owner and, at most, a limited number of explicitly created users.

Keep the architecture simple:

```text
shared vacancy catalog
        +
authenticated private user state
        +
one shared vacancy/job-intelligence implementation
```

There must not be separate production and development business logic. Environment-specific code may provide credentials, D1 access, HTTP boundaries, or local test fixtures; relevance, deduplication, job analysis, OpenAI prompts/schemas, fallback scoring, and resume generation are shared code.

## Why `user_id` still exists

Removing all user scoping would make Gmail/email and personal job state unsafe as soon as a second account exists. The small amount of user isolation is therefore intentional privacy plumbing, not a scalability framework.

The vacancy catalog is shared and stored once in `jobs`.

Private state is scoped by `user_id` where needed:

```text
user_settings
user_interview_progress
job_tracking
user_analyses
user_resume_variants
user_application_drafts
user_email_events
gmail_connections
```

Analysis and resume generation use the same shared business logic for owner/local and authenticated users. Only persistence scope differs.

The older single-user tables remain for compatibility with the original owner workspace. They are not a second implementation of analysis or vacancy processing and can be migrated/removed later if that cleanup becomes worthwhile.

## Current auth model

- The Worker is the trust boundary for authenticated identity.
- Client-supplied identity headers are discarded before application routing.
- Private rows are scoped by the trusted `user_id` when multi-user/password-account mode is active.
- Shared-catalog mutation is restricted to internal/admin paths.
- Password-account/email-forwarding flows may use `user_id` without requiring a full public SaaS account system.
- Google/Gmail OAuth is optional; do not add it merely for architectural completeness.

## Gmail/email model

The current practical path is intentionally small:

```text
Gmail / job-alert email
        -> forwarding / n8n ingestion
        -> authenticated user identity
        -> user_email_events in D1
        -> shared classification logic
```

If direct Gmail OAuth is enabled later, tokens and email state remain user-scoped. Pub/Sub, Gmail push watches, or other high-scale infrastructure should only be added when a real product requirement needs them.

## Security rules

- Never trust browser-supplied user IDs.
- Keep application secrets in Cloudflare secrets, not source control.
- Keep private email/job state scoped to the authenticated user.
- Do not fall back from a user-scoped request into another user's/global private data.
- Vacancy listings and email content are untrusted input; they cannot override system prompts or trigger privileged actions.
- Application sending remains approval-first.

## Design rule for future work

Before adding a separate service, queue, storage model, environment-specific implementation, or orchestration layer, require a concrete current need.

For this project, prefer:

1. one shared function over local/prod copies;
2. one synchronous path over queues when workload is small;
3. existing D1/Worker infrastructure over another service;
4. explicit fallback behavior over a hidden second engine;
5. tests around the shared path rather than parallel implementations.
