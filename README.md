# GimmeJob

GimmeJob is a production QA career and learning platform, technology playground, and job-search workspace.

It combines public QA learning content, interview preparation, an AI learning/interview assistant, vacancy workflows, personal career tools, observability, automation, and infrastructure experiments in one real deployed project.

- Production: https://gimme-job.com
- Repository: https://github.com/sergiiiavt/gimme-job
- Architecture details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- AI service details: [`ai-service/README.md`](ai-service/README.md)

## Why this project exists

GimmeJob has four practical goals:

1. **Find a job** — collect, review, classify, analyze, and track relevant vacancies.
2. **Create a technology playground** — use a real production system to learn and integrate modern technologies.
3. **Use AI-assisted development** — build and maintain the project with AI coding tools as part of the normal engineering workflow.
4. **Build a QA knowledge base** — maintain structured interview questions, learning paths, references, and practical QA material.

## Current product

The public site is no longer a single vacancy page with a separate private workspace. It is a multi-section application with public learning/career content plus authenticated personal state where required.

### Career

Current career-oriented surfaces include:

- **Vacancies** — aggregated vacancy review, filtering, relevance feedback, analysis, and application-state workflows.
- **My Resume** — the resume/CV surface used by the career workflow.
- **Interview questions** — public QA, SQL, and Python interview catalogs with filtering, references, bilingual content where supported, and private personal progress/star state.
- **AI Assistant** — public session-scoped AI flows for learning-path generation and interview practice. Authenticated use may add private/persistent context, while public sessions do not expose private user data.
- **Trends** — market/career analysis work that is available on the site while parts of the section remain under construction.

### Learning and reference content

The site contains a growing set of real learning/reference areas rather than the old README's list of mostly planned modules. Current content spans areas such as:

- QA fundamentals and test process;
- certifications and trainings;
- generative AI, LLMs, AI agents, MCP, and AI testing;
- Python/programming and quick references;
- test automation and testing tools;
- API and integration testing;
- databases, SQL, and BI;
- mobile and accessibility testing;
- embedded, IoT, and hardware-oriented QA;
- performance and security testing;
- cloud, DevOps, CI/CD, and observability;
- networking and Linux;
- standards and regulated-domain references;
- metrics, estimation, strategy, and risk.

Content maturity is intentionally not binary. A page can be available while still marked **Under construction** or **Under review** as the material is expanded and validated.

Public learning/interview content is versioned in Git. Private user-specific progress, stars, application state, and other personal runtime data stay outside the public content bundle.

### Miscellaneous / experiments

GimmeJob also hosts experiments that are deliberately separate from the core career flows, including the client-only **Fight AI slop** browser game. These are part of the technology-playground goal and must not be confused with server-side job or learning state.

## AI Assistant and canonical RAG

GimmeJob has a separate Python AI backend in [`ai-service/`](ai-service/).

The current AI stack is:

- **FastAPI** — authenticated Python service boundary;
- **LangGraph** — explicit workflow/state orchestration;
- **LangChain + langchain-openai** — messages, model integration, and structured output;
- **OpenAI** — structured generation/evaluation;
- **Langfuse** — tracing, token/cost observability, runtime scores, datasets, and evaluation support;
- **Cloudflare Workers AI + Vectorize** — semantic retrieval in the canonical GimmeJob RAG pipeline;
- **lexical fallback** — resilience inside the same canonical retrieval pipeline when semantic infrastructure is unavailable.

The project intentionally has **one canonical retrieval system**. The Worker owns corpus composition and retrieval policy; the Python AI service does not maintain a second independent content index.

The learning-path workflow is roughly:

```text
conversation
  -> contextualize query
  -> canonical Worker RAG
  -> grounded/general composition branch
  -> LangChain/OpenAI structured response
  -> grounding/source/map verification
  -> UI learning cards + connected learning path
```

The AI backend is read-only with respect to GimmeJob application state. Browser code does not receive the AI service token: browser requests are proxied through authenticated/same-origin GimmeJob routes.

The canonical RAG service and the AI-service browser proxy use separate server-to-server credentials.

