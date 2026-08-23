# MCP + Vectorize

GimmeJob exposes a private stateless MCP endpoint and uses Cloudflare Vectorize as a secondary semantic-search index. Git remains the source of truth for interview and learning content; D1 remains the source of truth for vacancies and private progress.

## Endpoint

- MCP URL: `POST https://gimme-job.com/mcp`
- Transport: stateless JSON-RPC 2.0 over HTTP, compatible with Streamable HTTP request/response usage.
- Authentication: `x-gimmejob-mcp-token: <token>`
- The endpoint is server-to-server only. Do not place the MCP token in browser JavaScript or public configuration.

Production deployment accepts an optional GitHub Actions secret named `MCP_SERVICE_TOKEN`. When it is not configured, deployment uses the existing `APP_PASSWORD` value as the initial MCP service token so rollout does not require a new secret. A dedicated `MCP_SERVICE_TOKEN` of at least 32 characters is recommended.

In multi-user mode, the service token is an administrative credential. The client may send `x-gimmejob-mcp-user-email` to select the GimmeJob account whose private progress/analysis should be used. If no email is supplied, the server auto-selects only when exactly one account exists; otherwise it returns a configuration error instead of falling back to shared state.

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
const jobs = await mcp.searchJobs({ query: "Senior QA Python Playwright Kyiv" });
const questions = await mcp.getInterviewQuestions({ query: "API authentication testing" });
const progress = await mcp.getLearningProgress({ query: "SQL joins" });
const analysis = await mcp.analyzeVacancy({ job_id: "job_123" });
```

The client initializes the MCP connection once, sends `notifications/initialized`, supports `tools/list`, and sends `tools/call` requests with the service-token headers.
