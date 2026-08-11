# GitHub Copilot instructions for GimmeJob

Read and follow the repository-root `AGENTS.md` before editing. It is the detailed source of truth for scope, product invariants, testing, and deployment.

Critical rules for every VS Code Copilot task:

- Make the smallest change that fully satisfies the request. Do not combine a visual adjustment with unrelated copy, backend, database, CI, port, or dependency changes.
- Inspect the complete dependency chain before editing. If JSX structure changes, audit every related CSS grid, child selector, breakpoint, and accessible state. If a local-agent API changes, audit the browser client, health handshake, discovery, CORS, configuration, database update, and tests together.
- Preserve all existing interview question IDs. The catalog is additive, its validated count may grow, search uses AND between words, it remains lazy-loaded, and no more than 60 question rows may render at once.
- Keep public QA content in Git and private user data behind authenticated D1 routes. Never expose private resume details, progress, or application state publicly.
- Review actual behavior in a browser at relevant desktop and mobile widths. Do not rely only on compilation or regex/source-shape tests.
- Run `npm run check:content`, `npm run lint`, `npm run check:agent`, `npm run build`, `node --test`, and `npm run check:cloudflare` before publishing.
- Use an `agent/*` branch and draft PR. Production deployment is only GitHub Actions to Cloudflare. Never deploy locally and never use ChatGPT Sites.

Before proposing a commit, inspect the full diff and remove unrelated changes. In the PR description, list any file outside the obvious task area and explain why it was necessary.
