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
- OAuth uses PKCE and a single-use state bound to an `HttpOnly` browser cookie; attempts expire after 10 minutes.
- Browser sessions use opaque random tokens; only a SHA-256 hash is stored in D1.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Gmail access starts with `gmail.metadata`; message bodies and attachments are not requested or stored in the first production phase.
- Gmail access is incremental: normal sign-in does not request Gmail permissions.
- The Gmail account connected in the first multi-user version must match the Google account used to sign in.
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

## Current foundation endpoints

These routes remain disabled unless `MULTI_USER_ENABLED=true` is explicitly configured:

```text
GET  /auth/google/start
GET  /auth/google/start?mode=gmail
GET  /auth/google/callback
GET  /auth/session
POST /auth/logout
```

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
