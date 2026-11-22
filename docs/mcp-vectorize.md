# MCP + Vectorize

GimmeJob exposes a private stateless MCP endpoint and uses Cloudflare Vectorize as a secondary semantic-search index. Git remains the source of truth for interview and learning content; D1 remains the source of truth for vacancies and private progress.

## Endpoint

- MCP URL: `POST https://gimme-job.com/mcp`
- Protocol: MCP revision [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), the stateless revision. It is the only revision the endpoint supports.
- Transport: Streamable HTTP with JSON responses only (no event streams), one JSON-RPC message per POST.
- Authentication: `x-gimmejob-mcp-token: <token>`
- The endpoint is server-to-server only. Do not place the MCP token in browser JavaScript or public configuration.

Production deployment accepts an optional GitHub Actions secret named `MCP_SERVICE_TOKEN`. When it is not configured, deployment uses the existing `APP_PASSWORD` value as the initial MCP service token so rollout does not require a new secret. A dedicated `MCP_SERVICE_TOKEN` of at least 32 characters is recommended.

In multi-user mode, the service token is an administrative credential. The client may send `x-gimmejob-mcp-user-email` to select the GimmeJob account whose private progress/analysis should be used. If no email is supplied, the server auto-selects only when exactly one account exists; otherwise it returns a configuration error instead of falling back to shared state.

The service token and the account selection are checked in `app/mcp/route.ts` before any MCP processing; a request without a valid token gets HTTP 401 (or 503 when no token is configured) and never reaches the protocol handler in `worker/mcp.ts`.

### Protocol contract (2026-07-28)

There is no `initialize` handshake and no session. Every request is self-contained:

