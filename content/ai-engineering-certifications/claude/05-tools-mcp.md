# Tool design & MCP integration

18% of CCAR-F. Most questions start with an agent choosing the wrong tool or mishandling a tool failure.

## Descriptions drive tool choice

The tool description is the model's main signal for when to use a tool. When an agent confuses `get_customer` with `lookup_order`, rewrite both descriptions first: what each returns, which inputs it needs, and when to prefer it over the similar one. Rename or split tools next. A routing classifier or a forced `tool_choice` is heavier and breaks the cases that need the other tool.

## Fewer tools per agent

Similar descriptions and overlapping tools can make selection harder. Compare actual routing errors on a representative set before and after scoping; there is no universal tool-count threshold. Scoping also follows least privilege: a research subagent has no reason to hold a refund tool.

## tool_choice

| Setting | Effect |
| --- | --- |
| `auto` | The model may call a tool or answer in text |
| `any` | The model must call one of the tools, its choice |
| `{"type": "tool", "name": "…"}` | The model must call that exact tool |
| `none` | The model may not call tools |

A named `tool_choice` requests that tool under a supported configuration. It does not by itself guarantee schema-conforming arguments, successful execution or correct facts.

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

An order service times out and the agent tells the customer they have no orders. The tool returned an empty list on failure. Return `isError: true` with a transient category and retry advice; the runtime can then apply a bounded replay-safe retry or hand off with the unresolved failure.

## Tool-error contract exercise

Inject a timeout into history lookup after a successful failures list. Return isError=true and a safe reason category. Preserve the list as partial evidence; do not read structuredContent from the failed result or interpret missing history as zero failures. Retry only if replay-safe and within budget, otherwise hand off with attempted operation and unresolved evidence. The runnable stdio lab exercises this boundary; it is a scripted policy, not an SDK-backed model agent.
