# GimmeJob architecture

## Product modules

| Module | Current state | Intended responsibility |
| --- | --- | --- |
| Jobs | Functional | Vacancy inbox, relevance feedback, application pipeline |
| Interview questions | Functional | Growing public QA catalog with research references and bounded rendering |
| Python interview questions | Functional | Deeply-researched, bilingual Python Q&A, reachable via a catalog toggle inside Interview questions; reuses that module's component and schema under its own content and ID namespace |
| Programming (Python learning path) | Functional | Bilingual, code-sample-driven curriculum from first script to language internals |
| Certifications | Planned | Certification roadmap and progress |
| Trends | Planned | Market, vacancy, skill, and resume analysis |
| Agentic lab | Planned | Agent patterns and portfolio projects |
| LLM lab | Planned | LLM knowledge, testing, evaluation, and projects |
| Security lab | Planned | AppSec knowledge, checklists, and safe experiments |
| DevOps lab | Planned | CI/CD, cloud, containers, reliability, and observability |
| Standards | Planned | ISO, IEC, IEEE, testing, quality, and compliance references |
| News | Planned | Focused professional updates |

## Runtime

The hosted application is a React/Vinext worker with same-origin API routes. Public knowledge content is versioned as JSON in Git and lazy-loaded as a separate client chunk. Private, user-specific state is persisted in D1 through prepared SQL statements. Drizzle owns the schema and versioned migrations.

The local agent remains separate so source collection and experimentation can run from VS Code without weakening the hosted application's approval-first behaviour.

## Gmail automation boundary

n8n is an orchestration layer, not a source of truth and not the owner of GimmeJob business rules.

Phase 1-2 flow:

```text
Gmail -> n8n -> /internal/n8n/email-events -> D1 email_events
```

Gmail OAuth credentials remain in n8n. n8n has no direct D1 access. GimmeJob receives only structured metadata through a dedicated Bearer token and deliberately rejects raw email body fields. Repeated Gmail deliveries are idempotent by provider message ID.

Later phases may add classification, job matching, draft generation, and approval-first sending, while status transitions and application rules remain in GimmeJob.

## Delivery

GitHub Actions validates content, linting, local-agent types, tests and the production build. On `main`, the same workflow can provision a named D1 database, apply versioned migrations, deploy the Worker, and rotate its Basic Auth password and service tokens from repository secrets. Pull requests never deploy, and the deployment script rejects production use outside GitHub Actions.

## Security boundaries

- no secrets in Git;
- production data remains in the private database;
- external Workers traffic requires a provider-managed password secret;
- the n8n Gmail ingest endpoint uses its own scoped `N8N_INGEST_TOKEN`, not the workspace password;
- Gmail OAuth credentials remain in n8n and are never persisted in D1;
- n8n receives no D1 credentials;
- raw Gmail message bodies and attachments are not accepted by the Phase 1-2 ingest endpoint;
- external fetches accept only public HTTPS sources;
- applications are never sent by vacancy sync or analysis;
- GitHub Actions has read-only repository permissions;
- hosted credentials belong in provider-managed secrets.