- `params._meta["io.modelcontextprotocol/protocolVersion"]` is required and must be `2026-07-28`;
- `params._meta["io.modelcontextprotocol/clientCapabilities"]` is required (`{}` for none);
- `params._meta["io.modelcontextprotocol/clientInfo"]` is recommended and ignored by the server;
- the HTTP headers `MCP-Protocol-Version` (same value as `_meta`) and `Mcp-Method` (same value as the body's `method`) are required on every POST, and `Mcp-Name` (the tool name, plain or `=?base64?…?=`) on `tools/call`. Header values are compared case-sensitively.

Methods:

| Method | Result |
|---|---|
| `server/discover` | `supportedVersions: ["2026-07-28"]`, `capabilities: { tools: {} }`, `instructions`, `ttlMs: 3600000`, `cacheScope: "public"` |
| `tools/list` | the four tools below, `ttlMs: 300000`, `cacheScope: "public"` |
| `tools/call` | `content` (JSON text), `structuredContent`, `isError` |

Every result carries `resultType: "complete"` and `_meta["io.modelcontextprotocol/serverInfo"]` (`{ name: "gimmejob", version: "0.2.0" }`). Tool lists are identical for every caller and contain no private data, which is why they are `public` for caching.

Errors:

| Situation | HTTP | JSON-RPC |
|---|---|---|
| Request without a valid service token | 401 / 503 | none (plain JSON `{ error }` from the route) |
| Multi-user account selection fails | 404 / 409 | none (plain JSON `{ error }` from the route) |
| `Origin` header present and not the endpoint's own origin | 403 | `-32600` |
| Method other than POST or OPTIONS (GET, DELETE, …) | 405 | none |
| Body is not JSON | 400 | `-32700` Parse error |
| Body is a JSON array (batching), or not a JSON-RPC 2.0 message | 400 | `-32600` Invalid Request |
| Unsupported revision, including any `initialize` request | 400 | `-32022` Unsupported protocol version, `data: { supported, requested }` |
| `_meta` lacks the version or the client capabilities | 400 | `-32602` |
| A required header is missing, malformed or differs from the body | 400 | `-32020` Header mismatch |
| Unknown method (including `ping`, removed in 2026-07-28) | 404 | `-32601` |
| Unknown tool | 400 | `-32602` |
| Invalid tool arguments or a failing tool | 200 | none: a result with `isError: true` and a readable message |
| Valid notification | 202, no body | none |

`Mcp-Session-Id` is ignored and never issued.

### Decision: no legacy `initialize` path

The endpoint does not keep a compatibility path for revisions that start with `initialize` (2025-11-25 and earlier). Its only caller is this repository's own TypeScript client, which changes in the same commit as the server, so a second lifecycle would be code without a user. It would also be the riskier code: the old server echoed whatever `protocolVersion` a client sent, which claimed support for every revision.

An `initialize` request is therefore answered like any other unsupported revision: HTTP 400 with `-32022` and `data.supported` listing `2026-07-28`, as the specification asks of servers that only support the stateless revision. An older client sees a clear version error instead of a half-working session. If a third-party client that cannot speak 2026-07-28 ever needs this endpoint, add the older revision to `MCP_SUPPORTED_VERSIONS` together with a tested `initialize` path, rather than loosening the version check.

The local TypeScript client reads:

- `GIMMEJOB_MCP_URL` — optional, defaults to `https://gimme-job.com/mcp`.
- `GIMMEJOB_MCP_TOKEN` — preferred client-side environment variable for the service token.
- `GIMMEJOB_MCP_USER_EMAIL` — optional tenant selection in multi-user mode.

`MCP_SERVICE_TOKEN` and `APP_PASSWORD` are also accepted by the local client as token fallbacks for repository-local administration.

## Tools

### `search_jobs`

Semantic vacancy search over the D1 vacancy catalog. Optional filters: `remote`, `source`, `status`, and `limit`.

Vectorize is preferred. If semantic retrieval is unavailable, the tool falls back to deterministic local lexical ranking so vacancy search remains usable.

### `get_interview_questions`

Searches the canonical Git-backed interview catalog. Supports natural-language `query`, `category`, `prevalence`, and `limit`.

Vectorize is preferred for a query. Without Vectorize, query words use the existing AND-style lexical behavior. With no query, the canonical catalog is returned directly.

### `get_learning_progress`

Returns persisted private interview-question progress and summary counts. An optional `query` also retrieves semantically relevant learning materials from Vectorize.

The persisted progress remains in D1; recommendations from Vectorize do not mutate progress.

### `analyze_vacancy`

Accepts a stored `job_id` and calls the same vacancy-analysis path used by the GimmeJob site. This preserves the current OpenAI analysis with deterministic fallback and the same D1 persistence rules.

The result additionally includes semantically matched interview questions and learning material for vacancy-specific preparation.

## RAG corpus

The `gimmejob-rag` Vectorize index contains references and searchable text for:

- canonical interview questions;
- QA fundamentals;
- Python curriculum and Python quick reference;
- test automation curriculum;
- testing tools curriculum;
- Cloud & DevOps curriculum;
- QA metrics & estimation curriculum;
- SQL quick reference and SQL practical interview tasks;
- current D1 vacancies.

The embedding model is Cloudflare Workers AI `@cf/baai/bge-m3`, selected for multilingual retrieval. The Vectorize index is created as 1,024-dimension cosine similarity. Vector IDs are compact stable hashes so they remain below Vectorize's ID-size limit, while metadata retains the canonical Git/D1 reference ID.

## Index lifecycle

For full semantic RAG, the GitHub `CLOUDFLARE_API_TOKEN` must include Cloudflare account permissions `Vectorize Read` and `Vectorize Write` in addition to the existing Worker/D1 permissions.

Production deployment:

1. attempts to discover or create `gimmejob-rag`;
2. when Vectorize is available, deploys Workers AI (`AI`) and Vectorize (`RAG_INDEX`) bindings;
3. applies D1 migrations as before;
4. deploys the Worker;
5. when RAG is enabled, calls the private `/internal/rag/reindex` endpoint in batches of 32 until all interview, learning, and vacancy documents are upserted.

Vectorize is deliberately an optional secondary index. If provisioning cannot run, for example because the Cloudflare token has not yet been granted Vectorize permissions, the production Worker and D1 deployment continues without `AI`/`RAG_INDEX`. MCP search then uses the existing deterministic lexical/catalog fallbacks. A post-deploy RAG refresh failure is reported as a GitHub Actions warning rather than turning an otherwise successful site deployment red.

No D1 schema migration is required for MCP or RAG.

The index is deliberately rebuildable. Removing or corrupting the Vectorize index does not remove source content from Git or D1.

## TypeScript client

The client is implemented in `agent/src/mcp-client.ts` and has convenience methods for all four tools:

```ts
import { createGimmeJobMcpClient } from "./agent/src/mcp-client.js";

const mcp = createGimmeJobMcpClient();
const server = await mcp.discover(); // optional: supported versions, capabilities, instructions
const jobs = await mcp.searchJobs({ query: "Senior QA Python Playwright Kyiv" });
const questions = await mcp.getInterviewQuestions({ query: "API authentication testing" });
const progress = await mcp.getLearningProgress({ query: "SQL joins" });
const analysis = await mcp.analyzeVacancy({ job_id: "job_123" });
```

The client is stateless like the server. It sends no handshake: every request carries `_meta` with the protocol version, empty client capabilities and client info, plus the `MCP-Protocol-Version`, `Mcp-Method` and (for `tools/call`) `Mcp-Name` headers and the service-token headers. `discover()` is optional and fails if the server does not list `2026-07-28`. The client accepts JSON and server-sent-event responses, rejects any `resultType` other than `complete`, throws `McpRpcError` (with `code`, `data` and HTTP `status`) for JSON-RPC errors, and throws a plain error with the message text for tool results that have `isError: true`.
