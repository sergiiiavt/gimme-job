# n8n email integration

## Production flow

The production integration uses Gmail forwarding plus Cloudflare Email Routing. n8n does not need direct Gmail OAuth.

```text
User Gmail filter
  -> jobs+TOKEN@gimme-job.com
  -> Cloudflare Email Routing
  -> GimmeJob Worker email() handler
  -> tenant-scoped user_email_events in D1
  -> n8n polls pending event IDs
  -> GimmeJob AI classification endpoint
  -> n8n saves the structured result
  -> D1
```

GimmeJob owns tenant resolution, email storage, classification policy, AI credentials, and business state. n8n remains the scheduler/orchestrator.

## Email content boundary

For ordinary forwarded mail the Email Worker may extract a bounded text excerpt for classification:

- maximum 4,000 readable characters;
- MIME messages larger than 1 MiB are not parsed for an excerpt;
- `text/plain` is preferred, with HTML-to-text fallback;
- raw MIME, original HTML, and attachments are not stored in `user_email_events`;
- Gmail forwarding-confirmation bodies are excluded from the classification excerpt.

The bounded excerpt is tenant-scoped in D1 and is used only as classification input.

## Authentication and secrets

n8n uses `N8N_INGEST_TOKEN` as a scoped Bearer credential for both internal routes:

```text
/internal/n8n/email-events
/internal/n8n/email-classify
```

The OpenAI API key remains in the Cloudflare Worker environment. It is never placed in n8n workflow JSON or n8n credentials. n8n also has no direct D1 credential.

## Classifier

The internal classifier reloads the event from D1 by `(userId, id)`, so n8n cannot substitute arbitrary subject/body content as model input.

It produces one classification:

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

and structured enrichment:

```text
confidence
source
summary
company
jobTitle
recruiterName
action
```

Gmail forwarding confirmations are handled by a deterministic `SERVICE_MESSAGE` fast path. Other events use OpenAI structured output when configured, with deterministic excerpt-based fallback on provider failure.

## n8n workflow

`GimmeJob - Forwarded email classifier` runs every minute:

```text
Schedule Trigger
  -> Fetch unclassified email events
  -> Prepare email events
  -> AI classify email
  -> Save classification
```

Workflow definition:

```text
ops/n8n/workflows/gimmejob-forwarded-email-classifier.json
```

Assign the same existing Bearer Auth credential to all three HTTP Request nodes.

## Safety boundary

Classification does not send, reply to, delete, archive, relabel, or otherwise mutate the source mailbox. Suggested actions are stored as structured data only. Any future email sending or application-state mutation remains a separate approval-first capability.

## Legacy direct Gmail OAuth path

`ops/n8n/workflows/gimmejob-gmail-ingest.json` is the earlier direct Gmail Trigger design. It remains only for reference/backward compatibility and should not be activated for the forwarding-based production integration.
