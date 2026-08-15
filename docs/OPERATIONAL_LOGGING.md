# Operational Logging

## Purpose and layers

GimmeJob uses two complementary observability layers.

### Grafana / D1 (long-term trends)

This layer stores safe, aggregated operation data for historical analysis.

Use it for:
- failures, degraded operations, and normalized errors;
- source reliability and source duration trends;
- errorReasons trends by reason code and HTTP status;
- OpenAI fallback counts;
- daily snapshots and operation volume over time.

D1 stores:
- event, status, source, mode;
- duration, item counts, error count;
- safe reason_code and safe http_status;
- daily snapshots.

D1 does not store:
- raw exception messages;
- stack traces;
- request/response payloads;
- secrets or personal content.

D1 data remains until explicitly deleted or migrated.

### Cloudflare Workers Logs (short-term diagnostics)

This layer stores structured runtime diagnostics for production debugging.

Use it for:
- operationId tracing;
- stage-level failures;
- source-level and fallback-level diagnostics;
- safe error classification, retryability, and bounded safe stacks for unexpected internal failures.

Current Cloudflare Workers Free plan references:
- retention: 3 days;
- 200,000 log events per account per day.

Platform limits can change; always verify current limits in Cloudflare docs.

## Where to inspect logs

Cloudflare Dashboard path:
- Workers & Pages
- gimmejob
- Observability
- Overview

Useful sections:
- Visualizations: high-level trends.
- Invocations: inspect a specific request/operation timeline.
- Events: inspect structured application log objects.
- Query Builder: filter by structured fields.

## Query examples

Use Query Builder with patterns like:

- `event = "job_source_sync" AND outcome = "failure"`
- `source = "rss:dou-qa"`
- `reasonCode = "upstream_http_error" AND httpStatus = 403`
- `event = "openai_analysis" AND outcome = "degraded"`
- `operationId = "sync_<value>"`
- `$metadata.level = "error"`

Cloudflare autocomplete and Query Builder field suggestions are the source of truth for exact key names.
Never store secrets in saved queries.

## Optional live read-only tail

For local read-only debugging:

```bash
npx wrangler tail gimmejob
```

If syntax differs in your Wrangler version:

```bash
npx wrangler tail --help
```

This is read-only diagnostics only. Deployment remains GitHub Actions -> Cloudflare.

## Grafana panel enabled by this change

The summary endpoint now includes `errorReasons`, enabling a future panel such as:

- `Error reasons - 30d`

Example row style:

- `rss:dou-qa | upstream_http_error | 403 | 2`
- `openai | openai_fallback | | 3`

This document does not modify Grafana dashboards automatically.
