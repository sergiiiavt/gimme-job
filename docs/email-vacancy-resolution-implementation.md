# Email → vacancy resolution implementation

## Goal

When GimmeJob receives a hiring-process email, identify the correct private vacancy when it is safe to do so, update the pipeline only through allowed transitions, and leave uncertain cases for manual linking.

Main rule:

> A wrong automatic vacancy update is worse than an unresolved email.

## Phase 1 — Resolution data

**Implemented**

Store resolution state on `user_email_events` while keeping the existing `job_id` as the real email→vacancy link.

Added fields:

```text
match_status
match_method
match_confidence
match_evidence_json
resolved_at
status_applied_at
status_apply_note
```

Statuses:

```text
PENDING
MATCHED
AMBIGUOUS
UNRESOLVED
NOT_APPLICABLE
```

No separate matching database or vector store is introduced.

## Phase 2 — Conservative resolver

**Implemented**

Matching order:

1. existing `job_id`;
2. previously linked email in the same thread;
3. vacancy URL / apply URL / specific external vacancy identifier;
4. composite match against active vacancies.

Composite signals are intentionally simple:

- company;
- vacancy title;
- sender/company relationship;
- current private pipeline state;
- uniqueness among active candidates.

Safety rules:

- company alone does not auto-match when several active vacancies exist for the company;
- missing company is acceptable only when another strong unique signal identifies the vacancy;
- same title across several companies stays ambiguous if company is missing;
- partial/weak title similarity does not auto-update;
- generic numeric external IDs are not treated as hard identifiers;
- only one clearly dominant candidate can auto-match.

Top candidates and the signals used are stored in `match_evidence_json` for explanation and manual review.

## Phase 3 — Thread continuity and safe status changes

**Implemented**

Forwarded mail now derives a stable thread key from:

```text
References
-> In-Reply-To
-> Message-ID
```

If an earlier email in the thread is linked to a vacancy, later messages can inherit that vacancy.

Allowed automatic transitions:

| Email classification | Allowed vacancy change |
| --- | --- |
| `APPLICATION_RECEIVED` | `NEW` / `INTERESTED` → `APPLIED` |
| `RECRUITER_OUTREACH` | link only; no forced status |
| `INTERVIEW` | `APPLIED` → `INTERVIEW` |
| `TEST_TASK` | link only; no forced status |
| `OFFER` | `APPLIED` / `INTERVIEW` → `OFFER` |
| `REJECTION` | `APPLIED` / `INTERVIEW` / `OFFER` → `REJECTED` |

Additional guards:

- automatic status mutation requires email-classification confidence of at least `0.80`;
- a low-confidence email may still be linked to a vacancy for review but cannot change the pipeline automatically;
- terminal or unsupported transitions are not reopened/overwritten;
- an email older than the vacancy's latest status change cannot overwrite that newer state;
- no-op transitions are recorded as resolved but do not create a fake status change.

Successful automatic status changes are recorded by the existing vacancy audit log as `GimmeJob automation`, with email classification confidence and vacancy-match details in metadata.

## Phase 4 — Ambiguous/unresolved handling

**Implemented**

Private vacancy mode has a **Needs linking** panel for `AMBIGUOUS` and `UNRESOLVED` job emails.

It shows:

- email type/date/summary;
- recognized company/title when available;
- suggested candidates and scores;
- a selector containing active vacancies.

Manual linking uses the same resolver and the same stale-event/transition guards. Manual actions are attributed to `You` in the audit trail when they cause a status change.

## Phase 5 — Reconciliation/backfill

**Implemented**

Internal resolver endpoint:

```text
POST /internal/n8n/email-resolve
```

It can resolve one event or process a bounded batch.

Daily reconciliation uses:

```json
{
  "limit": 100,
  "lookbackDays": 30
}
```

Events are processed oldest first. This is important for sequences such as:

```text
application confirmation -> APPLIED
later rejection          -> REJECTED
```

Only emails already present in `user_email_events` can be reconciled. This is not a historical Gmail importer.

## Phase 6 — Daily reporting

**Implemented**

Before sending the daily report:

1. load daily statistics;
2. refuse to send if classification is still pending;
3. reconcile unresolved events;
4. load detailed automation activity;
5. format/send the report.

The email explicitly separates:

- **Vacancy changes by automation** — real private-state mutations;
- **Email classification and vacancy resolution** — classification, matching result, method/confidence, and status outcome;
- **Needs vacancy linking** — ambiguous/unresolved count.

Rejections are included in important events even though their action is `NO_ACTION`.

## Verification checklist

### Resolver

- [x] several active vacancies from one company do not match on company alone;
- [x] missing company can resolve through a unique exact title;
- [x] duplicate title with missing company stays ambiguous;
- [x] weak title similarity does not auto-match;
- [x] generic numeric external IDs are not hard matches;
- [x] low-confidence classification cannot mutate pipeline status;
- [x] rejection can move `APPLIED` → `REJECTED`;
- [x] stale email cannot overwrite a newer vacancy state;
- [x] thread replies inherit the root thread key.

### Product/UI

- [x] unresolved items are private-only;
- [x] manual linking uses a real vacancy selector;
- [x] audit actor distinguishes automation from user changes.

### n8n/report

- [x] new classified email is sent to the resolver;
- [x] daily report performs bounded reconciliation;
- [x] daily report refuses partial data while classification is pending;
- [x] report distinguishes classification from real vacancy mutations;
- [x] rejection remains an important event.

### Release validation

Before merge/deploy:

1. run repository `npm run verify` through CI;
2. pass SonarQube quality gate;
3. review the final PR diff for unrelated changes;
4. after deployment, import/publish the updated n8n workflow JSON files if production n8n is not synchronized from Git;
5. manually execute the classifier/reconciliation workflow with a safe test event;
6. confirm the private vacancy status and audit log agree with the report.

## Intentionally not added

To keep the implementation small:

- no vector database or embeddings;
- no LLM choosing a database `job_id` directly;
- no fuzzy company master-data service;
- no new workflow engine;
- no automatic retry loop for the 08:00 daily report;
- no historical Gmail backfill outside emails already ingested into GimmeJob.
