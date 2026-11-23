# Tool design & MCP integration

18% of CCAR-F and about 11% of CCDV-F. Most questions start with an agent choosing the wrong tool or mishandling a tool failure.

## Descriptions drive tool choice

The tool description is the model's main signal for when to use a tool. When an agent confuses `get_customer` with `lookup_order`, rewrite both descriptions first: what each returns, which inputs it needs, and when to prefer it over the similar one. Rename or split tools next. A routing classifier or a forced `tool_choice` is heavier and breaks the cases that need the other tool.

## Fewer tools per agent

Selection accuracy drops as the menu grows. An agent with 18 tools does worse than subagents with four or five each, scoped to their role. Scoping also follows least privilege: a research subagent has no reason to hold a refund tool.

## tool_choice

| Setting | Effect |
| --- | --- |
| `auto` | The model may call a tool or answer in text |
| `any` | The model must call one of the tools, its choice |
| `{"type": "tool", "name": "…"}` | The model must call that exact tool |
| `none` | The model may not call tools |

Forcing a named tool is the way to guarantee a structured first step, such as `extract_fields`.

## Errors the agent can act on

Return failures as structured errors with `isError: true`, a category (transient, validation, business rule, permission), whether a retry may help, and a readable message. A timeout returned as an empty result looks exactly like a valid "no orders" answer, so the agent tells the customer something false. "No results" is a correct empty answer, not an error.

## MCP configuration

- Project `.mcp.json` is committed and shared with the team; user-level configuration is personal.
- Keep secrets out of the shared file with environment variable expansion, for example `${GITHUB_TOKEN}`; each developer sets the variable.
- **Resources** expose content the application can load as context, such as files or a catalog. **Tools** are functions the model invokes to act or compute.
- Local servers usually run over stdio; remote servers use streamable HTTP.

## Built-in Claude Code tools

- **Grep** searches inside file contents: "every file that calls `legacyFetch(`".
- **Glob** matches file names and paths: "every `*.test.ts` file".
- **Edit** needs an exact, unique match; when it fails, fall back to Read then Write.
- **Bash** runs commands, subject to permissions.

## Worked example

An order service times out and the agent tells the customer they have no orders. The tool returned an empty list on failure. Return `isError: true` with a transient category and retry advice; the agent can then retry once and apologise honestly if it still fails.
