# GimmeJob architecture

## Product modules

| Module | Current state | Intended responsibility |
| --- | --- | --- |
| Jobs | Functional | Vacancy inbox, relevance feedback, application pipeline |
| Interview questions | Planned | Structured interview knowledge base and practice sets |
| Certifications | Planned | Certification roadmap and progress |
| Trends | Planned | Market, vacancy, skill, and resume analysis |
| Agentic lab | Planned | Agent patterns and portfolio projects |
| LLM lab | Planned | LLM knowledge, testing, evaluation, and projects |
| Security lab | Planned | AppSec knowledge, checklists, and safe experiments |
| DevOps lab | Planned | CI/CD, cloud, containers, reliability, and observability |
| Standards | Planned | ISO, IEC, IEEE, testing, quality, and compliance references |
| News | Planned | Focused professional updates |

## Runtime

The hosted application is a React/Vinext worker with same-origin API routes. Structured data is persisted in D1 through prepared SQL statements. Drizzle owns the schema and versioned migrations.

The local agent remains separate so source collection and experimentation can run from VS Code without weakening the hosted application's approval-first behaviour.

## Delivery

GitHub Actions validates linting, local-agent types, and the production build. The private Sites checkpoint process currently publishes production. A future external hosting connection can replace only the deployment step while preserving the application, migrations, and CI checks.

## Security boundaries

- no secrets in Git;
- production data remains in the private database;
- external fetches accept only public HTTPS sources;
- applications are never sent by vacancy sync or analysis;
- GitHub Actions has read-only repository permissions;
- hosted credentials belong in provider-managed secrets.
