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
  -> vacancy resolver
  -> safe vacancy status update when the match is strong
  -> D1 + vacancy audit log
```

GimmeJob owns tenant resolution, email storage, classification policy, vacancy matching, AI credentials, and business state. n8n remains the scheduler/orchestrator.

## Email content boundary

For ordinary forwarded mail the Email Worker may extract a bounded text excerpt for classification:

- maximum 4,000 readable characters;
- MIME messages larger than 1 MiB are not parsed for an excerpt;
- `text/plain` is preferred, with HTML-to-text fallback;
- raw MIME, original HTML, and attachments are not stored in `user_email_events`;
- Gmail forwarding-confirmation bodies are excluded from the classification excerpt.

The Email Worker also stores a stable thread key derived from `References`, `In-Reply-To`, or `Message-ID`. Once one message in a thread is linked to a vacancy, later messages can reuse that link.

## Authentication and secrets

n8n uses `N8N_INGEST_TOKEN` as a scoped Bearer credential for internal email routes:

```text
/internal/n8n/email-events
/internal/n8n/email-classify
/internal/n8n/email-resolve
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

## Vacancy resolver

Classification and vacancy identification are separate steps. The resolver prefers, in order:

1. an existing email-to-vacancy link;
2. a previously linked message in the same email thread;
3. a vacancy URL or sufficiently specific external vacancy ID found in the email;
4. a conservative composite match using company, title, sender domain, active pipeline state, and uniqueness.

A company name alone is not enough when several active vacancies exist for that company. A title alone is accepted only when it is an exact unique active title. If the result is not clearly dominant, the event is stored as `AMBIGUOUS` or `UNRESOLVED` and no vacancy is changed.

Resolution state is stored on `user_email_events`:

```text
job_id
match_status
match_method
match_confidence
match_evidence_json
resolved_at
status_applied_at
status_apply_note
```

## Safe pipeline changes

Only these automatic changes are supported:

```text
APPLICATION_RECEIVED: NEW / INTERESTED -> APPLIED
INTERVIEW:            APPLIED -> INTERVIEW
OFFER:                APPLIED / INTERVIEW -> OFFER
REJECTION:            APPLIED / INTERVIEW / OFFER -> REJECTED
```

`RECRUITER_OUTREACH` and `TEST_TASK` are linked to a vacancy but do not force a pipeline status.

The resolver never reopens terminal states and never lets an older email overwrite a newer vacancy state. Every successful automatic status change is written to the vacancy audit log as `GimmeJob automation` with the email event, classification, match method, and confidence in metadata.

## Ambiguous/unresolved events

Private vacancy mode shows a **Needs linking** panel. It lists unresolved job emails, suggested candidates, and an active-vacancy selector. A manual link still passes through the same transition and stale-event checks.

## n8n workflow

`GimmeJob - Forwarded email classifier` runs every minute:

```text
Schedule Trigger
  -> Fetch unclassified email events
  -> Prepare email IDs
  -> Classify and persist via GimmeJob AI
     -> Resolve vacancy and apply safe status
     -> Batch summary
```

Workflow definition:

```text
ops/n8n/workflows/gimmejob-forwarded-email-classifier.json
```

Assign the same existing Bearer Auth credential to all HTTP Request nodes.

## Reconciliation/backfill

`POST /internal/n8n/email-resolve` without a specific event processes unresolved/ambiguous job emails in chronological order. The default lookback is 30 days and the maximum batch is 100. Chronological processing is important because an application confirmation can move a vacancy to `APPLIED` before a later rejection moves it to `REJECTED`.

The daily report runs this reconciliation before building its activity section.

## Safety boundary

The automation never sends, replies to, deletes, archives, or relabels source email. It may update the private GimmeJob vacancy pipeline only after a safe vacancy match and allowed state transition. Ambiguous matches are left for manual linking.

## Legacy direct Gmail OAuth path

`ops/n8n/workflows/gimmejob-gmail-ingest.json` is the earlier direct Gmail Trigger design. It remains only for reference/backward compatibility and should not be activated for the forwarding-based production integration.
