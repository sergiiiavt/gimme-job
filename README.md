# GimmeJob

Private career workspace for collecting vacancies, tracking applications, analysing the market, and building professional knowledge bases.

## Current product state

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
- `.openai/hosting.json` — private Sites deployment and D1 binding.

Production currently runs as a private Sites deployment. Its database and HTTPS address are managed by Sites. The repository also contains an independent Cloudflare Workers deployment path for true GitHub-driven CI/CD.

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
5. protects the public Worker address with HTTP Basic authentication.

Required GitHub repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`;
- `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit, D1 Edit, and Cloudflare Images Edit permissions;
- `APP_PASSWORD`, at least 16 characters.

At the external Worker login prompt, use `gimmejob` as the username and the `APP_PASSWORD` secret as the password. Secrets are never written into source or the build artifact.

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

Never commit `.env`, OAuth credentials, tokens, or files from `data/`.

## Deployment models

Private Sites flow:

1. validate the application;
2. build a Cloudflare-compatible worker artifact;
3. apply D1 migrations;
4. publish an immutable private Sites version.

External Cloudflare flow:

1. push to `main`;
2. GitHub Actions validates and builds;
3. the deployment script provisions D1 if needed, applies migrations, deploys the Worker, and updates its private access password.

The Cloudflare Free plan is enough for an early personal prototype within its usage limits. Keep all production credentials in GitHub and Cloudflare secret stores, never in source control.
