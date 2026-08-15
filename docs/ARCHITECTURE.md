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

## Email automation boundary

n8n is an orchestration layer, not a source of truth and not the owner of GimmeJob business rules.

The current production email path uses personal forwarding addresses instead of giving n8n Gmail credentials:

```text
User Gmail filter
  -> jobs+TOKEN@gimme-job.com
  -> Cloudflare Email Routing
  -> GimmeJob Worker email() handler
  -> tenant-scoped user_email_events in D1
  -> n8n polls /internal/n8n/email-events
  -> metadata-only classification
  -> PATCH /internal/n8n/email-events
  -> tenant-scoped classification stored in D1
```

The Worker resolves the forwarding token to `user_id` and persists only structured metadata. n8n has no direct D1 access and does not receive Gmail credentials or raw message bodies. The n8n processing API is protected by `N8N_INGEST_TOKEN` and exposes only unclassified email metadata needed by the workflow. Classification updates are idempotent and do not overwrite an event that has already been classified by another actor.

The old direct-Gmail n8n ingest endpoint remains available for backward compatibility, but it is not the current production ingestion path.

Later phases may add richer classification, job matching, draft generation, and approval-first sending. Status transitions and application rules remain in GimmeJob.

## Delivery

GitHub Actions validates content, linting, local-agent types, tests and the production build. On `main`, the same workflow can provision a named D1 database, apply versioned migrations, deploy the Worker, and rotate its Basic Auth password and service tokens from repository secrets. Pull requests never deploy, and the deployment script rejects production use outside GitHub Actions.

The production n8n runtime is managed separately on the Hetzner VM by the files under `ops/hetzner/`. Importable n8n workflow definitions live under `ops/n8n/workflows/`.

## Security boundaries

- no secrets in Git;
- production data remains in the private database;
- external Workers traffic requires a provider-managed password secret;
- the n8n internal email API uses its own `N8N_INGEST_TOKEN`, not the workspace password;
- the current forwarded-email workflow needs no Gmail OAuth credentials in n8n;
- n8n receives no D1 credentials;
- raw Gmail message bodies and attachments are not exposed by the current n8n processing API;
- external fetches accept only public HTTPS sources;
- applications are never sent by vacancy sync or analysis;
- GitHub Actions has read-only repository permissions;
- hosted credentials belong in provider-managed secrets.
