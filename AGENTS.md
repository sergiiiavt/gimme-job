# Repository instructions for coding agents

These instructions apply to every automated coding assistant working in this repository, including GitHub Copilot in VS Code.

## Start with the requested scope

1. Read the user's request literally and identify the smallest set of files that should change.
2. Inspect `git status`, the relevant code, its tests, and all CSS selectors or API consumers connected to the change before editing.
3. Fetch the latest `origin/main` and work on a new `agent/*` branch.
4. Preserve unrelated user changes. Stage only files that belong to the task.
5. If a necessary change expands beyond the requested area, explain the dependency before proceeding and keep the expansion minimal.

Do not bundle opportunistic copy rewrites, visual redesigns, backend refactors, configuration changes, or dependency upgrades into a narrow task. A green build does not prove that the requested behavior is correct; review the complete diff and test the affected workflow.

## Product invariants

- Public interview questions, answers, sources, and learning content stay in Git. Never move the public QA catalog into D1.
- Interview content is additive. Preserve every existing question ID and title unless the user explicitly approves a correction. The current 672-question validation floor is a rolling minimum, never a target or maximum.
- The catalog generator may add questions to satisfy coverage floors; it must never delete existing questions to keep a fixed count.
- Interview search applies AND logic between entered words.
- The interview catalog stays lazy-loaded and renders no more than 60 question rows simultaneously.
- D1 contains runtime vacancy data and private user state. Public routes may expose only the intentionally sanitized vacancy projection; progress, application state, resume contact data, and other personal data require authentication.
- Public and Personal modes must continue to route correctly and must not leak private data into public HTML, client bundles, API responses, or Git.
- Fight AI slop remains a separately loaded, client-only browser game and must not add server-side game state without an explicit request.

## Keep UI structure and CSS in sync

When adding, removing, nesting, or reordering a rendered element:

- search for every class selector, child selector, `nth-child`, grid placement, and responsive override that depends on the old structure;
- verify desktop, tablet, and mobile layouts, including widths where the two-panel navigation is visible;
- check for horizontal overflow and unreadably narrow grid columns;
- preserve accessible names, focus behavior, selection state, and live announcements;
- test the behavior, not only source-code patterns.

Do not remove a grid child or wrap a link in a new container without updating and verifying all matching CSS rules.

## Local-agent protocol changes

Treat the browser and local agent as one protocol. A port, health, API, or CORS change is incomplete unless all affected pieces agree:

- the server must reserve the actual port by binding it and retry only appropriate bind errors;
- browser discovery, configured port ranges, health identity/version, CORS origins, and recovery after agent restart must remain compatible;
- discovery must select the agent for the same checkout and database, not an unrelated or stale process;
- local API routes used by the UI must match the cloud route's request, validation, and response behavior;
- SQLite read/merge/write operations shared by more than one process must be atomic and preserve independent fields.

Never implement availability by probing a port and binding it later; that creates a race.

## Required validation

Run all of these before publishing a completed change:

```text
npm run check:content
npm run lint
npm run check:agent
npm run build
node --test
npm run check:cloudflare
```

Also perform focused browser verification for user-visible changes. At minimum, check the changed page, its relevant responsive states, navigation, and horizontal overflow. For interview changes, confirm the full catalog count, stable IDs, AND search, lazy loading, and the 60-row render cap.

Before committing:

- inspect `git diff --check`, `git diff --stat`, and the complete diff;
- confirm no unexpected files changed;
- confirm no existing interview IDs were removed;
- confirm Node tests work with the version declared in `package.json` and CI.

## Release workflow

- Never deploy directly from a workstation and never use ChatGPT Sites.
- Use an `agent/*` branch, a scoped commit, and a draft pull request.
- Validate the remote PR diff and wait for GitHub Actions to pass.
- Mark the PR ready, merge it, then wait for the `main` GitHub Actions run to deploy through Cloudflare.
- Verify the live production URL and its current assets after deployment.
- Completed requested changes should be deployed through this workflow without waiting for a second request.

For review-only or diagnostic requests, report findings without modifying or publishing code unless the user also asks for fixes.
