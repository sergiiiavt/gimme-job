# Hands-on labs

Five labs cover every CCAR-F scenario, and each one leaves a working piece of GimmeJob behind. Do at least three before taking the mock exam.

## Lab 1: Catalog MCP server

Build a TypeScript MCP server over the GimmeJob interview catalog.

- Tools: `search_questions` (level, category, tags) and `get_question` (id).
- A resource that lists categories.
- Errors return `isError: true` with a category; an empty search returns an empty list, not an error.
- Wire it in a committed `.mcp.json`, with any secret as `${VAR}`.

Trains: tool descriptions, MCP resources vs tools, structured errors, shared configuration.

## Lab 2: Claude Code repository setup

- A project `CLAUDE.md` that points to `AGENTS.md`.
- A `.claude/rules/questions.md` scoped by `paths` to the catalog JSON files.
- An `add-question` skill with `context: fork`.
- An `/audit-catalog` command in `.claude/commands/`.

Trains: the CLAUDE.md hierarchy, path rules, skills, commands.

## Lab 3: CI question reviewer

A GitHub Actions job runs `claude -p` on each pull request, checks new questions against the catalog schema and known answer templates, and emits JSON findings with `--output-format json`. A second, fresh instance reviews the first one's verdict, and previous findings are passed in so comments are not repeated.

Trains: the CI/CD scenario, independent review, explicit criteria.

## Lab 4: Job-posting extractor

Turn job descriptions into JSON: title, seniority, skills, salary (nullable), and remote (`yes`, `no`, `hybrid`, `unclear`).

- Add a validation-retry loop that names the failed rule.
- Run the nightly backlog through the Message Batches API with a `custom_id` per posting.
- Measure per-field accuracy on 30 hand-labelled postings, split by source.

Trains: the structured data extraction scenario and the CCDV-F integration domain.

## Lab 5: Multi-agent job researcher

An Agent SDK coordinator with three subagents: company research, role-fit scoring, and interview questions pulled through the Lab 1 server. A PreToolUse hook blocks any send or apply action until you approve it, and each subagent returns structured errors with partial results.

Trains: coordinator and subagents, context passing, hooks, escalation, error propagation.
