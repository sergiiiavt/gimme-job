# Multi-user Gmail architecture

## Goal

GimmeJob must support many users. Each user can connect their own Gmail account without sharing Gmail credentials or personal job-search state with other users.

## Target architecture

```text
User
  -> Google sign-in (openid/email/profile)
  -> GimmeJob user + D1 session
  -> Connect Gmail (incremental OAuth: gmail.metadata)
  -> encrypted refresh token per user
  -> Gmail API
  -> structured metadata only
  -> user-scoped email events in D1
```

n8n is optional internal orchestration. It is not the source of truth for user identity or Gmail OAuth credentials.

## Data ownership

The vacancy catalog remains shared. A vacancy is public application data and is stored once in `jobs`.

Private state is stored separately per user:

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

Every one of these tables is keyed or constrained by `user_id`. A user's job status and feedback are therefore no longer modeled as properties of the shared vacancy when multi-user mode is active.

The pre-existing single-user tables remain temporarily for the current password-protected deployment. Multi-user API paths must never fall back to those legacy private tables. They can be removed after the owner account has been migrated.

## Security rules

- Every private multi-user row is scoped by `user_id`.
- The Cloudflare Worker validates `gimmejob_user_session` against D1 before a private request reaches the application router.
- Client-supplied `x-gimmejob-auth-mode`, `x-gimmejob-authenticated`, and `x-gimmejob-user-id` headers are discarded at the Worker boundary. Only the Worker may inject tenant identity.
- Google refresh tokens are encrypted at rest with an application encryption key stored as a Cloudflare secret.
- OAuth uses PKCE and a single-use state bound to an `HttpOnly` browser cookie; attempts expire after 10 minutes.
- Browser sessions use opaque random tokens; only a SHA-256 hash is stored in D1.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Gmail access starts with `gmail.metadata`; message bodies and attachments are not requested or stored in the first production phase.
- Gmail access is incremental: normal sign-in does not request Gmail permissions.
- The Gmail account connected in the first multi-user version must match the Google account used to sign in.
- Gmail OAuth credentials are owned by GimmeJob, not n8n.
- Shared-catalog mutation cannot be performed by ordinary tenant users.
- A multi-user request must never fall back to global analysis, resume, draft, tracking, settings, progress, or email-event storage.

## Staged rollout

1. **Done:** add user/session/OAuth/Gmail-connection tables and Google OAuth helpers.
2. **Done:** add Google sign-in and Gmail connect callbacks behind a disabled-by-default multi-user flag.
3. **Done:** split the shared vacancy catalog from tenant private state and add tenant-scoped D1 storage/API access.
4. **Done:** authenticate `gimmejob_user_session` at the Worker boundary and inject a trusted `user_id`. The feature flag still remains off in production.
5. Configure the Google OAuth application/secrets and consent screen, then enable sign-in for a controlled beta.
6. Add tenant-safe analysis and resume generation. Until then those write operations fail closed in multi-user mode rather than touching legacy global tables.
7. Add Gmail metadata synchronization into `user_email_events`.
8. Add Gmail push notifications through Google Cloud Pub/Sub and renew `users.watch` daily (Gmail watches expire and must be renewed at least every 7 days).
9. Add AI classification, job matching, and approval-first reply drafting.

## Current foundation endpoints

These routes remain disabled unless `MULTI_USER_ENABLED=true` is explicitly configured:

```text
GET  /auth/google/start
GET  /auth/google/start?mode=gmail
GET  /auth/google/callback
GET  /auth/session
POST /auth/logout
```

In multi-user mode, `/workspace/login` redirects to the normal Google sign-in flow. `/workspace/logout` deletes the server-side D1 session and clears the user-session cookie.

The normal login flow requests only `openid email profile`. The Gmail connection flow separately requests `gmail.metadata` with offline access so a user can revoke Gmail access independently of normal GimmeJob sign-in.

## Google Cloud dependencies

Production activation requires:

- Gmail API enabled.
- OAuth 2.0 Web application client.
- Authorized redirect URI: `https://gimme-job.com/auth/google/callback`.
- OAuth consent screen and the verification/compliance work required by Google for Gmail restricted scopes.
- Later: Cloud Pub/Sub topic/subscription for Gmail push notifications.

## Required Worker configuration (future activation)

```text
MULTI_USER_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GMAIL_TOKEN_ENCRYPTION_KEY
```

`GMAIL_TOKEN_ENCRYPTION_KEY` must be base64-encoded 32 random bytes. Keep all real values out of source control.
