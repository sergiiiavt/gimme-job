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

```text
User Gmail filter
  -> jobs+TOKEN@gimme-job.com
  -> Cloudflare Email Routing
  -> GimmeJob Worker email() handler
  -> tenant-scoped user_email_events in D1
  -> n8n polls /internal/n8n/email-events
  -> POST /internal/n8n/email-classify
       -> rule fast paths
       -> OpenAI structured classification when configured
       -> deterministic fallback on provider failure
  -> PATCH /internal/n8n/email-events
  -> tenant-scoped structured result in D1
```

The Worker resolves the forwarding token to `user_id`. For ordinary forwarded email it may store a bounded readable excerpt of up to 4,000 characters from MIME messages no larger than 1 MiB. Raw MIME, original HTML, and attachments are not stored in `user_email_events`; Gmail forwarding-confirmation bodies are excluded from excerpts.

n8n receives no Gmail, D1, or OpenAI credentials. The classifier reloads the tenant event from D1 using `(userId, id)` before model use, so client-supplied subject/body data is not trusted as classifier input. `N8N_INGEST_TOKEN` protects both scoped service routes.

Classification stores the category plus confidence, source, summary, extracted company/job title/recruiter when supported by the email, and a suggested action. Those actions are data only: the classification pipeline does not send mail or mutate application state.

The old direct-Gmail n8n ingest endpoint remains available for backward compatibility, but it is not the current production ingestion path.

## Delivery

`AGENTS.md` is the cross-agent repository policy. Tool-specific entrypoints such as `CLAUDE.md` and `.github/copilot-instructions.md` defer to it instead of maintaining independent copies. `package.json` is the executable validation source of truth: `npm run verify:fast` is intended for iteration and `npm run verify` mirrors all deterministic CI checks that can run without repository secrets.

GitHub Actions installs dependencies, runs `npm run verify`, then runs the credentialed SonarQube Cloud quality gate. On `main`, the same workflow can provision a named D1 database, apply versioned migrations, deploy the Worker, and rotate provider-managed secrets. Pull requests never deploy, and the deployment script rejects production use outside GitHub Actions.

The production n8n runtime is managed separately on the Hetzner VM by the files under `ops/hetzner/`. Importable n8n workflow definitions live under `ops/n8n/workflows/`.

## Security boundaries

- no secrets in Git;
- production data remains in the private database;
- external Workers traffic requires a provider-managed password secret;
- the n8n internal email API uses its own `N8N_INGEST_TOKEN`, not the workspace password;
- the forwarding workflow needs no Gmail OAuth credentials in n8n;
- n8n receives no D1 or OpenAI credentials;
- raw MIME and attachments are not stored or exposed by the current n8n processing API;
- only a bounded readable excerpt is retained for ordinary email classification;
- external fetches accept only public HTTPS sources;
- applications are never sent by vacancy sync or analysis;
- GitHub Actions has read-only repository permissions;
- hosted credentials belong in provider-managed secrets.
