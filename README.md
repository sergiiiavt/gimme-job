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
- source sync from RSS (Dou, Djinni), Greenhouse, Lever, Ashby, Work.ua, Lobby X, and Gmail (LinkedIn/other job-alert emails);
- deterministic matching without a paid AI API, or OpenAI Agents-based matching when `OPENAI_API_KEY` is set.

The **Interview questions** module contains:

- 672 QA questions across 19 topics and 67 references, with the current total enforced as a rolling non-destructive minimum;
- an editorial Starred foundation set that remains separate from frequency-based prevalence and future personal stars;
- dedicated AI/ML/LLM, Databases/SQL/BI, Observability/Production, and Regulated-domain sections;
- four evidence-informed prevalence bands and most-common-first sorting;
- prevalence, seniority, tag, topic and full-text filters;
- 50 research and validation sources;
- a lazy-loaded catalog with at most 60 question rows rendered at once.

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

Optional GitHub repository secrets:

- `OPENAI_API_KEY` — switches the deployed `/workspace` "Analyze" action from deterministic scoring to real OpenAI-based scoring and resume/application-draft tailoring (`app/api/_jobpilot.ts`). Without it, analysis stays deterministic, same as before.
- `OPENAI_MODEL` — overrides the model used when `OPENAI_API_KEY` is set (defaults to `gpt-5.6`).

Open `/workspace` and enter the `APP_PASSWORD` value on the login page. The public homepage does not ask for a password. Basic authentication remains available for deployment scripts. Secrets are never written into source or the build artifact.

The Cloudflare deployment creates and migrates its named D1 database from the workflow. The production deployment script intentionally refuses to run outside GitHub Actions.

## Vacancy sources

`config/sources.json` (copy of `config/sources.example.json`, gitignored) configures where `npm run agent:sync` pulls vacancies from:

- **Dou, Djinni** — RSS feeds, filterable by keyword (`?search=` / `?primary_keyword=`), configured under `rss`.
- **Work.ua** — no keyword-filterable RSS exists, so `workUa` entries (`{ "name", "query" }`) scrape the public search-results page at `work.ua/en/jobs/?search=<query>`.
- **Lobby X** — `lobbyX` entries (`{ "name", "query" }`) use `thelobbyx.com`'s public WordPress REST API (`/wp-json/wp/v2/tors`) for open (non-closed) postings, then fetch each posting's page for its description.
- **LinkedIn** — no public search API/RSS exists, and scraping LinkedIn directly isn't supported. Instead, the existing `gmail` source already recognizes `linkedin.com` links inside forwarded/alert emails and tags them `gmail:linkedin`. To use it:
  1. In Gmail, create a filter/label (e.g. `LinkedInJobs`) for LinkedIn job-alert emails.
  2. Create your own Google Cloud OAuth Desktop client and save its JSON as `data/google-credentials.json` (gitignored).
  3. Run `npm run gmail:connect` once to complete the OAuth flow.
  4. Set `gmail.enabled: true` and an appropriate `gmail.query` (e.g. `label:LinkedInJobs newer_than:14d`) in `config/sources.json`.

Work.ua and Lobby X are scraped from public, unauthenticated pages rather than an official API, so their parsing is more likely to break if either site changes its markup.

## Enable AI evaluation

By default, vacancy matching is deterministic (keyword/rule-based, no external calls). Setting `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, see `.env.example`) switches `agent/src/analyst.ts` to score and draft applications through the OpenAI Agents SDK instead.

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
