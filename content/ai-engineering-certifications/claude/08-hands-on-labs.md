# Hands-on labs

Five sandbox exercises connect the guide scenarios to concrete evidence. Start with the executable baseline below in a scratch copy; the larger integrations are optional project extensions, not prebuilt production features.

## Lab 1: Catalog MCP server

First run examples/agentic-mcp-lab and inspect discovery, tool lists, valid calls and explicit errors. As an optional extension, build a catalog server against synthetic or public data.

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

Trains: the structured data extraction scenario.

## Lab 5: Multi-agent job researcher

An Agent SDK coordinator with three subagents: company research, role-fit scoring, and interview questions pulled through the Lab 1 server. A configured hook blocks the matched send/apply calls, while the backend independently checks actor/tenant authorization and exact approval, and each subagent returns structured errors with partial results.

Trains: coordinator and subagents, context passing, hooks, escalation, error propagation.

## Executable baseline and independent oracle

Use the [offline practice package](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice). Requires Python 3.10+, no model or API key. Run `python examples/certification-practice/practice.py architect`: every reference case should pass. Copy `starter.py` to a scratch file; `--candidate your_solution.py` should fail until you implement the required functions. Retain fixture IDs, expected/actual outputs and the command exit status.

| Stage | Task | Check |
| --- | --- | --- |
| Derive | Read requirements before the reference code | Explain the expected outputs independently |
| Implement | Fill only your track’s starter functions | All selected cases pass; the unfinished starter fails |
| Challenge | Introduce an incorrect boundary, source claim or error state | At least one relevant oracle rejects it |
| Review | Explain a plausible mistake and missing production controls | Record limits, not just a green status |

Check schema versus meaning, exact trusted approval, cross-tenant denial and error-preserving handoff. The stdio MCP lab is a runnable scripted loop; SDK/cloud integrations remain optional extensions. Optional live-tool practice requires authorized access and a usage budget; production writes are outside this sandbox.
