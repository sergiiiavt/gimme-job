# Interview catalog content-quality model

## Why an obvious question was missing

The original 120-question set was editorially authored, but the 520-question expansion filled fixed per-topic targets from combinations of concepts and scenarios. That design optimized topic balance and exact count, not direct discoverability.

“Testing types” existed as fragments in generated concepts, answers and tags, but not as the simple canonical question a candidate would search for. The same failure mode affected other foundational terms. The position-based prevalence model could then rank a generated scenario without proving that its underlying definition had an explicit, high-prevalence entry.

The failure had four causes:

1. Coverage was measured by topic count rather than a required-concept checklist.
2. Search presence in an answer or tag was treated as equivalent to an explicit question title.
3. Generated concept × scenario combinations displaced direct definitions.
4. Validation checked totals, taxonomy, sources and field completeness, but not canonical question coverage or wording quality.

## Corrective model

`content/interview/canonical-baseline.json` is the explicit baseline. It contains 30 directly searchable questions across all 18 topics. The generator now treats topic targets as minimum coverage floors and preserves every existing generated question, so adding a required question increases the catalog instead of silently deleting another entry.

Validation now requires:

- at least the current 566-question baseline, exactly 18 topics and exactly 46 sources;
- exactly 30 canonical-baseline questions covering every topic;
- stable explicit IDs for canonical questions;
- explicit presence of critical foundational questions;
- no duplicated titles or invalid source references;
- no known awkward generated wording such as “test testing.”

The first baseline audit added direct questions for testing vocabulary and process, test-technique families, test artifacts and reports, API request anatomy, mobile device choices, automation frameworks and risks, asynchronous test code, CI/CD terminology, performance comparisons, accessibility, Scrum and test-first approaches, planning criteria, leadership, a classic practical task, AI evaluation, data pipelines and quality, production telemetry, reliability objectives and regulated traceability.

## Database and SQL coverage correction

The same topic-count failure later appeared in “Data & BI.” The topic contained 29 entries, but most were generated pipeline scenarios with nearly identical answers; only two questions explicitly asked about databases or SQL. Search therefore made the topic look absent even though database words appeared inside a few answers and source descriptions.

`content/interview/database-sql-qa.json` is now a second explicit audited set. Its 25 stable questions cover relational and non-relational models, SQL command families, keys and constraints, NULL, filtering and aggregation, duplicates and orphans, normalization, CTEs, window functions, transactions, isolation, locks, indexes, query plans, migrations, data-type boundaries, test-data isolation, recovery, injection, database-side logic, star schemas and dashboard reconciliation.

## Non-destructive growth correction

A history review found that three later content commits recorded 58 deletions while keeping the total fixed at 520. Many were repetitive generated variants, but the fixed-cap generator also removed useful coverage. `content/interview/restored-coverage-qa.json` restores 21 high-value concepts as stable, directly searchable questions, bringing the catalog to 541.

The generator now loads and preserves existing generated entries before checking topic floors. It creates questions only when a topic falls below its minimum and never removes an entry merely because reviewed content was added. Validation and regression tests enforce a rolling catalog-wide minimum instead of a maximum and require all 21 restored IDs.

## Observability and production coverage correction

The observability topic had useful direct entries for telemetry signals, SLO terminology and canary verification, but 26 of its 29 questions were generated combinations. That made foundational production concepts harder to discover and left the answers too repetitive for practical preparation.

`content/interview/observability-production-qa.json` adds 25 stable, researched questions without displacing any existing ID. The audited set covers monitoring and observability, signal selection, golden signals, metric shapes, latency percentiles, structured logs, trace propagation and sampling, telemetry cardinality and privacy, Kubernetes probes, production smoke tests, synthetic and real-user monitoring, telemetry-pipeline validation, actionable alerting, metamonitoring, error budgets, burn-rate alerts, incident evidence and postmortem actions. The catalog therefore grows from 541 to 566 questions.

## Readability and media policy

Answers remain plain public content in Git. The UI turns short answers into a lead statement plus readable points, while retaining the separate “Strong answer includes” checklist and source links. This improves the full catalog without embedding presentation markup into source data.

Visuals are added only when a relationship is materially easier to understand spatially. The test-levels/test-types matrix qualifies because it separates two independent axes; decorative images do not. Every visual requires alternative text, a caption and a credit and is loaded only with its expanded answer.
