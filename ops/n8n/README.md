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
  -> GimmeJob processing gate
       -> already classified / busy / delayed? stop
       -> deterministic service/noise/job-alert rule? persist without AI
       -> AI disabled or budget exhausted? hold
       -> otherwise OpenAI structured classification
  -> result persisted atomically in D1
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
Poll email queue every minute
  -> GET /internal/n8n/email-events?limit=25
  -> Prepare email IDs
  -> POST /internal/n8n/email-classify
```

The `POST /internal/n8n/email-classify` endpoint now claims, classifies, and persists the event. There is no separate write node in the current workflow, which removes a failure window where OpenAI could succeed but the following D1 save could fail.

## Processing state machine

Each forwarded email has an explicit processing state:

```text
PENDING
  -> PROCESSING
       -> CLASSIFIED
       -> RETRY
       -> FAILED
       -> HOLD
```

- `CLASSIFIED` events never return to the n8n queue.
- `PROCESSING` acts as a lock so overlapping n8n executions cannot spend twice on the same email.
- stale processing locks become eligible again after 10 minutes.
- transient AI failures retry with backoff and stop after three processing attempts.
- `HOLD` is used when AI is disabled, unavailable, or the daily AI budget is exhausted.

## Classifications

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
NON_JOB
OTHER
```

`NON_JOB` is intentionally separate from `OTHER`:

- `NON_JOB` = confidently irrelevant to job search, such as a consumer promotion.
- `OTHER` = potentially relevant but not reliably classifiable; keep it for review.

The result can also contain:

```text
confidence
summary
company
jobTitle
recruiterName
action
source
classifierVersion
promptVersion
aiUsage
aiLatencyMs
```

Possible actions are `NO_ACTION`, `REVIEW`, `RESPOND`, `PREPARE_INTERVIEW`, `COMPLETE_TEST_TASK`, `REVIEW_OFFER`, `TRACK_APPLICATION`, and `REVIEW_JOB_ALERT`.

## Pre-AI gate

OpenAI is not called for strong deterministic cases. Current examples include:

- Gmail forwarding confirmation -> `SERVICE_MESSAGE`
- GitHub/Sonar technical notifications -> `SERVICE_MESSAGE`
- strong account-verification messages -> `SERVICE_MESSAGE`
- obvious automated job alerts -> `JOB_ALERT`
- strong consumer promotions/newsletters -> `NON_JOB`

Potentially ambiguous hiring mail still goes to OpenAI so the gate does not aggressively discard recruiter messages.

If OpenAI fails and a strong hiring-stage rule exists, the event is persisted using a deterministic fallback. Ambiguous events are retried instead of being silently labeled `OTHER`.

## AI budget controls

The Worker reserves an AI-call budget before each OpenAI request. Reservations are tracked in D1 per UTC day for both the user and the whole deployment.

Defaults:

```text
EMAIL_AI_ENABLED=true
EMAIL_AI_DAILY_USER_LIMIT=50
EMAIL_AI_DAILY_GLOBAL_LIMIT=500
```

These can be changed through GitHub repository variables with the same names and are deployed as Cloudflare Worker vars.

When a limit is reached:

```text
email -> HOLD -> no OpenAI call -> eligible again in the next UTC budget window
```

The usage table records reserved, completed, and failed calls plus input/output/total tokens. This provides a server-side spending guard independently of n8n retries.

## Prompt and classifier versions

Runtime instruction:

```text
app/internal/n8n/email-classify/instructions.ts
```

Human-readable review copy:

```text
app/internal/n8n/email-classify/prompt.md
```

Current versions:

```text
classifierVersion = automation-v2.0
promptVersion = email-classifier-v2
```

Every newly classified email stores the classifier version, prompt version, AI model, token counts, and AI latency so later corrections and evaluations are reproducible.

## Authentication

Both HTTP Request nodes use the same n8n **Bearer Auth** credential. Its token must equal the production Cloudflare Worker secret `N8N_INGEST_TOKEN`.

Assign the existing credential to:

- `Fetch pending email work`
- `Classify and persist via GimmeJob AI`

Do not commit the token to workflow JSON.

## Activation

1. Import `gimmejob-forwarded-email-classifier.json` into `https://n8n.gimme-job.com`.
2. Assign the existing `Bearer Auth account` to both HTTP Request nodes.
3. Forward a harmless recruiter/job email through the existing GimmeJob forwarding address.
4. Execute the workflow manually.
5. Confirm `Classify and persist via GimmeJob AI` returns either a structured `CLASSIFIED` result or a deliberate `HOLD`/`RETRY` state.
6. Publish/activate the workflow.

The workflow file imports with `active: false` intentionally. Scheduled execution starts only after the workflow is published/activated in n8n.

## Internal APIs

Fetch due work:

```text
GET https://gimme-job.com/internal/n8n/email-events?limit=25
Authorization: Bearer <N8N_INGEST_TOKEN>
```

Only `UNCLASSIFIED` events whose processing state is due are returned. Each event may contain a bounded `textExcerpt`; raw MIME and attachments are never returned.

Classify and persist one event:

```text
POST https://gimme-job.com/internal/n8n/email-classify
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json

{
  "userId": "...",
  "id": "evt_..."
}
```

The classifier reloads the event from D1 by `(userId, id)`. It does not trust subject/body fields supplied by n8n. The endpoint is idempotent: if a classification was already persisted, a retry returns the existing result without calling OpenAI again.

The older `PATCH /internal/n8n/email-events` classification endpoint remains for backward compatibility with previously imported workflows, but it is not required by the current workflow.

## Legacy workflow

`workflows/gimmejob-gmail-ingest.json` is the earlier direct Gmail OAuth design. It is retained only for reference/backward compatibility and should not be activated for the current forwarding-based integration.
