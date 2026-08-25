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

## AI assistant and canonical RAG boundary

The `ai-service/` is a separate Python service rather than another Cloudflare Worker route. The generic `/v1/chat` path uses LangChain's agent/model integration. The dedicated `/v1/learning-path` path uses LangGraph `StateGraph` directly: contextualize a conversation query, retrieve canonical GimmeJob context, choose a grounded or clearly labelled general branch, compose typed output through LangChain/OpenAI, then verify source attribution and graph connectivity. The web UI renders the final answer, source-backed learning cards, and a connected learning map.

GimmeJob has **one retrieval system**. `worker/rag.ts` owns the canonical corpus and retrieval policy for learning material, QA/Python interview questions, and jobs. Git and D1 remain authoritative data sources. Cloudflare Workers AI produces multilingual BGE-M3 embeddings and Vectorize provides semantic candidate ranking when its bindings are available. Lexical ranking is a resilience mode inside the same canonical pipeline, not a second RAG implementation. Every consumer receives the same retrieval strategy/result contract.

The canonical Worker RAG is used by MCP tools and by the Python AI service. The Python service calls the authenticated `/internal/rag/search` endpoint with `GIMMEJOB_AI_RAG_SERVICE_TOKEN`; the Worker checks the matching `GIMMEJOB_RAG_SERVICE_TOKEN`. The previous Python-local lexical content retriever is removed. This keeps retrieval scoring, thresholds, corpus composition, Python/QA interview coverage, and Vectorize fallback behavior in one place.

The AI service is a server-to-server boundary. Its `/v1/chat`, `/v1/learning-path`, and interview endpoints require an independent bearer token and must not be called directly from browser code. The authenticated GimmeJob Worker routes proxy browser requests so the AI service credential never reaches the client. The Python service has no D1 access, no private user-state access, and no write/action tools; learning-path requests do not persist plans. `/health` exposes readiness flags only and never secrets.

## Langfuse observability and RAG evaluation

Langfuse is observability/evaluation infrastructure and must not be a runtime dependency for successful answers. When `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are configured, the learning advisor creates one root trace around the LangGraph execution. LangChain callbacks attach model generations to that trace; supported model calls expose token usage and Langfuse model definitions turn usage into per-generation/trace cost.

The learning-path trace records the canonical retrieval strategy, embedding model, retrieved IDs/titles/scores, request/session metadata, model output, and deterministic production scores such as map connectivity, retrieval result count/top score, grounded-node ratio, and source validity. If Langfuse initialization or scoring fails, answer delivery continues.

Offline retrieval evaluation uses labeled expected source IDs and the deterministic metrics in `ai-service/src/gimmejob_ai/rag_metrics.py`: Precision@K, Recall@K, Hit Rate@K, reciprocal rank/MRR, and nDCG@K. Langfuse datasets/experiments are the intended place to aggregate those metrics across regression suites. Semantic answer metrics such as faithfulness/groundedness, answer relevance, completeness/correctness, and citation quality should be attached as Langfuse scores through evaluator jobs (for example LLM-as-a-Judge or Ragas), rather than being embedded into the production answer path. Retrieval thresholds are therefore evaluation-tuned configuration candidates, not product assumptions.

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

The production Hetzner VM is managed by the files under `ops/hetzner/`. n8n and the Python AI service share the private Docker network but expose no application ports directly on the host; Caddy publishes only HTTP/HTTPS and proxies `n8n.gimme-job.com` to n8n and `ai.gimme-job.com` to `gimmejob-ai:8000`. The trusted `ai-image.yml` workflow builds and publishes the AI image to GHCR. On `main` pushes or a manual dispatch, its deployment job then copies the protected AI runtime environment to the VM over SSH, pulls the public GHCR image, starts the Compose `ai` profile, reloads Caddy, and verifies `/health`. Pull-request runs build the image only and never receive production deployment secrets. The initial activation requires the deployment SSH key and AI/Langfuse secrets to be configured in GitHub. The Worker uses `GIMMEJOB_AI_URL=https://ai.gimme-job.com` and its independent service token to reach the service.

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
- the AI service endpoints require an independent server-to-server token and remain read-only;
- canonical RAG search uses a separate service token from AI-service browser proxy authentication and MCP authentication;
- Langfuse credentials stay in runtime secrets and are never returned by health or AI responses;
- GitHub Actions has read-only repository permissions;
- hosted credentials belong in provider-managed secrets.
