# GimmeJob

Public job and engineering knowledge base with a private vacancy-management workspace.

## Current product state

The product now has two surfaces:

- `/` — public, search-engine-indexable site with a sanitized vacancy feed and the knowledge/lab roadmap;
- `/workspace` — private job tracking and automation workspace protected on the external Cloudflare deployment.

The **Jobs** module is functional:

- vacancies are stored in a private D1 database;
- newest vacancies appear first;
- search and status filtering;
- source, original link, dates, location, salary, and description;
- pipeline statuses from `NEW` to `OFFER`, `REJECTED`, or `ARCHIVED`;
- separate `RELEVANT` / `NOT_RELEVANT` feedback for relevance tracking;
- RSS, Greenhouse, and Lever source sync;
- deterministic matching without a paid AI API.

The **Interview questions** module contains:

- 672 QA questions across 19 topics and 67 references, with the current total enforced as a rolling non-destructive minimum;
- an editorial Starred foundation set that remains separate from frequency-based prevalence and future personal stars;
- dedicated AI/ML/LLM, Databases/SQL/BI, Observability/Production, and Regulated-domain sections;
- four evidence-informed prevalence bands and most-common-first sorting;
- prevalence, seniority, tag, topic and full-text filters;
- 50 research and validation sources;
- a lazy-loaded catalog with at most 60 question rows rendered at once.

The **Python interview questions** module is functional and separate from the general QA catalog above, reached from a "QA" / "Python" toggle inside Interview questions rather than its own nav button:

- 133 bilingual (English/Ukrainian) questions across 13 topics and 42 sources, a rolling non-destructive minimum;
- reuses the QA catalog's search, prevalence, seniority, tag and full-text filters through the same lazy-loaded component;
- questions are namespaced with a `py-` ID prefix, so personal progress tracking works for both catalogs with no schema change.

The **Programming** module (renamed from "Programming for QA") is functional and now shows the full Python learning path:

- 64 bilingual lessons across 15 modules, Beginner through Expert, each with a runnable code sample, key points, common pitfalls, and a practice exercise;
- a stable "learning order" across the whole curriculum, sortable alongside level and title, plus full-text filters and a "Sources & methodology" tab, using the same lazy-loaded, capped-rendering approach as the interview catalogs.

The navigation also contains planned knowledge modules:

- Interview questions;
- Certifications;
- Trends;
- Agentic lab;
- LLM lab;
- Security lab;
- DevOps lab;
- Standards;
- News.

## Architecture

- `app/` — React/Vinext user interface and cloud API;
- `db/schema.ts` — D1 schema;
- `drizzle/` — versioned database migrations;
- `agent/` — optional local collection and analysis agent;
- `.github/workflows/ci.yml` — GitHub validation and Cloudflare deployment pipeline;
- `.vscode/` — recommended extensions, tasks, settings, and debugger launch profile.

The only production deployment path is GitHub Actions → Cloudflare Workers + D1. Public interview content remains in Git; D1 stores private vacancy data, interview progress, notes and bookmarks.

## VS Code setup

Requirements: Node.js 22.22 or newer, npm, Git, and VS Code.

```bash
npm install
npm run local
```

Open `http://localhost:4173` after both local processes start.

VS Code shortcuts:

- `Ctrl+Shift+B` — run the local app;
- **Run and Debug → GimmeJob: Run in VS Code** — start from the debugger panel;
- **Terminal → Run Task** — lint, type-check, or create a production build.

On Windows PowerShell, if `npm.ps1` is blocked, use `npm.cmd install` and `npm.cmd run local`.

## Quality checks

```bash
npm run lint
npm run check:agent
npm run build
npm run check:cloudflare
```

The same commands run in GitHub Actions for every pull request and push to `main` after this version is pushed to GitHub.

## Cloudflare CI/CD

After the three repository secrets below are configured, every successful push to `main` automatically:

1. validates and builds the application;
2. finds or creates the `gimmejob-db` D1 database;
3. applies all migrations from `drizzle/`;
4. deploys the Worker and static assets;
5. keeps `/` and `/api/public/jobs` public;
6. protects `/workspace` and all private API/write operations with a signed password session.

Required GitHub repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`;
- `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, D1 Edit, and Cloudflare Images Edit permissions;
- `APP_PASSWORD`, at least 16 characters.

Open `/workspace` and enter the `APP_PASSWORD` value on the login page. The public homepage does not ask for a password. Basic authentication remains available for deployment scripts. Secrets are never written into source or the build artifact.

The Cloudflare deployment creates and migrates its named D1 database from the workflow. The production deployment script intentionally refuses to run outside GitHub Actions.

## Database changes

Edit `db/schema.ts`, then generate and inspect a migration:

```bash
npm run db:generate
```

Even a new database needs the initial migration: it creates the first set of tables. Every later schema change gets a new ordered migration so local, test, and production databases can be reproduced safely. Never commit `.env`, OAuth credentials, tokens, or files from `data/`.

## Deployment model

1. push to `main`;
2. GitHub Actions validates and builds;
3. the deployment script provisions D1 if needed, applies migrations, deploys the Worker, and updates the private-workspace password.

## Public address

The free address follows `<worker>.<account-subdomain>.workers.dev`. The account subdomain can be renamed in **Cloudflare Dashboard → Workers & Pages → Change next to Your subdomain**; that change affects every Worker in the account. An owned domain can instead be attached from the Worker's **Settings → Domains & Routes → Add Custom Domain** after the domain is active in Cloudflare.

The Cloudflare Free plan is enough for an early personal prototype within its usage limits. Keep all production credentials in GitHub and Cloudflare secret stores, never in source control.
