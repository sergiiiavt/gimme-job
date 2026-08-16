# Claude Code instructions for GimmeJob

Read and follow the repository-root `AGENTS.md` before editing. It is the authoritative repository policy for scope, product invariants, testing, and release behavior.

Do not maintain a separate copy of those rules here.

Before publishing a completed change:

```text
npm run verify
```

Use `npm run verify:fast` and focused tests while iterating. A successful build alone is not sufficient, and CI should not be the first full verification run.
