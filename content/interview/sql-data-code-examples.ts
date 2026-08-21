import type { InterviewCodeExampleEnhancement } from "./sql-code-examples";

const sqlDataCodeExamples: InterviewCodeExampleEnhancement[] = [
  {
    id: "etl-testing-basics",
    codeExamples: [{
      title: "Reconcile source and target control totals",
      titleUk: "Звірити source і target control totals",
      language: "sql",
      code: `SELECT 'source' AS dataset, COUNT(*) AS rows, SUM(amount) AS total_amount\nFROM source_orders\nWHERE load_date = DATE '2026-08-21'\n\nUNION ALL\n\nSELECT 'target' AS dataset, COUNT(*) AS rows, SUM(amount) AS total_amount\nFROM warehouse_orders\nWHERE load_date = DATE '2026-08-21';`,
      explanation: "Start ETL validation with independent control totals at each boundary, then drill into row-level differences when counts or amounts diverge. Add separate checks for rejected rows, type conversions, joins, defaults and rerun idempotency rather than trusting only the job status.",
      explanationUk: "Починайте ETL validation з незалежних control totals на кожній межі, а при розбіжності counts або amounts переходьте до row-level diff. Окремо перевіряйте rejected rows, type conversions, joins, defaults та idempotency повторного запуску, а не лише status job.",
      expectedResult: "Source and target totals match after accounting for documented rejects and transformations.",
      expectedResultUk: "Source і target totals збігаються з урахуванням задокументованих rejects і transformations."
    }]
  },
  {
    id: "data-quality-dimensions",
    codeExamples: [{
      title: "Turn quality dimensions into measurable SQL checks",
      titleUk: "Перетворити data-quality dimensions на вимірювані SQL checks",
      language: "sql",
      code: `SELECT\n  COUNT(*) AS total_rows,\n  SUM(CASE WHEN email IS NULL THEN 1 ELSE 0 END) AS missing_email,\n  SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) AS invalid_amount,\n  COUNT(DISTINCT customer_id) AS distinct_customers,\n  MAX(updated_at) AS newest_update\nFROM orders;\n\nSELECT email, COUNT(*) AS copies\nFROM users\nWHERE email IS NOT NULL\nGROUP BY email\nHAVING COUNT(*) > 1;`,
      explanation: "Completeness, validity, uniqueness and freshness become useful only when each has an explicit rule and threshold. Keep dimensions separate so one good metric cannot hide another bad one, and tie each check to an authoritative source and business consequence.",
      explanationUk: "Completeness, validity, uniqueness і freshness корисні лише тоді, коли кожна dimension має явне правило та threshold. Не змішуйте dimensions в один score: хороша metric не повинна приховувати погану; кожен check має бути прив'язаний до authoritative source і business impact.",
      expectedResult: "Named quality metrics that can be compared with explicit acceptance thresholds.",
      expectedResultUk: "Окремі quality metrics, які можна порівняти з явними acceptance thresholds."
    }]
  },
  {
    id: "data-source-target-lineage",
    codeExamples: [{
      title: "Locate source-to-target row differences",
      titleUk: "Локалізувати source-to-target row differences",
      language: "sql",
      code: `SELECT\n  COALESCE(s.order_id, t.order_id) AS order_id,\n  s.amount AS source_amount,\n  t.amount AS target_amount\nFROM source_orders s\nFULL OUTER JOIN warehouse_orders t ON t.order_id = s.order_id\nWHERE s.order_id IS NULL\n   OR t.order_id IS NULL\n   OR s.amount IS DISTINCT FROM t.amount;`,
      explanation: "A full comparison exposes rows missing on either side plus changed values at the declared business-key grain. Use the versioned mapping as the oracle: if the target amount is transformed, compare it with an independently calculated expected value rather than blindly expecting source equality.",
      explanationUk: "Full comparison показує rows, відсутні з будь-якого боку, і змінені values на визначеному grain бізнес-ключа. Oracle має бути versioned mapping: якщо target amount трансформується, порівнюйте його з незалежно обчисленим expected value, а не просто з source value.",
      expectedResult: "Only explainable mapped differences; unexplained rows identify the pipeline stage to investigate.",
      expectedResultUk: "Лише пояснювані mapping differences; unexplained rows вказують, який етап pipeline потрібно дослідити."
    }]
  },
  {
    id: "data-batch-streaming-late-events",
    codeExamples: [{
      title: "Detect duplicate event IDs before validating aggregates",
      titleUk: "Знайти duplicate event IDs перед перевіркою aggregates",
      language: "sql",
      code: `WITH ranked AS (\n  SELECT\n    event_id,\n    event_time,\n    ingested_at,\n    ROW_NUMBER() OVER (\n      PARTITION BY event_id\n      ORDER BY ingested_at, event_id\n    ) AS copy_no\n  FROM raw_events\n)\nSELECT event_id, event_time, ingested_at\nFROM ranked\nWHERE copy_no > 1\nORDER BY event_id, ingested_at;`,
      explanation: "Streaming tests need controlled late, duplicate and reordered inputs. This SQL check verifies whether the raw input contains repeated event IDs; the pipeline assertion then proves the documented deduplication, watermark and replay rules prevent those copies from double-counting the final aggregate.",
      explanationUk: "Streaming tests потребують контрольованих late, duplicate та reordered inputs. Цей SQL check показує repeated event IDs у raw input; далі pipeline assertion має довести, що задокументовані deduplication, watermark і replay rules не дозволяють цим copies подвоїти фінальний aggregate.",
      expectedResult: "Known injected duplicates are visible in raw data but contribute only according to the documented deduplication rule downstream.",
      expectedResultUk: "Відомі injected duplicates видимі в raw data, але downstream враховуються лише згідно з documented deduplication rule."
    }]
  },
  {
    id: "data-upstream-schema-drift",
    codeExamples: [{
      title: "Compare the actual schema with an expected contract",
      titleUk: "Порівняти actual schema з expected contract",
      language: "sql",
      code: `WITH expected(column_name, data_type, is_nullable) AS (\n  VALUES\n    ('user_id', 'bigint', 'NO'),\n    ('email', 'text', 'YES'),\n    ('created_at', 'timestamp with time zone', 'NO')\n),\nactual AS (\n  SELECT column_name, data_type, is_nullable\n  FROM information_schema.columns\n  WHERE table_schema = 'public'\n    AND table_name = 'users'\n)\nSELECT\n  COALESCE(e.column_name, a.column_name) AS column_name,\n  e.data_type AS expected_type,\n  a.data_type AS actual_type,\n  e.is_nullable AS expected_nullable,\n  a.is_nullable AS actual_nullable\nFROM expected e\nFULL OUTER JOIN actual a ON a.column_name = e.column_name\nWHERE e.column_name IS NULL\n   OR a.column_name IS NULL\n   OR e.data_type <> a.data_type\n   OR e.is_nullable <> a.is_nullable;`,
      explanation: "Schema drift is a contract problem, not only a parser error. Compare field presence, types and nullability before data processing, then separately test semantic changes, renamed fields, defaults and mixed producer/consumer versions.",
      explanationUk: "Schema drift — це проблема contract, а не лише parser error. До processing порівнюйте наявність fields, types і nullability, а окремо тестуйте semantic changes, renamed fields, defaults та mixed producer/consumer versions.",
      expectedResult: "Zero rows when the physical schema matches the expected structural contract.",
      expectedResultUk: "Нуль rows, коли physical schema відповідає expected structural contract."
    }]
  },
  {
    id: "data-slowly-changing-dimensions",
    codeExamples: [{
      title: "Detect overlapping SCD Type 2 history ranges",
      titleUk: "Знайти overlapping history ranges у SCD Type 2",
      language: "sql",
      code: `WITH history AS (\n  SELECT\n    customer_id,\n    valid_from,\n    valid_to,\n    is_current,\n    LEAD(valid_from) OVER (\n      PARTITION BY customer_id\n      ORDER BY valid_from\n    ) AS next_valid_from\n  FROM dim_customer\n)\nSELECT *\nFROM history\nWHERE next_valid_from IS NOT NULL\n  AND (valid_to IS NULL OR valid_to > next_valid_from);\n\nSELECT customer_id, COUNT(*) AS current_rows\nFROM dim_customer\nWHERE is_current = TRUE\nGROUP BY customer_id\nHAVING COUNT(*) <> 1;`,
      explanation: "Type 2 history should normally have non-overlapping effective ranges and exactly one current version per active business entity. Add checks for backdated changes, surrogate-key stability, fact-to-version joins and idempotent reruns.",
      explanationUk: "Type 2 history зазвичай має non-overlapping effective ranges і рівно одну current version для кожної active business entity. Додайте checks для backdated changes, surrogate-key stability, fact-to-version joins та idempotent reruns.",
      expectedResult: "Both validation queries return zero rows for a consistent Type 2 dimension.",
      expectedResultUk: "Обидва validation queries повертають нуль rows для узгодженої Type 2 dimension."
    }]
  },
  {
    id: "data-sensitive-test-data",
    codeExamples: [{
      title: "Verify an environment-specific masking rule",
      titleUk: "Перевірити environment-specific masking rule",
      language: "sql",
      code: `-- Example test environment rule: all synthetic/masked emails use example.invalid\nSELECT id, email\nFROM test_customers\nWHERE email IS NOT NULL\n  AND email NOT LIKE '%@example.invalid';\n\n-- Relationship preservation can be checked without revealing original PII\nSELECT o.id\nFROM test_orders o\nLEFT JOIN test_customers c ON c.id = o.customer_id\nWHERE c.id IS NULL;`,
      explanation: "Prefer synthetic data. When a masked dataset is authorized, validate the masking contract and preserved relationships without reconstructing or comparing exposed production values. The exact marker rule must match the environment's documented masking implementation.",
      explanationUk: "Віддавайте перевагу synthetic data. Якщо masked dataset дозволений, перевіряйте masking contract і збережені relationships без відновлення чи порівняння відкритих production values. Конкретне marker rule має відповідати задокументованій masking implementation цього environment.",
      expectedResult: "No unmasked-looking rows under the documented rule and no broken required relationships.",
      expectedResultUk: "Немає rows, що порушують documented masking rule, і немає зламаних required relationships."
    }]
  },
  {
    id: "bi-semantic-measures-calendars",
    codeExamples: [{
      title: "Reconcile a measure by fiscal period",
      titleUk: "Звірити measure за fiscal period",
      language: "sql",
      code: `SELECT\n  d.fiscal_year,\n  d.fiscal_period,\n  SUM(f.net_amount) AS net_revenue\nFROM fact_sales f\nJOIN dim_date d ON d.date_key = f.date_key\nWHERE d.calendar_date >= DATE '2026-06-25'\n  AND d.calendar_date <  DATE '2026-07-08'\nGROUP BY d.fiscal_year, d.fiscal_period\nORDER BY d.fiscal_year, d.fiscal_period;`,
      explanation: "Use the governed date dimension rather than deriving fiscal periods ad hoc in the test. Reconcile source facts at boundary dates and repeat the comparison across time zones, daylight-saving transitions, incomplete periods and role/filter contexts used by the BI model.",
      explanationUk: "Використовуйте governed date dimension, а не обчислюйте fiscal periods ad hoc у тесті. Звіряйте source facts на boundary dates і повторюйте comparison для time zones, DST transitions, incomplete periods та role/filter contexts, які використовує BI model.",
      expectedResult: "Fiscal-period totals match the semantic model's documented measure and calendar rules.",
      expectedResultUk: "Fiscal-period totals відповідають documented measure і calendar rules semantic model."
    }]
  }
];

export default sqlDataCodeExamples;
