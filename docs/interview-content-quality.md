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

- at least the current 672-question baseline, exactly 19 topics and at least 67 sources;
- exactly 30 canonical-baseline questions covering every topic;
- stable explicit IDs for canonical questions;
- explicit presence of critical foundational questions;
- no duplicated titles, missing question types, deprecated tag variants or invalid source references;
- every researched source referenced by at least one question;
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

## Testing foundations and direct discoverability

The catalog keeps broad interview wording explicit as well as detailed scenarios. The `testing-types` answer organizes common labels by purpose, knowledge of internals, change, execution approach and lifecycle level, so practical types are not hidden behind a four-item list. `content/interview/testing-foundations-qa.json` also includes a direct inventory question covering specification-based, structure-based and experience-based test-design techniques. Both remain searchable by the terms candidates commonly use.

## Modern SDET and cross-platform coverage

`content/interview/modern-sdet-qa.json` adds 52 stable, hand-authored questions without removing or renaming any existing entry. It covers test doubles, property-based and mutation testing, visual regression, browser grids and real-device clouds, coding complexity and data-structure exercises, internationalization and localization, AI-assisted test review, self-healing locators, MCP and agent evaluation, OAuth and OpenID Connect, event-driven systems, Core Web Vitals and software-supply-chain assurance.

The expansion is role-aware through reusable tags such as `sdet`, `automation-engineer`, `web-qa`, `mobile-qa`, `ai-qa`, `security-qa`, `performance-qa` and `qa-lead`. Emerging agentic topics are marked Occasional or Specialist rather than being presented as universal QA requirements. That pass added 52 questions and sixteen primary or authoritative references; the later core-foundation pass advances the current totals documented below.

The previously generic practical cluster remains intact for stable IDs, but all 22 existing login, elevator, payment and upload scenarios now include product-specific failure modes and adapt their evidence to the stated constraint. This preserves additive history while removing the weakest boilerplate from the candidate experience.

## Core foundations and editorial stars

`content/interview/core-foundations-qa.json` adds 18 direct questions for acceptance and integration testing, static and dynamic techniques, experience-based and cause-effect design, structural coverage, test plans, test-case quality, testing work products, requirement quality and review, verification methods, and test-estimation techniques. NASA's requirements guidance adds a primary reference for clarity, completeness, consistency, feasibility, singularity, traceability and verifiability.

`content/interview/editorial-starred-question-ids.json` curates the essential preparation path across both existing and new questions. The Starred option appears in the Prevalence filter for discoverability, but it is an independent editorial flag: every question keeps its real frequency band. No personal state is written yet, leaving future user-specific stars free to remain private.

## Readability and media policy

Answers remain plain public content in Git. The UI turns short answers into a lead statement plus readable points, while retaining the separate “Strong answer includes” checklist and source links. This improves the full catalog without embedding presentation markup into source data.

Visuals are added only when a relationship is materially easier to understand spatially. The test-levels/test-types matrix qualifies because it separates two independent axes; decorative images do not. Every visual requires alternative text, a caption and a credit and is loaded only with its expanded answer.
