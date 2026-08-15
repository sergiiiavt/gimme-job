# n8n Gmail integration

## Scope

Phase 1-2 only:

```text
Gmail -> n8n -> GimmeJob ingest endpoint -> D1 email_events
```

This integration does **not** send, reply to, delete, archive, or relabel email. It also does not store the raw email body in GimmeJob.

## Security boundary

- Gmail OAuth credentials stay in n8n.
- GimmeJob never receives the Gmail OAuth access/refresh token.
- n8n receives no D1 credentials.
- n8n can call only the dedicated ingest endpoint with `N8N_INGEST_TOKEN`.
- `N8N_INGEST_TOKEN` is stored as a GitHub repository secret and deployed as a Cloudflare Worker secret.
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

Create a workflow named `GimmeJob - Gmail ingest`.

### 1. Gmail Trigger

Use the built-in **Gmail Trigger** with the Gmail account intended for job-search mail. Poll for new messages. Start without Spam/Trash and without any send/reply operation.

For a safer first test, narrow the Gmail query/filter to a known recruiter, job-alert label, or a test message. Expand the filter only after the ingest path is verified.

### 2. Edit Fields

Add **Edit Fields (Set)** after Gmail Trigger and construct only the metadata accepted by GimmeJob:

- `providerMessageId` <- Gmail message ID
- `threadId` <- Gmail thread ID when available
- `receivedAt` <- Gmail received/date timestamp
- `senderName` <- parsed From name when available
- `senderEmail` <- parsed From email when available
- `subject` <- Subject
- `classification` <- literal `UNCLASSIFIED`

Do not map message body, HTML, plaintext content, raw MIME, attachments, or snippet.

Field names emitted by Gmail Trigger can vary with the n8n node/version and selected simplification options. Use n8n's expression picker to map the actual trigger output instead of hard-coding guessed property paths.

### 3. HTTP Request

Add **HTTP Request**:

```text
Method: POST
URL: https://gimme-job.com/internal/n8n/email-events
Send Headers: yes
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
Body: JSON from Edit Fields
```

Store the token in an n8n credential/secret mechanism; do not paste it into workflow JSON that will be committed or shared.

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

1. Merge/deploy the GimmeJob changes.
2. Confirm D1 migration `0006_add_email_events.sql` applied.
3. Send one harmless test email to the connected Gmail account.
4. Run/activate the n8n workflow.
5. Confirm HTTP Request returns `201` with `created: true`.
6. Run the same item again and confirm `200` with `created: false`.
7. Confirm `email_events` contains metadata but no raw body.
8. Confirm Cloudflare logs contain `event: email_ingest` without email address, subject, or message content.

## Next phase

After this path is stable, add classification and job matching:

```text
Gmail -> n8n -> classifier -> GimmeJob -> match email to jobs -> suggested status change
```

Sending/replying remains out of scope until a separate approval-first phase.
