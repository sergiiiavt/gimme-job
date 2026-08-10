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
- `.github/workflows/ci.yml` — GitHub validation pipeline;
- `.vscode/` — recommended extensions, tasks, settings, and debugger launch profile;
- `.openai/hosting.json` — private Sites deployment and D1 binding.

Production currently runs as a private Sites deployment. Its database and HTTPS address are managed by Sites. The code is ready for GitHub CI, but the current Sites deployment is not automatically triggered by pushes to GitHub.

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
```

The same commands run in GitHub Actions for every pull request and push to `main` after this version is pushed to GitHub.

## Database changes

Edit `db/schema.ts`, then generate and inspect a migration:

```bash
npm run db:generate
```

Never commit `.env`, OAuth credentials, tokens, or files from `data/`.

## Deployment model

Current production flow:

1. validate the application;
2. build a Cloudflare-compatible worker artifact;
3. apply D1 migrations;
4. publish an immutable private Sites version.

To get true `push to main → deploy` from the public GitHub repository, connect the repository to a supported hosting account and add its deployment credentials as GitHub secrets. Keep production secrets in the hosting provider, not in source control.
