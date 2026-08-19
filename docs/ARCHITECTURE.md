# GimmeJob architecture

## Product modules

| Module | Current state | Intended responsibility |
| --- | --- | --- |
| Jobs | Functional | Vacancy inbox, application pipeline |
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

## AI assistant boundary

The new `ai-service/` is a separate Python service rather than another Cloudflare Worker route. Its first milestone uses FastAPI, LangChain, OpenAI, and optional Langfuse Cloud tracing. LangChain `create_agent` owns the initial model/tool loop; GimmeJob does not use the direct LangGraph API yet. The service returns structured responses that can later be rendered as knowledge, learning, interview, and hint cards in the web UI.

The first tool is read-only `search_site_content`, backed by deterministic lexical search over the existing Git-versioned Markdown under `content/`. This deliberately preserves the public-content source of truth and establishes a stable tool contract that can later move to embeddings plus PostgreSQL/pgvector without changing the assistant API.

The AI service is a server-to-server boundary. `/v1/chat` requires its own bearer token and must not be called directly from browser code; a future authenticated GimmeJob Worker proxy will call it so the service credential never reaches the client. The first milestone has no D1 access, no private user-state access, and no write/action tools. `/health` exposes readiness flags only and never secrets.

Langfuse is observability only and must not be a runtime dependency for successful answers. When `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are configured, LangChain callbacks emit traces, request metadata, session IDs, model calls, and tool calls to Langfuse Cloud. If Langfuse is absent or its callback cannot initialize, the assistant continues without tracing.

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

`AGENTS.md` is the cross-agent repository policy. Tool-specific entrypoints such as `CLAUDE.md` and `.github/copilot-instructions.md` defer to it instead of maintaining independent copies. `package.json` is the executable validation source of truth for the existing TypeScript/Worker application: `npm run verify:fast` is intended for iteration and `npm run verify` mirrors all deterministic CI checks that can run without repository secrets. The Python AI service has its own `unittest` suite under `ai-service/tests`; pull-request CI installs the service and runs that suite in addition to `npm run verify`.

Delivery has two intentionally separate workflows. Pull requests run `npm run verify`, the Python AI-service tests, and then the credentialed SonarQube Cloud quality gate. After a validated PR is merged, the production workflow builds the actual `main` commit, applies D1 migrations, uploads the Worker and runtime secrets in one Wrangler deployment, and performs lightweight production smoke checks. Production deployment does not repeat lint, tests, coverage, the Cloudflare dry run, or Sonar analysis.

The code-quality workflow also refreshes SonarQube Cloud's `main` baseline after each merge. That refresh runs only the build and coverage collection needed for accurate Sonar main-branch and future PR comparisons; it does not rerun the full repository verification and it does not gate or serialize production deployment.

Production deployments are serialized and are not cancelled by newer `main` pushes. Vacancy synchronization remains a separate scheduled operational workflow rather than part of code deployment. Pull requests never deploy, and the deployment script rejects production use outside GitHub Actions.

The production n8n runtime is managed separately on the Hetzner VM by the files under `ops/hetzner/`. Importable n8n workflow definitions live under `ops/n8n/workflows/`. The AI service is container-ready but is not added to the production Hetzner compose stack in this milestone; that deployment remains a separate follow-up after its service secret and Langfuse Cloud project are configured.

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
- the AI service chat endpoint requires an independent server-to-server token and remains read-only in its first milestone;
- Langfuse credentials stay in runtime secrets and are never returned by health or chat responses;
- GitHub Actions has read-only repository permissions;
- hosted credentials belong in provider-managed secrets.
