# Password accounts + personal email forwarding

## Product model

GimmeJob no longer requires Google as the account identity provider.

```text
Anonymous visitor
  -> public site

Email + password
  -> D1 user
  -> opaque HttpOnly session
  -> personal workspace
  -> private tenant-scoped data
```

Direct Gmail OAuth remains optional/experimental and is not required for normal registration or sign-in.

## Password storage

- Passwords are never stored or encrypted as plaintext.
- New passwords are hashed with PBKDF2-HMAC-SHA256.
- Every password gets a random 16-byte salt.
- The encoded hash stores the algorithm, iteration count, salt and derived value.
- Login failures are throttled in D1 by email + Cloudflare client IP hash.
- Sessions remain opaque random values; only SHA-256 session-token hashes are stored in D1.

## Existing owner migration

The original single-user private workspace is preserved.

On account creation there is an optional `Existing private-site password` field. If the current legacy `APP_PASSWORD` is supplied, GimmeJob atomically copies the old personal state into that new user:

- settings
- interview progress
- job tracking/status/feedback
- analyses
- resume variants
- application drafts
- email events

Only one account can claim the legacy workspace.

## Recommended email integration

Every authenticated user receives a private address:

```text
jobs+<random-token>@gimme-job.com
```

The user can create a Gmail rule that forwards only job-related messages to that address.

```text
User Gmail
  -> Gmail filter / forwarding
  -> jobs+TOKEN@gimme-job.com
  -> Cloudflare Email Routing
  -> GimmeJob Worker email() handler
  -> resolve TOKEN -> user_id
  -> user_email_events in D1
```

The Worker intentionally reads only envelope/header metadata used by the current product:

- recipient alias
- sender address
- subject
- Date
- Message-ID
- raw message size

The raw MIME stream/body and attachments are not read or persisted.

## One-time Cloudflare Email Routing setup

For `gimme-job.com`:

1. Cloudflare Dashboard -> Compute -> Email Service -> Email Routing.
2. Onboard `gimme-job.com` if Email Routing is not already enabled.
3. Enable **Subaddressing** in Email Routing settings.
4. Create a routing rule for `jobs@gimme-job.com`.
5. Action: **Send to a Worker**.
6. Worker: `gimmejob`.
7. Save and enable the rule.

With subaddressing enabled, mail sent to `jobs+TOKEN@gimme-job.com` matches the single `jobs@gimme-job.com` rule while the full recipient remains available to the Worker for tenant resolution.

Do not create one Cloudflare routing rule per user.

## Gmail filter example

A user may forward only recruitment traffic, for example messages from selected job sites/recruiters. The exact filter is user-owned and can be changed without giving GimmeJob access to the rest of the mailbox.

## Future direct Gmail OAuth

The existing Google/Gmail OAuth foundation may be re-enabled later for users who want direct Gmail API synchronization. It is deliberately not part of account authentication and should remain optional until there is a product reason to take on Google restricted-scope verification/security-assessment overhead.
