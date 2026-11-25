# Claude Code configuration & workflows

20% of CCAR-F. Expect questions about where configuration lives, who it applies to, and how Claude Code behaves in automation.

## The CLAUDE.md hierarchy

| Location | Scope | Shared with the team? |
| --- | --- | --- |
| `~/.claude/CLAUDE.md` | Every project for one user | No |
| `CLAUDE.md` or `.claude/CLAUDE.md` in the repository | The project | Yes, when committed |
| `CLAUDE.md` in a subdirectory | Files under that directory | Yes, when committed |

Use `@path` imports to split a large CLAUDE.md into focused files, and `/memory` to see which files loaded. A classic exam trap: "a new teammate's Claude ignores our conventions" means the conventions live in someone's user-level file.

## Path-scoped rules

Files in `.claude/rules/` can declare a `paths` glob in their frontmatter, for example `**/*.test.tsx`. The rules then apply to matching files wherever they live. A subdirectory CLAUDE.md cannot follow a file pattern across 40 folders, and putting the rules in the root CLAUDE.md loads them for every file.

## Commands and skills

- **Custom commands** in `.claude/commands/` are committed and shared; `~/.claude/commands/` holds personal ones.
- **Skills** live in `.claude/skills/<name>/SKILL.md`. Frontmatter such as `context: fork` runs the skill in an isolated subagent, so verbose output never reaches the main session, and `allowed-tools` pre-approves listed calls for the invoking turn; it does not remove other callable tools. Separate permission settings govern other calls. See the [official skill contract](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill).

## Plan mode or direct execution

Use **plan mode** for large, ambiguous or multi-file changes and for architecture decisions: Claude explores and proposes before editing. Use **direct execution** for a clear, well-scoped fix. Delegate verbose codebase exploration to a subagent to keep the main context clean.

## Claude Code in CI/CD

- `claude -p` (print mode) runs non-interactively. Without it a CI job hangs waiting for input that never comes.
- `--output-format json`, with a JSON schema for findings, gives the pipeline machine-readable output to post as inline comments.
- The project CLAUDE.md supplies testing and review standards to the CI run.
- Review with a **fresh instance**, not the session that wrote the code: the author session shares its own blind spots.
- Pass previous findings into each run and ask only for new or unresolved issues, so every push does not repeat the same comments.
- Give the reviewer existing tests so it does not generate duplicates.

## Worked example

A GitHub Actions review step times out every run. Raising the timeout or using a bigger runner treats the symptom. The cause is interactive mode: switch to `claude -p` with JSON output.

## Minimal repository workflow

In a scratch copy, inspect the discount requirement and existing tests first. Add the missing subtotal-100 case before changing > to >=. Run the focused tests, inspect the diff and run the repository’s required checks. A reviewer needs the exact requirement and diff; a separate context reduces anchoring but cannot guarantee independence. A CLAUDE.md instruction guides the agent; permission policy and backend authorization enforce operations. Never store credentials in shared rules or MCP configuration.
