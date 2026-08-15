# GimmeJob n8n workflows

This directory contains importable n8n workflow definitions for GimmeJob. The production n8n runtime is managed under `ops/hetzner/` and is available at `https://n8n.gimme-job.com`.

## Current email architecture

```text
User Gmail filter
  -> jobs+TOKEN@gimme-job.com
  -> Cloudflare Email Routing
  -> GimmeJob Worker email() handler
  -> tenant-scoped user_email_events in D1
  -> n8n orchestration
  -> GimmeJob internal AI classifier
  -> structured classification saved to D1
```

The Email Worker extracts at most 4,000 characters of readable `text/plain` content, with an HTML-to-text fallback, from MIME messages no larger than 1 MiB. Raw MIME, HTML, and attachments are not stored in `user_email_events`. Gmail forwarding-confirmation bodies are excluded from the classification excerpt entirely.

n8n receives no Gmail, D1, or OpenAI credentials. The OpenAI API key remains a Cloudflare Worker secret; n8n authenticates only to GimmeJob's scoped internal routes using `N8N_INGEST_TOKEN`.

## Workflow

Import:

```text
ops/n8n/workflows/gimmejob-forwarded-email-classifier.json
```

Workflow name:

```text
GimmeJob - Forwarded email classifier
```

The workflow imports inactive and contains no secret credentials. It runs:

```text
Every minute
  -> GET /internal/n8n/email-events?limit=25
  -> Prepare email events
  -> POST /internal/n8n/email-classify
  -> PATCH /internal/n8n/email-events
```

The classifier produces one of:

```text
APPLICATION_RECEIVED
RECRUITER_OUTREACH
INTERVIEW
TEST_TASK
OFFER
REJECTION
JOB_ALERT
SERVICE_MESSAGE
OTHER
```

It also returns:

```text
confidence
summary
company
jobTitle
recruiterName
action
source
```

Possible actions are `NO_ACTION`, `REVIEW`, `RESPOND`, `PREPARE_INTERVIEW`, `COMPLETE_TEST_TASK`, `REVIEW_OFFER`, `TRACK_APPLICATION`, and `REVIEW_JOB_ALERT`.

Gmail forwarding confirmations use a deterministic `SERVICE_MESSAGE` fast path and do not call OpenAI. If OpenAI is unavailable, classification degrades to deterministic full-excerpt rules instead of blocking the workflow.

## Authentication

All three HTTP Request nodes use the same n8n **Bearer Auth** credential. Its token must equal the production Cloudflare Worker secret `N8N_INGEST_TOKEN`.

Assign the existing credential to:

- `Fetch unclassified email events`
- `AI classify email`
- `Save classification`

Do not commit the token to workflow JSON.

## Activation

1. Import `gimmejob-forwarded-email-classifier.json` into `https://n8n.gimme-job.com`.
2. Assign the existing `Bearer Auth account` to all three HTTP Request nodes.
3. Forward a harmless recruiter/job email through the existing GimmeJob forwarding address.
4. Execute the workflow manually.
5. Confirm `AI classify email` returns structured fields including `classification`, `confidence`, `summary`, `source`, and `action`.
6. Confirm `Save classification` returns `ok: true`.
7. Publish/activate the workflow.

## Internal APIs

Fetch pending events:

```text
GET https://gimme-job.com/internal/n8n/email-events?limit=25
Authorization: Bearer <N8N_INGEST_TOKEN>
```

Each event may contain a bounded `textExcerpt`; raw MIME and attachments are never returned.

Classify one event:

```text
POST https://gimme-job.com/internal/n8n/email-classify
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json

{
  "userId": "...",
  "id": "evt_..."
}
```

The classifier reloads the event from D1 by `(userId, id)`. It does not trust subject/body fields supplied by n8n.

Save the structured result:

```text
PATCH https://gimme-job.com/internal/n8n/email-events
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "userId": "...",
  "id": "evt_...",
  "classification": "INTERVIEW",
  "confidence": 0.96,
  "source": "OPENAI:gpt-5.6",
  "summary": "Technical interview invitation for Senior QA Engineer.",
  "company": "Example Corp",
  "jobTitle": "Senior QA Engineer",
  "recruiterName": "Anna Smith",
  "action": "PREPARE_INTERVIEW"
}
```

The update is idempotent. A different existing classification returns `409` rather than being silently overwritten.

## Legacy workflow

`workflows/gimmejob-gmail-ingest.json` is the earlier direct Gmail OAuth design. It is retained only for reference/backward compatibility and should not be activated for the current forwarding-based integration.
