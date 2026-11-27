# Global public search

Global search and Learning Advisor share `worker/rag.ts` and the single learning
registry in `content/learning-rag-registry.ts`. Git remains authoritative. Public
search indexes learning/reference material and interview questions; D1 vacancies,
private progress, application state and resumes never enter its index.

## Retrieval and user experience

Typesense 30.2 supplies weighted lexical ranking, prefixes, typo tolerance and
single-word title infixes. Original titles and text remain unchanged. Reviewed
English/Ukrainian equivalents live in `worker/search-corpus.ts`: title equivalents
have a lower weight than original titles, and body equivalents the lowest weight.
The pilot's aggressive global stemming is not used in production.

Exact facets protect `C#`, `C++`, `.NET` and three-digit HTTP codes. Numeric and
identifier typo correction and token dropping are disabled. Query input cannot
supply arbitrary Typesense filters, collection names or field names.

LangChain OpenAIEmbeddings with `text-embedding-3-small`, 512 dimensions, supplies
multilingual semantic candidates in the same derived Typesense collection. This
uses the existing private AI-service credentials, without assuming the Cloudflare
API token can provision Vectorize. Existing Vectorize/BGE-M3 retrieval remains a
canonical Advisor fallback when the gateway is unavailable.

Reciprocal rank fusion favors lexical matches over semantic-only candidates.
Translated variants are deduplicated and at most two sections per parent chapter
are returned. Semantic distance is capped at 0.55: an initial operational threshold,
not a claim of calibrated precision. Query embeddings have a bounded process cache;
index embeddings are persisted in SQLite by model/dimensions/text hash. Unchanged
content does not need embedding again on every deployment.

Typing starts lexical search after 450 ms. Enter also requests semantic search.
The shared navigation and Ctrl/Cmd K open a native accessible modal. Escape closes
it and restores focus. Requests are aborted on query/filter changes or closure and
stale responses are discarded. Results support Tab/Enter and arrow navigation.
The existing local interview AND search, lazy loading and 60-row cap are preserved.

## Canonical corpus and direct links

English and Ukrainian variants are projected separately before truncation.
Translated H2 sections use English canonical section IDs in the same positional
mapping used by page navigation. Question answers, examples and strong-answer
signals are included. Question links carry `question`, learning links retain
`topic`, `section` and required `track`, and `lang=uk` opens the authored translation.
Under-construction placeholders remain excluded.

The legacy duplicate `performance-test-types` is preserved in authored content.
Retrieval keeps its first occurrence, matching the actual question page, instead
of silently renaming a public ID or indexing an unreachable second answer.

The Worker materializes index candidate IDs from its current canonical documents.
The index cannot override titles, links, snippets or public/private boundaries.
A SHA-256 revision must match the complete search projection on both sides. The
verified build embeds this revision as a constant, avoiding a full projection and
hash operation on a Worker request. Source tests calculate it directly.

## Public API and limits

`GET /api/public/search?q=...&kind=learning|question&language=en|uk&semantic=0|1`
accepts 2–240 characters and returns at most 20 sanitized results. Optional filters
may be omitted. Responses contain only public titles, snippets, labels and hrefs.
Credentials, vectors and private runtime state never reach the browser. Mode is
`typesense`, `hybrid` or explicitly degraded `fallback`.

The existing D1-backed budget mechanism limits lexical searches to 600 per IP/hour
and 30,000/day globally. Explicit semantic searches have separate limits of 60 per
IP/hour and 2,000/day globally. These are initial code defaults. Searches fail closed
if budget storage is unavailable.

## Deployment and recovery

The AI Docker build generates its snapshot from canonical Worker discovery. There
is no duplicate content registry or manual publishing/indexing step. The normal AI
image workflow starts private Typesense on Hetzner, indexes a complete new collection,
validates imports/counts, then atomically changes its alias. Failed imports preserve
the prior active index; a full replacement removes deleted documents. The previous
complete collection is retained for rollback. Bump `SCHEMA_VERSION` when changing
embedding model/dimensions or index field semantics.

Typesense has no published port or Caddy route. Its persistent generated key lives
only in the protected host environment; the gateway retains existing bearer-token
authentication. Search index/cache volumes persist across image replacement. The
container is limited to 768 MiB, one CPU and bounded threads; rollout checks host
memory before starting. This is a single-node index: host failure causes fallback.

The normal Cloudflare deployment waits for the current corpus revision/count and
semantic readiness, checks actual EN/UK semantic requests, and verifies anonymous
public search before reporting success. Temporary Worker/image skew produces the
basic canonical fallback instead of stale content.

## Verification and evidence

`npm run verify` covers corpus/API contracts, rendered interactive behavior,
public/private boundaries and production artifacts. Python tests cover service auth,
query restrictions, fusion, embedding caches, atomic replacement and failures. The
search workflow runs the real Typesense binary against the production gateway,
including prefixes, typos, infixes, equivalents, technical distinctions, vector
queries and deletion refresh. Local browser verification covers 320–1366 px, both
designs, focus restoration and Ukrainian deep links.

The dated lexical pilot remains in `examples/search-benchmark`. Its target Hit@5
is not precision and does not establish semantic relevance or production latency.
Ongoing evaluation should add independently reviewed EN/UK needs and graded labels.

Primary documentation:

- https://typesense.org/docs/30.2/api/search.html
- https://typesense.org/docs/30.2/api/vector-search.html
- https://typesense.org/docs/30.2/api/collection-alias.html
- https://docs.langchain.com/oss/python/integrations/text_embedding/openai
