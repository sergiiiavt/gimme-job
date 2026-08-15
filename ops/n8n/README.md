# GimmeJob n8n workflows

This directory contains importable n8n workflow definitions for GimmeJob.

The production n8n runtime itself is managed under:

```text
ops/hetzner/
```

Current production endpoint:

```text
https://n8n.gimme-job.com
```

## Current email architecture

GimmeJob does not need n8n to own Gmail OAuth for the current production flow.

```text
User Gmail filter
  -> jobs+TOKEN@gimme-job.com
  -> Cloudflare Email Routing
  -> GimmeJob Worker email() handler
  -> tenant-scoped user_email_events in D1
  -> n8n
  -> deterministic metadata classification
  -> GimmeJob internal API
  -> D1
```

The Worker stores only the structured metadata required by the product. n8n has no D1 credentials and receives no raw email body or attachment data.

## Current workflow

Import:

```text
ops/n8n/workflows/gimmejob-forwarded-email-classifier.json
```

Workflow name:

```text
GimmeJob - Forwarded email classifier
```

The workflow imports inactive and contains no secret credentials.

It runs this path:

```text
Every minute
  -> GET /internal/n8n/email-events?limit=25
  -> Classify metadata
  -> PATCH /internal/n8n/email-events
```

The classifier currently uses deterministic subject/sender rules and produces one of:

```text
RECRUITER
INTERVIEW
REJECTION
TEST_TASK
OFFER
OTHER
```

There is no LLM/API cost in this first workflow.

## Authentication

Both HTTP nodes use the same n8n **Bearer Auth** credential.

The token must equal the production Cloudflare Worker secret:

```text
N8N_INGEST_TOKEN
```

Do not commit the token to the workflow JSON.

The token authorizes only the internal n8n email API. n8n still receives no direct D1 credential.

## First activation

1. Open `https://n8n.gimme-job.com`.
2. Create the n8n owner account if the instance still shows first-run setup.
3. Import `gimmejob-forwarded-email-classifier.json`.
4. Create one Bearer Auth credential with the production `N8N_INGEST_TOKEN`.
5. Assign that credential to both HTTP Request nodes:
   - `Fetch unclassified email events`
   - `Save classification`
6. Forward a harmless job/recruiter email through the existing GimmeJob forwarding address.
7. Execute the workflow manually once.
8. Confirm `Fetch unclassified email events` returns only metadata fields and no body/raw/HTML/snippet data.
9. Confirm `Save classification` returns `ok: true`.
10. Activate the workflow.

## Processing API

Fetch pending events:

```text
GET https://gimme-job.com/internal/n8n/email-events?limit=25
Authorization: Bearer <N8N_INGEST_TOKEN>
```

Response shape:

```json
{
  "events": [
    {
      "id": "evt_...",
      "userId": "...",
      "provider": "email_forwarding",
      "providerMessageId": "...",
      "receivedAt": "2026-08-16T00:30:00.000Z",
      "senderName": null,
      "senderEmail": "recruiter@example.com",
      "subject": "Interview invitation"
    }
  ]
}
```

Save a classification:

```text
PATCH https://gimme-job.com/internal/n8n/email-events
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "userId": "...",
  "id": "evt_...",
  "classification": "INTERVIEW"
}
```

The update is idempotent. If another actor already assigned a different classification, the API returns `409` instead of silently overwriting it.

## Legacy direct-Gmail workflow

`workflows/gimmejob-gmail-ingest.json` is the earlier direct Gmail OAuth design. It remains in Git for reference/backward compatibility but is **not** the workflow to activate for the current forwarding-based production integration.

## Next phase

Once the deterministic pipeline is stable, the classifier can be upgraded without changing the ingestion boundary:

```text
forwarded email metadata
  -> n8n
  -> richer classifier / LLM when justified
  -> job matching
  -> suggested status/action
  -> explicit user approval for anything that sends or changes application state
```
