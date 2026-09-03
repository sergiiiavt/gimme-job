# Repository instructions for coding agents

These instructions apply to every automated coding assistant working in this repository. `AGENTS.md` is the human-readable source of truth for agent behavior; `package.json` scripts are the executable source of truth for validation. Tool-specific files such as `CLAUDE.md` and `.github/copilot-instructions.md` should point here instead of duplicating changing rules.

## Start with the requested scope

1. Read the user's request literally and identify the smallest set of files that should change.
2. Inspect `git status`, the relevant code, its tests, and all CSS selectors or API consumers connected to the change before editing.
3. Fetch the latest `origin/main` and work on a new `agent/*` branch.
4. Preserve unrelated user changes. Stage only files that belong to the task.
5. If a necessary change expands beyond the requested area, explain the dependency and keep the expansion minimal.

Do not bundle opportunistic copy rewrites, visual redesigns, backend refactors, configuration changes, or dependency upgrades into a narrow task. A green build does not prove that the requested behavior is correct.

## Product invariants

- Public interview questions, answers, sources, and learning content stay in Git. Never move the public QA catalog into D1.
- Interview content is additive. Preserve existing question IDs and titles unless the user explicitly approves a correction. Validator minimums are non-regression floors, never targets or maximums.
- Interview search applies AND logic between entered words.
- The interview catalog stays lazy-loaded and renders no more than 60 question rows simultaneously.
- D1 contains runtime vacancy data and private user state. Public routes may expose only intentionally sanitized data; progress, application state, resume contact data, and other personal data require authentication.
- Public and Personal modes must continue to route correctly and must not leak private data into public HTML, client bundles, API responses, or Git.
- Fight AI slop remains a separately loaded, client-only browser game and must not add server-side game state without an explicit request.

## Learning discovery and RAG invariants

- `content/learning-rag-registry.ts` is the single integration registry for Git-backed learning surfaces that participate in canonical RAG. Do not recreate that registry in the Worker, Python AI service, or Learning Advisor UI.
- Adding lessons, topics, or Markdown `##` sections to an already registered learning surface must require no AI-specific registration change. The canonical Worker corpus must derive those materials automatically.
- A brand-new Git-backed learning surface is registered once in `content/learning-rag-registry.ts`; consumers must validate canonical route shape rather than maintain route-by-route allow-lists.
- Preserve canonical learning deep links. Retrieval should point to the narrowest useful material with `topic`, `section`, and, when required by the page, `track` query parameters.
- Published Markdown `##` sections are first-class retrieval units. Do not collapse long learning chapters into one embedding when section-level links exist.
- Explicit `under-construction` placeholders are navigation state, not retrievable learning material.
- Changes to learning structure must be checked against both page navigation and Learning Path Advisor retrieval/linkability. A page that renders correctly but is invisible to canonical RAG is incomplete.
- Normal production deployment owns Vectorize refresh through the existing post-deploy RAG reindex. Do not introduce a manual content-publishing reindex step.
- Keep the architecture and invariants in `docs/LEARNING-RAG.md` synchronized when the learning discovery contract changes.

## Change-impact checks

When a change affects one of these areas, inspect and test the connected surface as well:

- **UI structure:** related CSS selectors, grid placement, responsive layouts, accessibility, navigation, and overflow.
- **Auth/routes:** public/private boundaries, redirects, loading races, API consumers, and rendered Worker behavior.
- **D1/schema:** `db/schema.ts`, generated Drizzle migrations/metadata, and migration compatibility.
- **Worker/API:** route contracts, validation, integration tests, and Cloudflare artifact behavior.
- **Learning/interview content:** relevant validators, stable IDs, source registries, lazy loading, render caps, canonical RAG discovery, and direct-link validity.
- **Automation/IaC:** workflow definitions, environment contracts, operational documentation, and tests.
- **Architecture/process changes:** inspect `README.md`, `docs/ARCHITECTURE.md`, developer tooling, and agent instructions. Ordinary narrow UI fixes do not require unrelated documentation edits.

## Keep UI structure and CSS in sync

When adding, removing, nesting, or reordering a rendered element:

- search for every class selector, child selector, `nth-child`, grid placement, and responsive override that depends on the old structure;
- verify desktop, tablet, and mobile layouts, including widths where the two-panel navigation is visible;
- check for horizontal overflow and unreadably narrow grid columns;
- preserve accessible names, focus behavior, selection state, and live announcements;
- test the behavior, not only source-code patterns.

## Local-agent protocol changes

Treat the browser and local agent as one protocol. A port, health, API, or CORS change is incomplete unless the server, browser discovery, health identity/version, CORS origins, configured port ranges, route contracts, and database behavior remain compatible.

Never implement availability by probing a port and binding it later; reserve the actual port by binding it and retry only appropriate bind errors.

## Required validation

During implementation, use focused tests and the faster repository checks when useful:

```text
npm run verify:fast
```

Before publishing a completed change, run the canonical local CI-equivalent verification:

```text
npm run verify
```

`npm run verify` covers linting, local-agent type checking, content and asset validators, Drizzle generation drift, the production build, Node tests with coverage, and Cloudflare artifact validation. A successful `npm run build` alone is not sufficient. GitHub Actions should not be the first place these deterministic checks are run.

SonarQube remains a remote CI gate because it requires repository credentials and the generated coverage report.

Also perform focused browser verification for user-visible changes. Before committing, inspect `git diff --check`, `git diff --stat`, and the complete diff, and confirm no unexpected files changed.

## Release workflow

- Never deploy directly from a workstation and never use ChatGPT Sites.
- Use an `agent/*` branch, a scoped commit, and a draft pull request.
- Run `npm run verify` before publishing the branch.
- Validate the remote PR diff and GitHub Actions result.
- Mark the PR ready and merge only after required checks pass.
- Production deployment occurs from the `main` GitHub Actions workflow to Cloudflare.
- Verify the live production URL and current assets after deployment.

For review-only or diagnostic requests, report findings without modifying or publishing code unless the user also asks for fixes.
