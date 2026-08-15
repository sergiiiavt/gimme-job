# n8n email integration

## Current production flow

The production integration now uses Gmail forwarding plus Cloudflare Email Routing. n8n no longer needs direct Gmail OAuth for this path.

```text
User Gmail filter
  -> jobs+TOKEN@gimme-job.com
  -> Cloudflare Email Routing
  -> GimmeJob Worker email() handler
  -> tenant-scoped user_email_events in D1
  -> n8n polls metadata-only internal API
  -> classification
  -> GimmeJob internal API
  -> D1
```

This keeps account identity, forwarding-token resolution, tenant ownership, email-event storage, and business state in GimmeJob. n8n remains an internal orchestration layer.

## Production runtime

The Hetzner production runtime is managed under:

```text
ops/hetzner/
```

The n8n UI is served at:

```text
https://n8n.gimme-job.com
```

The current workflow definition is:

```text
ops/n8n/workflows/gimmejob-forwarded-email-classifier.json
```

See `ops/n8n/README.md` for import, credential, verification, and activation steps.

## Internal API

n8n uses the existing `N8N_INGEST_TOKEN` as a scoped Bearer credential. The token stays in provider-managed secrets / n8n credentials and is never committed in workflow JSON.

Fetch unclassified forwarded-email metadata:

```text
GET https://gimme-job.com/internal/n8n/email-events?limit=25
Authorization: Bearer <N8N_INGEST_TOKEN>
```

Classify one tenant event:

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

The API returns only structured metadata. It does not expose raw MIME, plaintext/HTML bodies, snippets, or attachments to n8n. Classification writes are idempotent and refuse to overwrite a different existing classification.

## First workflow

`GimmeJob - Forwarded email classifier` runs every minute:

```text
Schedule Trigger
  -> Fetch unclassified email events
  -> Classify metadata
  -> Save classification
```

The first classifier is deterministic and free: it classifies sender/subject metadata into `RECRUITER`, `INTERVIEW`, `REJECTION`, `TEST_TASK`, `OFFER`, or `OTHER`.

No sending, replying, deleting, archiving, relabeling, or application-state mutation occurs in this phase.

## Legacy direct Gmail OAuth path

`ops/n8n/workflows/gimmejob-gmail-ingest.json` is the earlier direct Gmail Trigger design. It is retained only for reference/backward compatibility and should not be activated for the current forwarding-based integration.

## Next phase

After the metadata pipeline is stable, n8n can add richer classification and job matching. Any future email sending or application-state change remains approval-first and must be implemented as a separate capability.
