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

## Security rules

- Every private row must be scoped by `user_id` before public multi-user access is enabled.
- Google refresh tokens must be encrypted at rest with an application encryption key stored as a Cloudflare secret.
- OAuth state is single-use and expires quickly.
- Browser sessions use opaque random tokens; only a SHA-256 hash is stored in D1.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Gmail access starts with `gmail.metadata`; message bodies and attachments are not requested or stored in the first production phase.
- Gmail access is incremental: normal sign-in does not request Gmail permissions.
- Gmail OAuth credentials are owned by GimmeJob, not n8n.
- Public multi-user mode stays disabled until tenant isolation is complete for settings, progress, analyses, resumes, drafts, job tracking, and email events.

## Staged rollout

1. Add user/session/OAuth/Gmail-connection tables and Google OAuth helpers.
2. Add Google sign-in and Gmail connect callbacks behind a disabled-by-default multi-user flag.
3. Split global vacancy catalog from per-user job tracking and add `user_id` scoping to all personal tables and queries.
4. Enable multi-user sign-in for a controlled beta.
5. Add Gmail metadata synchronization.
6. Add Gmail push notifications through Google Cloud Pub/Sub and renew `users.watch` daily (Gmail watches expire and must be renewed at least every 7 days).
7. Add AI classification, job matching, and approval-first reply drafting.

## Google Cloud dependencies

Production requires:

- Gmail API enabled.
- OAuth 2.0 Web application client.
- Authorized redirect URI on `https://gimme-job.com`.
- OAuth consent screen and the verification/compliance work required by Google for Gmail restricted scopes.
- Later: Cloud Pub/Sub topic/subscription for Gmail push notifications.

## Required Worker secrets (future activation)

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
AUTH_SECRET
GMAIL_TOKEN_ENCRYPTION_KEY
```

Do not add values to source control.
