# Copilot features

The largest GH-300 domain. Know every surface, what it is for, and which files and settings customise it.

## Surfaces

| Surface | What it does |
| --- | --- |
| Inline suggestions | Ghost text as you type; Tab accepts |
| Next edit suggestions | Predicts the next edit location and change |
| Chat: ask mode | Answers questions about code and concepts |
| Chat: edit mode | Proposes edits across chosen files for you to review |
| Chat: agent mode | Plans multi-step work, edits files, runs terminal commands with approval, iterates on errors |
| Copilot CLI | An agentic Copilot in the terminal that reads and edits files and runs commands with approval |
| Cloud agent (formerly coding agent) | Takes an assigned issue, works in its own environment, opens a draft pull request |
| Code review | Reviews pull requests on github.com against your standards |
| Pull request summaries | Drafts a PR description from the diff |
| Spaces | Curated collections of context that ground Copilot's answers |
| Spark | Builds small apps from natural-language descriptions |

## Chat vocabulary

- **Participants:** `@workspace` for the repository, `@terminal` for the integrated terminal, `@vscode` for editor questions.
- **Slash commands:** `/explain`, `/fix`, `/tests`, `/doc`, `/new`.
- **Context variables:** `#file`, `#selection`, `#codebase`.

## Agent mode, sub-agents and MCP

Agent mode works through a task step by step: it reads errors from builds and tests and tries again. Terminal commands need your approval; the VS Code auto-approve settings can be managed centrally. Agent mode reaches external systems such as an issue tracker through **MCP servers**. In long sessions, delegate side research to **sub-agents** and manage agent sessions so the main context stays lean.

## Customisation files

| File | Applies to |
| --- | --- |
| `.github/copilot-instructions.md` | The whole repository: chat, agents, code review |
| `.github/instructions/*.instructions.md` with `applyTo` | Files matching the glob, for example `**/*.test.ts` |
| `.github/prompts/*.prompt.md` | Reusable prompts the team runs from chat |

Copilot code review takes its custom standards from the same instruction files.

## Plans and organization administration

Free, Pro and Pro+ are individual plans. **Business** and **Enterprise** add organization policies, content exclusion, audit logs and seat management.

- **Policies** switch individual features and models on or off for the organization, for example code review on github.com while agent mode stays off in IDEs.
- **Audit log** events record Copilot settings changes and seat assignments.
- **REST API** endpoints list, add and remove Copilot seats, so onboarding can be automated from an HR system.

## Worked example

An organization wants Copilot code review now and agent mode later. Uninstalling extensions or misusing content exclusion are wrong tools. Set the feature policies in the organization's Copilot settings.
