# GimmeJob

Public career-engineering hub with a private workspace for collecting vacancies, tracking applications, analysing the market, and building professional knowledge bases.

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
- separate `RELEVANT` / `NOT_RELEVANT` feedback for future agent learning;
- RSS, Greenhouse, and Lever source sync;
- deterministic matching without a paid AI API.

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
- `.vscode/` — recommended extensions, tasks, settings, and debugger launch profile;
- `.openai/hosting.json` — temporary compatibility configuration for the existing Sites checkpoint and its separate D1 binding.

The canonical deployment path is GitHub Actions → Cloudflare Workers + D1. The older Sites deployment remains as a separate checkpoint until the external Cloudflare site and its address are confirmed, then its compatibility configuration can be removed in a dedicated cleanup.

## VS Code setup

Requirements: Node.js 22.13 or newer, npm, Git, and VS Code.

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
6. protects `/workspace` and all private API/write operations with HTTP Basic authentication.

Required GitHub repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`;
- `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, D1 Edit, and Cloudflare Images Edit permissions;
- `APP_PASSWORD`, at least 16 characters.

At the `/workspace` login prompt, use `gimmejob` as the username and the `APP_PASSWORD` secret as the password. The public homepage does not ask for a password. Secrets are never written into source or the build artifact.

The Cloudflare deployment creates its own D1 database. Data in the existing private Sites database is not copied automatically.

For a one-off deployment from VS Code, put the same three values in the terminal environment and run:

```bash
npm run deploy:cloudflare
```

## Database changes

Edit `db/schema.ts`, then generate and inspect a migration:

```bash
npm run db:generate
```

Even a new database needs the initial migration: it creates the first set of tables. Every later schema change gets a new ordered migration so local, test, and production databases can be reproduced safely. Never commit `.env`, OAuth credentials, tokens, or files from `data/`.

## Deployment models

Temporary Sites checkpoint flow:

1. validate the application;
2. build a Cloudflare-compatible worker artifact;
3. apply D1 migrations;
4. publish an immutable private Sites version.

Canonical Cloudflare flow:

1. push to `main`;
2. GitHub Actions validates and builds;
3. the deployment script provisions D1 if needed, applies migrations, deploys the Worker, and updates the private-workspace password.

## Public address

The free address follows `<worker>.<account-subdomain>.workers.dev`. The account subdomain can be renamed in **Cloudflare Dashboard → Workers & Pages → Change next to Your subdomain**; that change affects every Worker in the account. An owned domain can instead be attached from the Worker's **Settings → Domains & Routes → Add Custom Domain** after the domain is active in Cloudflare.

The Cloudflare Free plan is enough for an early personal prototype within its usage limits. Keep all production credentials in GitHub and Cloudflare secret stores, never in source control.
