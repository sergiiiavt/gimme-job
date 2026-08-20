# n8n daily email automation report

GimmeJob has a separate daily reporting workflow so the every-minute classifier stays focused on processing.

## Architecture

```text
Every day at 08:00 Europe/Kyiv
  -> choose the previous Kyiv calendar day
  -> GET /internal/n8n/email-stats?date=YYYY-MM-DD
  -> stop if email classification is still pending
  -> POST /internal/n8n/email-resolve (bounded reconciliation)
  -> GET /internal/n8n/vacancies-sync for detailed activity
  -> format one HTML report
  -> send one email through n8n SMTP
```

D1 is the source of truth. The workflow does not derive statistics from n8n execution history.

## Processing guard

The report is not sent when the daily statistics still show pending classification work. This prevents an early/partial report from saying that nothing happened while email processing is still running.

The guard is intentionally simple: the workflow run fails and sends no report. It does not add an extra polling/retry loop.

## Reconciliation before reporting

Before formatting the email, the workflow calls:

```text
POST /internal/n8n/email-resolve
{ "limit": 100, "lookbackDays": 30 }
```

This retries unresolved or ambiguous job-process emails in chronological order. It allows already-classified mail to benefit from newer vacancy links and thread history.

The batch is deliberately bounded to 100 events and 30 days.

## Statistics endpoint

```text
GET https://gimme-job.com/internal/n8n/email-stats?date=2026-08-18
Authorization: Bearer <N8N_INGEST_TOKEN>
```

Optional tenant filter:

```text
&userId=usr_...
```

The report date is interpreted as a `Europe/Kyiv` calendar day and converted to the correct UTC range.

The response includes:

- received, processed, pending;
- job-relevant emails;
- job alerts, service messages, non-job mail;
- held, failed, and needs-review counts;
- rule vs OpenAI routing;
- AI-avoidance rate;
- OpenAI token counts;
- count by classification;
- up to 20 important hiring-process events.

`jobRelevant` counts:

```text
APPLICATION_RECEIVED
RECRUITER_OUTREACH
INTERVIEW
TEST_TASK
OFFER
REJECTION
```

`REJECTION` remains an important event even though its action is `NO_ACTION`. Important events are ordered so offers/interviews/test tasks/outreach/rejections appear before lower-priority application confirmations or generic events.

## Detailed automation activity

The workflow also calls:

```text
GET /internal/n8n/vacancies-sync?startUtc=...&endUtc=...
```

The report keeps two concepts separate:

### Vacancy changes by automation

Actual private vacancy mutations, for example:

```text
QA Lead · Example
status: APPLIED -> REJECTED
GimmeJob automation
```

### Email classification and vacancy resolution

For each classified email the report shows:

- classification and classifier confidence/source;
- extracted company/title/recruiter/action;
- vacancy resolution status;
- matched vacancy, method, and confidence when matched;
- whether a pipeline status was updated, already correct, blocked, or skipped as stale;
- `Needs linking` when matching is ambiguous or unresolved.

This prevents “email was classified” from being mistaken for “vacancy was changed.”

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

1. Assign the existing Bearer Auth credential to the statistics, reconciliation, and activity HTTP Request nodes.
2. Create/select the SMTP credential for `Send daily report email`.
3. Verify the From/To addresses.
4. Execute the workflow manually once after the classifier queue is empty.
5. Confirm the report includes the vacancy-resolution section and the final node returns `DAILY_REPORT_SENT`.
6. Publish/activate the workflow.

The repository workflow imports inactive intentionally.

## Why the report runs in the morning

It runs at 08:00 Kyiv and reports the previous local calendar day. This gives a complete local-day window instead of an evening report that misses later mail.

## Cost reporting

The report includes OpenAI call count and tokens derived from classified email events. It does not hard-code OpenAI pricing because pricing can change independently of the application.
