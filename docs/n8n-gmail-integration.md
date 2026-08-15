# n8n Gmail integration

## Scope

Phase 1-2 only:

```text
Gmail -> n8n -> GimmeJob ingest endpoint -> D1 email_events
```

This integration does **not** send, reply to, delete, archive, or relabel email. It also does not store the raw email body in GimmeJob.

## Production runtime

The production-ready self-hosted runtime and importable workflow are kept in:

```text
ops/n8n/
```

Use:

- `ops/n8n/README.md` for VM, Docker, Cloudflare Tunnel, Gmail OAuth, and activation instructions.
- `ops/n8n/docker-compose.yml` for the pinned n8n + Postgres + cloudflared stack.
- `ops/n8n/workflows/gimmejob-gmail-ingest.json` for the credential-free workflow import.

The runtime keeps Postgres and n8n's port 5678 private inside the Docker network. Cloudflare Tunnel is the only public ingress path.

## Security boundary

- Gmail OAuth credentials stay in n8n.
- GimmeJob never receives the Gmail OAuth access/refresh token.
- n8n receives no D1 credentials.
- n8n can call only the dedicated ingest endpoint with `N8N_INGEST_TOKEN`.
- `N8N_INGEST_TOKEN` is stored as a GitHub repository secret and deployed as a Cloudflare Worker secret.
- The same token is stored in n8n as a Bearer Auth credential; it is not committed in workflow JSON.
- Use a randomly generated token of at least 32 characters; 32 random bytes encoded as hex/base64 is preferred.
- Rotate the token if an n8n credential/workflow export is exposed.

## GimmeJob endpoint

Production endpoint:

```text
POST https://gimme-job.com/internal/n8n/email-events
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

The workers.dev domain can also be used if the custom domain is unavailable:

```text
POST https://gimmejob.gimmejob.workers.dev/internal/n8n/email-events
```

Example request:

```json
{
  "providerMessageId": "18fabc123",
  "threadId": "18fabc000",
  "receivedAt": "2026-08-15T12:30:00Z",
  "senderName": "Jane Recruiter",
  "senderEmail": "jane@example.com",
  "subject": "Senior QA Engineer",
  "classification": "UNCLASSIFIED"
}
```

Allowed classifications:

```text
UNCLASSIFIED
RECRUITER
INTERVIEW
REJECTION
TEST_TASK
OFFER
OTHER
```

For Phase 1-2 use `UNCLASSIFIED`. AI classification belongs to Phase 3+.

The endpoint intentionally rejects common raw-content fields such as `body`, `text`, `html`, `raw`, and `snippet`.

Repeated delivery of the same Gmail message is safe. The ID is derived from the Gmail message ID and the endpoint performs an upsert.

## n8n workflow

Import the ready workflow:

```text
ops/n8n/workflows/gimmejob-gmail-ingest.json
```

Workflow name:

```text
GimmeJob - Gmail ingest
```

It imports inactive and without credentials.

### 1. Gmail Trigger

Use the built-in **Gmail Trigger** with the Gmail account intended for job-search mail. Poll for new messages. Start without Spam/Trash and without any send/reply operation.

The committed workflow starts with `newer_than:2d` as a deliberately narrow first-test search. Replace it with a recruiter/job-search query after verification, or remove it only if all incoming mail should be ingested.

### 2. Edit Fields

The **Keep GimmeJob metadata only** node constructs only the metadata accepted by GimmeJob:

- `providerMessageId` <- Gmail message ID
- `threadId` <- Gmail thread ID when available
- `receivedAt` <- Gmail internal received timestamp
- `senderName` <- parsed From name when available
- `senderEmail` <- parsed From email when available
- `subject` <- Subject
- `classification` <- literal `UNCLASSIFIED`

All other Gmail Trigger fields are dropped before the HTTP request. Do not add message body, HTML, plaintext content, raw MIME, attachments, or snippet.

### 3. HTTP Request

The final **HTTP Request** posts to:

```text
Method: POST
URL: https://gimme-job.com/internal/n8n/email-events
Authentication: Bearer Auth credential
Content-Type: application/json
Body: JSON from Keep GimmeJob metadata only
```

Create/select an n8n Bearer Auth credential whose token equals the production `N8N_INGEST_TOKEN`. Do not paste the token into workflow JSON that will be committed or shared.

Expected first-delivery response:

```json
{
  "ok": true,
  "id": "gmail:18fabc123",
  "created": true,
  "classification": "UNCLASSIFIED"
}
```

A repeated delivery returns `created: false`.

## Deployment prerequisite

Create the GitHub repository secret:

```text
N8N_INGEST_TOKEN
```

The deployment workflow passes it to `scripts/deploy-cloudflare.mjs`, which stores it as a Cloudflare Worker secret. Deployment intentionally does not proceed if the required production secrets are absent.

## Verification

1. Confirm the GimmeJob Worker is deployed and D1 migration `0006_add_email_events.sql` is applied.
2. Start the n8n production runtime from `ops/n8n/`.
3. Import the committed workflow and attach Gmail OAuth + GimmeJob Bearer Auth credentials.
4. Send one harmless test email to the connected Gmail account.
5. Manually execute the n8n workflow.
6. Confirm the metadata-only node contains no raw message content.
7. Confirm HTTP Request returns `201` with `created: true`.
8. Run the same item again and confirm `200` with `created: false`.
9. Confirm `email_events` contains metadata but no raw body.
10. Confirm Cloudflare logs contain `event: email_ingest` without email address, subject, or message content.
11. Activate the workflow.

## Next phase

After this path is stable, add classification and job matching:

```text
Gmail -> n8n -> classifier -> GimmeJob -> match email to jobs -> suggested status change
```

Sending/replying remains out of scope until a separate approval-first phase.