For implementation and evaluation details, see [`ai-service/README.md`](ai-service/README.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Vacancy and email automation

Vacancy collection and email processing are separate from code deployment.

The repository includes a local/source agent under [`agent/`](agent/) for configurable vacancy collection, analysis, market inspection, and experimentation. Deterministic matching is available without a paid model call; configured OpenAI integration can add structured analysis and drafting.

The production email-ingestion path uses forwarding rather than giving n8n direct Gmail credentials:

```text
Gmail filter
  -> per-user jobs+TOKEN@gimme-job.com address
  -> Cloudflare Email Routing
  -> GimmeJob Worker email handler
  -> tenant-scoped event in D1
  -> n8n classification workflow
  -> deterministic rule fast paths / OpenAI when needed
  -> structured result persisted in D1
```

A separate n8n workflow produces the daily operational email report. GimmeJob D1 remains the system of record; n8n orchestrates processing but does not own application business state.

See [`docs/n8n-gmail-integration.md`](docs/n8n-gmail-integration.md) and [`ops/n8n/`](ops/n8n/) for the production workflow definitions.

## Architecture

The production system has two main runtime areas.

### Cloudflare application runtime

The main web application is deployed from GitHub Actions to Cloudflare and contains:

- React / Next-compatible Vinext application code under [`app/`](app/);
- Cloudflare Worker runtime and same-origin API routes;
- static assets deployed with the Worker;
- Cloudflare D1 for application/runtime state;
- Drizzle schema and ordered migrations;
- canonical RAG endpoints;
- Workers AI / Vectorize integration when configured;
- Cloudflare Email Routing integration for forwarded vacancy/job emails.

Public learning/interview content remains versioned in Git. D1 is used for private/runtime data such as vacancies, analyses, settings, email events, and user-specific state.

### Hetzner AI and automation runtime

The production VM configuration lives under [`ops/hetzner/`](ops/hetzner/).

The Hetzner environment hosts containerized supporting services, including:

- the Python `gimmejob-ai` FastAPI service;
- n8n;
- PostgreSQL for n8n;
- Caddy as the public HTTP/HTTPS reverse proxy.

Application/database container ports remain private to the Docker network. Caddy exposes the public HTTPS boundaries such as `ai.gimme-job.com` and `n8n.gimme-job.com`.

The infrastructure is reproducible from repository code and GitHub Actions rather than being treated as a manually configured server.

## Repository layout

Key directories/files:

- `app/` — web UI, route handlers, public content integration, and Worker-facing application logic;
- `worker/` — Worker runtime integration including canonical retrieval behavior;
- `content/` — Git-versioned QA/interview/learning material;
- `ai-service/` — FastAPI + LangGraph/LangChain AI backend and tests;
- `agent/` — local vacancy collection/analysis agent;
- `db/schema.ts` — D1/Drizzle schema;
- `drizzle/` — ordered database migrations;
- `ops/n8n/` — versioned n8n workflows;
- `ops/hetzner/` — production VM provisioning, Compose, and runtime configuration;
- `.github/workflows/` — CI, deployment, AI image, infrastructure, and operational workflows;
- `.vscode/` — recommended settings/tasks/debug profiles;
- `AGENTS.md` — repository-wide instructions for coding agents;
- `docs/ARCHITECTURE.md` — detailed architecture/security/delivery boundaries.

## Technology stack

The project currently uses or integrates:

### Web / application

- TypeScript
- React 19
- Next.js-compatible Vinext
- Vite
- Cloudflare Workers
- Cloudflare D1
- Drizzle ORM / Drizzle Kit
- Cloudflare Workers AI
- Cloudflare Vectorize
- Cloudflare Email Routing

### AI / RAG

- Python
- FastAPI
- LangGraph
- LangChain
- OpenAI
- Langfuse
- canonical Worker RAG with semantic ranking and lexical fallback

### Automation / infrastructure

- n8n
- PostgreSQL
- Docker / Docker Compose
- Caddy
- Hetzner Cloud
- GitHub Actions
- GHCR

### Quality / observability

- ESLint
- Node test runner + LCOV coverage
- Python `unittest`
- Locust read-only performance workloads
- SonarQube Cloud
- Grafana Cloud
- Cloudflare Workers Logs / observability
- repository-specific content, asset, migration, and deployment validators

## Local development

### Main application

Requirements:

- Node.js 22.22 or newer;
- npm;
- Git.

Install and run:

```bash
npm install
npm run local
```

The local web application uses `http://localhost:4173` when started through the repository scripts.

Useful VS Code entrypoints:

- `Ctrl+Shift+B` — run the local app;
- **Run and Debug -> GimmeJob: Run in VS Code** — start from the debugger panel;
- **Terminal -> Run Task -> GimmeJob: Verify like CI** — run the deterministic validation suite.

On Windows PowerShell, if `npm.ps1` execution is blocked, use `npm.cmd` instead.

### AI service

The AI service has its own Python environment and dependencies:

```bash
cd ai-service
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows:
# .venv\Scripts\activate
python -m pip install -e .
```

Run the main GimmeJob Worker locally when testing canonical RAG integration, configure the values documented in [`ai-service/.env.example`](ai-service/.env.example), then start FastAPI:

```bash
uvicorn gimmejob_ai.main:app --reload --port 8000
```

See [`ai-service/README.md`](ai-service/README.md) for the service-auth, canonical-RAG, OpenAI, and Langfuse configuration contract.

### Performance testing

The authorized read-only Locust workload for the public GimmeJob surface,
including local commands, production safety guards, Azure Load Testing setup,
and current VUH cost notes, lives in
[`tests/performance/gimmejob/`](tests/performance/gimmejob/README.md).

## Quality checks

During implementation:

```bash
npm run verify:fast
```

Before publishing a completed change:

```bash
npm run verify
```

`npm run verify` is the deterministic validation contract for the TypeScript/Worker application. It covers linting, local-agent type checking, content and asset validators, Drizzle generation drift, the production build, Node tests with LCOV coverage, and Cloudflare artifact validation.

The Python AI service has its own tests:

```bash
cd ai-service
python -m unittest discover -s tests -v
```

Pull-request CI runs the canonical repository checks, the Python AI-service tests, and the credentialed SonarQube Cloud quality gate.

`package.json` is the executable source of truth for current Node-side validation commands; `AGENTS.md` defines the repository-wide engineering/release policy.

## Database changes

Edit [`db/schema.ts`](db/schema.ts), then generate and inspect a migration:

```bash
npm run db:generate
```

Every schema change must be represented by an ordered migration so local, test, and production databases can be reproduced safely.

Never commit `.env`, OAuth credentials, API keys, tokens, or other runtime secrets.

## CI/CD and deployment

Production changes follow the pull-request path:

1. create a scoped branch and pull request;
2. run the deterministic validation suite;
3. PR CI validates the main application, AI-service tests, and SonarQube quality gate;
4. merge only after required checks pass;
5. the production workflows deploy the validated `main` revision;
6. lightweight post-deploy health/smoke checks verify the released services.

The main Cloudflare web application and the supporting Hetzner services have separate deployment responsibilities.

### Main application

GitHub Actions builds the `main` commit, applies D1 migrations, deploys the Worker/static assets/runtime secrets, and checks the production site and health endpoint.

Production deployment does not rerun the full PR validation suite after merge. A separate code-quality workflow can refresh the SonarQube `main` baseline without gating the release.

### AI service

The trusted AI-image workflow builds the `ai-service` Docker image and publishes it to GHCR. Production deployment pulls the image on the Hetzner VM, starts/restarts the AI Compose profile, reloads Caddy when required, and verifies `/health`.

Pull-request AI-image jobs build/test without receiving production deployment secrets.

### n8n / Hetzner infrastructure

Infrastructure and n8n runtime configuration are versioned under `ops/hetzner/` and `ops/n8n/`. Provisioning/deployment workflows configure the VM, firewall, Cloudflare DNS, Docker runtime, and versioned workflows from repository-controlled definitions.

Production credentials belong in GitHub/Cloudflare/provider-managed secret stores, never in source control.

## Security boundaries

Important project invariants include:

- no secrets in Git;
- public content must not expose private user state;
- public interview/learning content remains in Git;
- private vacancy/application/progress data stays behind authenticated runtime boundaries;
- the AI service is server-to-server authenticated and read-only with respect to application state;
- canonical RAG uses an independent service credential;
- n8n receives no D1 or OpenAI master credentials;
- n8n does not own GimmeJob business state;
- forwarded email storage is bounded and raw MIME/attachments are not treated as application content;
- external fetches are restricted to safe public sources by the application boundary;
- vacancy sync/analysis does not automatically send job applications;
- production deployment occurs through GitHub Actions rather than from developer workstations.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full security and service-boundary description.

## Documentation policy

This README describes the current product at a durable capability level. It intentionally avoids hard-coding fast-changing totals such as exact numbers of questions, lessons, topics, or sources.

Catalog validators use non-regression floors, not product maximums. When exact current counts matter, the live site and Git-versioned content are the source of truth.
