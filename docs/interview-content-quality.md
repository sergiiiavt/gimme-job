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

`content/interview/canonical-baseline.json` is the explicit baseline. It contains 30 directly searchable questions across all 18 topics. The generator fills the remaining catalog capacity after loading this baseline, so adding a required question replaces a lower-value generated scenario instead of increasing the 520-question total.

Validation now requires:

- exactly 520 questions, 18 topics and 46 sources;
- exactly 30 canonical-baseline questions covering every topic;
- stable explicit IDs for canonical questions;
- explicit presence of critical foundational questions;
- no duplicated titles or invalid source references;
- no known awkward generated wording such as “test testing.”

The first baseline audit added direct questions for testing vocabulary and process, test-technique families, test artifacts and reports, API request anatomy, mobile device choices, automation frameworks and risks, asynchronous test code, CI/CD terminology, performance comparisons, accessibility, Scrum and test-first approaches, planning criteria, leadership, a classic practical task, AI evaluation, data pipelines and quality, production telemetry, reliability objectives and regulated traceability.

## Database and SQL coverage correction

The same topic-count failure later appeared in “Data & BI.” The topic contained 29 entries, but most were generated pipeline scenarios with nearly identical answers; only two questions explicitly asked about databases or SQL. Search therefore made the topic look absent even though database words appeared inside a few answers and source descriptions.

`content/interview/database-sql-qa.json` is now a second explicit audited set. Its 25 stable questions cover relational and non-relational models, SQL command families, keys and constraints, NULL, filtering and aggregation, duplicates and orphans, normalization, CTEs, window functions, transactions, isolation, locks, indexes, query plans, migrations, data-type boundaries, test-data isolation, recovery, injection, database-side logic, star schemas and dashboard reconciliation. The generator counts these questions before filling the topic, so they replace repetitive scenarios and the catalog remains exactly 520 questions.

## Readability and media policy

Answers remain plain public content in Git. The UI turns short answers into a lead statement plus readable points, while retaining the separate “Strong answer includes” checklist and source links. This improves all 520 entries without embedding presentation markup into source data.

Visuals are added only when a relationship is materially easier to understand spatially. The test-levels/test-types matrix qualifies because it separates two independent axes; decorative images do not. Every visual requires alternative text, a caption and a credit and is loaded only with its expanded answer.
