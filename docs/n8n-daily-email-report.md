# n8n daily email automation report

GimmeJob has a separate daily reporting workflow so the every-minute classifier stays focused on processing and does not send noisy completion emails.

## Architecture

```text
Every day at 08:00 Europe/Kyiv
  -> choose the previous Kyiv calendar day
  -> GET /internal/n8n/email-stats?date=YYYY-MM-DD
  -> format a compact HTML report
  -> send one email through n8n SMTP
  -> Daily report sent
```

D1 is the source of truth for the report. The workflow does not derive statistics from n8n execution history, because execution history can be pruned independently of product data.

## Statistics endpoint

```text
GET https://gimme-job.com/internal/n8n/email-stats?date=2026-08-18
Authorization: Bearer <N8N_INGEST_TOKEN>
```

Optional tenant filter:

```text
&userId=usr_...
```

If `userId` is omitted, the endpoint aggregates all email automation events in the report window. The report date is interpreted as a `Europe/Kyiv` calendar day and converted to the correct UTC range, including daylight-saving changes.

The response includes:

- received, processed, pending
- job-relevant emails
- job alerts, service messages, non-job mail
- held, failed, and needs-review counts
- deterministic-rule vs OpenAI routing
- AI-avoidance rate
- OpenAI input/output/total token counts stored on classified events
- count by classification
- up to 20 important job-process events

`jobRelevant` intentionally counts only actual application-process mail:

```text
APPLICATION_RECEIVED
RECRUITER_OUTREACH
INTERVIEW
TEST_TASK
OFFER
REJECTION
```

`JOB_ALERT` is reported separately so vacancy digests do not inflate the count of real hiring-process email.

## n8n workflow

Import:

```text
ops/n8n/workflows/gimmejob-daily-email-report.json
```

Workflow name:

```text
GimmeJob - Daily email automation report
```

After import:

1. Assign the existing `Bearer Auth account` used by the classifier to `Get daily GimmeJob statistics`.
2. Create/select an SMTP credential for `Send daily report email`.
3. Verify the From/To addresses in the Send Email node.
4. Execute the workflow manually once.
5. Confirm the email is delivered and the final node returns `DAILY_REPORT_SENT`.
6. Publish/activate the workflow.

The workflow imports inactive intentionally.

## Why the report runs in the morning

It runs at 08:00 Kyiv and reports the previous local calendar day. This guarantees a complete daily window instead of sending an evening report that misses emails arriving later that night.

## Cost reporting

The report includes OpenAI call count and tokens derived from classified email events. It does not hard-code OpenAI pricing, because pricing can change independently of the application. A later enhancement can add cost reconciliation from provider usage data or configurable price variables.
