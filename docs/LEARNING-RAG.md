# Learning content discovery and canonical RAG

This document defines how Git-backed learning material becomes searchable and linkable by the Learning Path Advisor and other retrieval consumers.

## Design goal

Published learning content must not require a second round of AI-specific registration.

For an already registered learning surface, adding a lesson, topic, or Markdown `##` section must automatically make that material part of the canonical RAG corpus on the next deployment. The content author must not also edit Worker catalog lists, Python route allow-lists, or frontend Advisor route allow-lists.

A brand-new learning surface is registered **once** in `content/learning-rag-registry.ts`. That registry is the integration boundary between Git learning content and retrieval. Consumers do not maintain copies of the route list.

## Data flow

```text
Git-backed learning catalog
        |
        v
content/learning-rag-registry.ts
        |
        v
worker/rag.ts
  - discovers catalog items
  - skips explicit non-published placeholders
  - creates topic/lesson documents
  - splits Markdown by ## section
  - assigns canonical topic/section/track metadata
        |
        +----------------------+
        |                      |
        v                      v
lexical fallback          Vectorize index
                               |
                               v
                       semantic candidates
        |                      |
        +----------+-----------+
                   v
          canonical RAG results
                   |
                   v
            Python AI service
          validates route shape
                   |
                   v
        Learning Path Advisor UI
          validates same-origin
          canonical link shape
```

`worker/rag.ts` remains the only retrieval implementation. Vectorize is candidate ranking for that canonical corpus; lexical retrieval is the degradation path inside the same pipeline.

## Canonical registry

`content/learning-rag-registry.ts` contains the current Git-backed learning surfaces and their canonical site routes. It can also attach a `track` when a page has multiple tracks, for example Python/C# under Programming or CT-AI under Certifications.

The registry contains content objects, not generated RAG documents. RAG document creation is derived from those objects at runtime/build time.

### Existing surface

Adding another topic to `content/api-integration/catalog.ts`, another C# taxonomy item, or another Python lesson requires no RAG-specific code change. The next corpus build discovers it from the registered catalog.

### New surface

When a completely new Git-backed learning surface is introduced:

1. create the normal content/catalog and UI route;
2. add one entry to `content/learning-rag-registry.ts` with its canonical route and optional track;
3. add/extend product tests for that surface.

Do **not** add matching route lists to `worker/rag.ts`, `ai-service/`, or the Learning Advisor UI.

## Retrieval granularity

Whole chapters are often too broad for useful semantic retrieval. They can also exceed the embedding input window before the relevant material appears.

The canonical corpus therefore creates first-class documents for Markdown level-two sections (`##`). For example:

```text
API & Integration
  HTTP & REST APIs
    ## HTTP status codes
```

produces a RAG document whose navigation metadata is equivalent to:

```text
route   = /learn/api
topic   = http-foundations
section = http-status-codes
```

and whose canonical link is:

```text
/learn/api?topic=http-foundations&section=http-status-codes
```

Structured lesson catalogs also preserve the parent topic. When a learning page uses tracks, the generated link carries the track as well:

```text
/learn/programming?topic=csharp-methods-parameters&section=ref-out-and-in&track=csharp
```

This lets retrieval point to the exact material the user asked for instead of a merely related chapter.

## Link safety without route drift

The Worker is authoritative for canonical source paths. Downstream consumers still validate those paths defensively, but they validate **shape**, not a duplicated catalog of known learning routes.

Accepted learning routes have the form:

```text
/learn/<slug>
/reference/<slug>
```

with only the supported query keys:

- `topic`
- `section`
- `track`

The Python AI service additionally requires a learning result to identify a topic or section and requires `sourcePath` to use the same path as the Worker-provided route. The browser accepts only same-origin canonical learning routes or the explicit interview routes. External URLs, fragments, traversal, unsupported query keys, and malformed paths remain rejected.

Interview-question deep links continue to use their separate explicit route contract.

## Vectorize refresh

Production deployment already refreshes the RAG index after the Worker is deployed. `scripts/deploy-cloudflare.mjs` calls the private `/internal/rag/reindex` endpoint in batches when RAG bindings are available.

Therefore the normal lifecycle is:

```text
merge content
  -> deploy main
  -> Worker contains the new canonical corpus
  -> post-deploy RAG reindex
  -> Vectorize contains the new documents
```

No manual reindex should be required for normal content publishing. If Vectorize is unavailable, the same canonical corpus remains searchable through lexical fallback.

## Required invariants

Tests must protect the architecture rather than only individual examples:

- current Git-backed learning surfaces are represented by the canonical registry;
- published Markdown `##` sections become RAG documents;
- generated documents carry valid canonical deep links;
- track-specific content preserves its track in navigation;
- explicit under-construction placeholders are not indexed as learning material;
- Python and browser consumers accept future canonical learning route slugs without adding route-specific allow-lists;
- unsafe paths and unsupported query keys remain rejected.

A regression such as a visible learning article that cannot be retrieved or linked by the Learning Path Advisor is a corpus/discovery defect, not something to solve by prompt engineering.
