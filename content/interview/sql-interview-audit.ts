export type SqlQuestionScope = "SQL language" | "Database concept" | "DBMS-specific" | "Data / ETL / BI";
export type SqlDialect = "Portable SQL" | "SQL standard" | "PostgreSQL" | "DBMS-dependent";
export type SqlRuntimeEngine = "sqlite" | "static";
export type SqlRuntimeFixture = "sql-playground-v1" | "external-schema" | "multi-session";

export type SqlRuntimeContract = {
  engine: SqlRuntimeEngine;
  fixture: SqlRuntimeFixture;
  note: string;
  noteUk: string;
};

type QuestionPatch = {
  shortAnswer?: string;
  shortAnswerUk?: string;
  example?: string;
  exampleUk?: string;
};

type CodePatch = {
  code?: string;
  explanation?: string;
  explanationUk?: string;
  expectedResult?: string;
  expectedResultUk?: string;
};

export type SqlInterviewAuditEntry = {
  scope: SqlQuestionScope;
  dialect: SqlDialect;
  runtime: SqlRuntimeContract;
  questionPatch?: QuestionPatch;
  codePatch?: CodePatch;
};

const sqlite = (note = "Runs against the resettable SQLite sample database used by the playground.", noteUk = "Виконується проти resettable SQLite sample database, яку використовує playground."): SqlRuntimeContract => ({
  engine: "sqlite",
  fixture: "sql-playground-v1",
  note,
  noteUk,
});

const staticSample = (note: string, noteUk: string): SqlRuntimeContract => ({
  engine: "static",
  fixture: "sql-playground-v1",
  note,
  noteUk,
});

const external = (note: string, noteUk: string): SqlRuntimeContract => ({
  engine: "static",
  fixture: "external-schema",
  note,
  noteUk,
});

const multiSession = (note: string, noteUk: string): SqlRuntimeContract => ({
  engine: "static",
  fixture: "multi-session",
  note,
  noteUk,
});

export const sqlInterviewAudit: Record<string, SqlInterviewAuditEntry> = {
  "relational-versus-nonrelational-databases": {
    scope: "Database concept",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-command-families": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
    codePatch: {
      code: `BEGIN;\n\nSELECT id, status\nFROM orders\nWHERE customer_id = 1;\n\nUPDATE orders\nSET status = 'cancelled'\nWHERE customer_id = 1;\n\n-- Inspect affected rows before deciding:\nSELECT id, status\nFROM orders\nWHERE customer_id = 1;\n\nROLLBACK; -- use COMMIT only when the change is intended`,
    },
  },
  "database-keys-and-constraints": {
    scope: "Database concept",
    dialect: "SQL standard",
    runtime: staticSample(
      "Static negative-test example: it intentionally triggers constraint errors and needs an isolated schema with foreign-key enforcement enabled.",
      "Статичний negative-test example: він навмисно викликає constraint errors і потребує ізольованої schema з увімкненим foreign-key enforcement.",
    ),
    questionPatch: {
      shortAnswer: "A primary key uniquely identifies each row. A foreign key constrains a non-NULL referencing value to a valid referenced key; whether NULL is allowed depends on the column definition. UNIQUE prevents duplicate key values under the DBMS's NULL rules, NOT NULL requires a value, CHECK enforces a predicate and DEFAULT supplies a value when one is omitted. Tests should cover valid writes, each violation, composite keys, update/delete actions and product-specific NULL behavior.",
      shortAnswerUk: "Primary key унікально ідентифікує кожен row. Foreign key вимагає, щоб non-NULL referencing value відповідав існуючому referenced key; чи дозволений NULL, визначає column definition. UNIQUE забороняє дублікати згідно з NULL rules конкретної СУБД, NOT NULL вимагає value, CHECK перевіряє predicate, а DEFAULT підставляє value, якщо його не передано. Тести мають покривати valid writes, кожне порушення, composite keys, update/delete actions і product-specific NULL behavior.",
    },
  },
  "sql-null-semantics": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-where-group-by-having": {
    scope: "SQL language",
    dialect: "SQL standard",
    runtime: staticSample(
      "The DATE 'YYYY-MM-DD' typed literal is SQL-standard syntax, but the browser runner uses SQLite, which does not support that typed DATE literal form.",
      "DATE 'YYYY-MM-DD' — це SQL-standard typed literal, але browser runner використовує SQLite, який не підтримує такий typed DATE literal syntax.",
    ),
  },
  "sql-union-versus-union-all": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-find-duplicate-rows": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
    questionPatch: {
      example: "For example, if the business rule treats email case and surrounding whitespace as insignificant, first normalize the key with LOWER(TRIM(email)), then GROUP BY that normalized expression and keep groups with COUNT(*) greater than one. Inspect the original rows before any cleanup.",
      exampleUk: "Наприклад, якщо business rule не враховує регістр email і пробіли по краях, спочатку нормалізуйте key через LOWER(TRIM(email)), потім GROUP BY normalized expression і залиште groups з COUNT(*) більше одного. До cleanup перегляньте original rows.",
    },
  },
  "sql-find-orphan-records": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "database-normalization-denormalization": {
    scope: "Database concept",
    dialect: "Portable SQL",
    runtime: sqlite(),
    questionPatch: {
      example: "For example, keeping the current customer email once in customers avoids accidental duplicate master data. By contrast, an order shipping address may intentionally be stored as a historical snapshot of the address used at purchase time; that deliberate snapshot is not a normalization defect and should be tested against its own business rule.",
      exampleUk: "Наприклад, зберігання current customer email один раз у customers усуває випадкове дублювання master data. Водночас shipping address у конкретному order може навмисно бути historical snapshot адреси на момент покупки; така свідома копія не є normalization defect і тестується за окремим business rule.",
    },
  },
  "sql-subqueries-and-ctes": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
    codePatch: {
      code: `WITH customer_totals AS (\n  SELECT customer_id, SUM(amount) AS total\n  FROM orders\n  WHERE status = 'paid'\n  GROUP BY customer_id\n)\nSELECT c.id, c.email, t.total\nFROM customers c\nJOIN customer_totals t ON t.customer_id = c.id\nWHERE t.total > 150;`,
      expectedResult: "Customers in the sample database whose paid-order total exceeds 150.",
      expectedResultUk: "Customers у sample database, paid-order total яких перевищує 150.",
    },
  },
  "sql-window-functions": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "star-schema-facts-dimensions-grain": {
    scope: "Data / ETL / BI",
    dialect: "Portable SQL",
    runtime: external("Requires the warehouse fact/dimension schema used by the example.", "Потребує warehouse fact/dimension schema з прикладу."),
  },
  "bi-dashboard-reconciliation": {
    scope: "Data / ETL / BI",
    dialect: "SQL standard",
    runtime: staticSample(
      "Uses a SQL-standard TIMESTAMP typed literal that the SQLite playground does not accept in this form.",
      "Використовує SQL-standard TIMESTAMP typed literal, який SQLite playground не приймає в такій формі.",
    ),
  },
  "database-transactions-acid": {
    scope: "Database concept",
    dialect: "Portable SQL",
    runtime: external("Requires an inventory table and application/test control over the business invariant.", "Потребує inventory table та application/test control над business invariant."),
    codePatch: {
      code: `BEGIN;\n\nUPDATE inventory\nSET quantity = quantity - 1\nWHERE product_id = 10\n  AND quantity > 0;\n\n-- The application/test must assert that exactly one inventory row changed.\n-- If zero rows changed, ROLLBACK and do not create the order.\n\nINSERT INTO orders (id, product_id, status)\nVALUES (1001, 10, 'created');\n\nCOMMIT;`,
      explanation: "Atomicity prevents a partial commit, but ACID does not prove the business rule by itself. The caller must verify the guarded inventory update succeeded before creating the order, and must roll back when the invariant fails.",
      explanationUk: "Atomicity не дозволяє partial commit, але ACID сам по собі не доводить business rule. Caller має перевірити, що guarded inventory update справді успішний, перш ніж створювати order, і зробити rollback, якщо invariant не виконаний.",
      expectedResult: "The order is created only when the guarded inventory update succeeds; otherwise the whole transaction is rolled back.",
      expectedResultUk: "Order створюється лише коли guarded inventory update успішний; інакше вся transaction rollback.",
    },
  },
  "transaction-isolation-anomalies": {
    scope: "Database concept",
    dialect: "DBMS-dependent",
    runtime: multiSession("Requires two concurrent database sessions and an explicitly configured isolation level.", "Потребує двох concurrent database sessions та явно налаштованого isolation level."),
    questionPatch: {
      shortAnswer: "Isolation levels address anomalies such as dirty reads, non-repeatable reads, phantom reads and lost-update/write-skew patterns, with exact guarantees varying by DBMS. A serialization failure is typically a DBMS response when an execution cannot be made consistent with the requested serializable semantics, rather than another read anomaly. Test with controlled concurrent sessions, barriers, retries and assertions on the business invariant.",
      shortAnswerUk: "Isolation levels спрямовані на anomalies на кшталт dirty read, non-repeatable read, phantom read та lost-update/write-skew patterns; точні гарантії залежать від СУБД. Serialization failure зазвичай є реакцією СУБД, коли execution не може відповідати requested serializable semantics, а не ще одним read anomaly. Тестуйте через контрольовані concurrent sessions, barriers, retries та assertions на business invariant.",
    },
  },
  "database-locks-and-deadlocks": {
    scope: "Database concept",
    dialect: "DBMS-dependent",
    runtime: multiSession("A deadlock experiment must coordinate at least two real concurrent sessions.", "Deadlock experiment має координувати щонайменше дві реальні concurrent sessions."),
  },
  "database-indexes": {
    scope: "Database concept",
    dialect: "PostgreSQL",
    runtime: staticSample("EXPLAIN (ANALYZE, BUFFERS) is PostgreSQL-specific; a PostgreSQL execution engine is not wired into the browser yet.", "EXPLAIN (ANALYZE, BUFFERS) — PostgreSQL-specific; PostgreSQL execution engine ще не підключений у browser."),
  },
  "sql-explain-query-plan": {
    scope: "Database concept",
    dialect: "PostgreSQL",
    runtime: staticSample("Uses PostgreSQL EXPLAIN (ANALYZE, BUFFERS), which must execute on PostgreSQL rather than the SQLite playground.", "Використовує PostgreSQL EXPLAIN (ANALYZE, BUFFERS), тому має виконуватися на PostgreSQL, а не SQLite playground."),
    questionPatch: {
      example: "For example, if EXPLAIN ANALYZE estimates 100 rows but observes 50000, investigate stale statistics, skew, correlated columns, parameter values and estimator limitations before deciding that one specific cause or index is responsible.",
      exampleUk: "Наприклад, якщо EXPLAIN ANALYZE оцінює 100 rows, а фактично бачить 50000, перевірте stale statistics, skew, correlated columns, parameter values та estimator limitations, перш ніж приписувати проблему одній конкретній причині чи index.",
    },
  },
  "composite-index-column-order": {
    scope: "Database concept",
    dialect: "Portable SQL",
    runtime: sqlite(),
    questionPatch: {
      example: "For example, an index on (last_name, first_name) naturally supports predicates beginning with last_name. A predicate only on first_name usually cannot exploit the same leading-prefix access as efficiently, although exact alternatives such as scans or skip-scan-like strategies are DBMS/optimizer dependent. Verify the actual plan.",
      exampleUk: "Наприклад, index на (last_name, first_name) природно підтримує predicates, що починаються з last_name. Predicate лише по first_name зазвичай не може так само ефективно використати leading-prefix access, хоча точна альтернатива — scan або skip-scan-like strategy — залежить від СУБД/optimizer. Перевіряйте actual plan.",
    },
    codePatch: {
      code: `CREATE INDEX idx_orders_customer_status_created\nON orders (customer_id, status, created_at DESC);\n\n-- Strong match for leading columns\nSELECT * FROM orders\nWHERE customer_id = 1 AND status = 'paid'\nORDER BY created_at DESC;\n\n-- Later column alone may not benefit as efficiently\nSELECT * FROM orders\nWHERE status = 'paid';`,
    },
  },
  "database-schema-migrations": {
    scope: "Database concept",
    dialect: "PostgreSQL",
    runtime: staticSample("ALTER TABLE ... ALTER COLUMN ... SET NOT NULL is shown in PostgreSQL syntax; migration DDL differs substantially by DBMS.", "ALTER TABLE ... ALTER COLUMN ... SET NOT NULL показано в PostgreSQL syntax; migration DDL суттєво відрізняється між СУБД."),
  },
  "database-data-types-and-boundaries": {
    scope: "Database concept",
    dialect: "PostgreSQL",
    runtime: staticSample("TIMESTAMPTZ and the demonstrated type enforcement are PostgreSQL-oriented and should not be simulated with SQLite's different typing model.", "TIMESTAMPTZ і показаний type enforcement орієнтовані на PostgreSQL; їх не слід імітувати через іншу typing model SQLite."),
  },
  "database-test-data-isolation": {
    scope: "Database concept",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "database-replication-backup-recovery": {
    scope: "Database concept",
    dialect: "SQL standard",
    runtime: staticSample("The control query uses a SQL-standard DATE typed literal; real replication/recovery validation must also run against the authoritative and restored/replica databases.", "Control query використовує SQL-standard DATE typed literal; реальна replication/recovery validation також має виконуватись проти authoritative та restored/replica databases."),
  },
  "sql-injection-parameterized-queries": {
    scope: "SQL language",
    dialect: "PostgreSQL",
    runtime: staticSample("$1 is PostgreSQL positional-parameter syntax and requires a database driver to bind the value separately from SQL text.", "$1 — PostgreSQL positional-parameter syntax і потребує database driver, який bind value окремо від SQL text."),
  },
  "database-views-procedures-triggers": {
    scope: "Database concept",
    dialect: "Portable SQL",
    runtime: sqlite(),
    codePatch: {
      code: `CREATE VIEW paid_order_totals AS\nSELECT customer_id, SUM(amount) AS total\nFROM orders\nWHERE status = 'paid'\nGROUP BY customer_id;\n\nSELECT *\nFROM paid_order_totals\nWHERE customer_id = 1;`,
    },
  },
  "etl-testing-basics": {
    scope: "Data / ETL / BI",
    dialect: "SQL standard",
    runtime: external("Requires source_orders and warehouse_orders from an ETL test environment; the DATE literals are SQL-standard syntax.", "Потребує source_orders і warehouse_orders з ETL test environment; DATE literals є SQL-standard syntax."),
  },
  "data-quality-dimensions": {
    scope: "Data / ETL / BI",
    dialect: "Portable SQL",
    runtime: sqlite(),
    codePatch: {
      code: `SELECT\n  COUNT(*) AS total_rows,\n  SUM(CASE WHEN customer_id IS NULL THEN 1 ELSE 0 END) AS missing_customer_id,\n  SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) AS invalid_amount,\n  COUNT(DISTINCT customer_id) AS distinct_customers,\n  MAX(updated_at) AS newest_update\nFROM orders;\n\nSELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS copies\nFROM users\nWHERE email IS NOT NULL\nGROUP BY LOWER(TRIM(email))\nHAVING COUNT(*) > 1;`,
      explanation: "Completeness, validity, uniqueness and freshness need explicit rules and thresholds. This example checks fields that actually exist in the sample orders schema and applies the same normalized-email uniqueness rule used by the duplicate example.",
      explanationUk: "Completeness, validity, uniqueness і freshness потребують явних rules та thresholds. Цей example перевіряє fields, які реально існують у sample orders schema, і застосовує той самий normalized-email uniqueness rule, що й duplicate example.",
    },
  },
  "data-source-target-lineage": {
    scope: "Data / ETL / BI",
    dialect: "SQL standard",
    runtime: external("Requires source and warehouse tables at the declared business-key grain.", "Потребує source та warehouse tables на задекларованому business-key grain."),
  },
  "data-batch-streaming-late-events": {
    scope: "Data / ETL / BI",
    dialect: "Portable SQL",
    runtime: external("Requires the raw_events ingestion table and controlled late/duplicate/reordered events.", "Потребує raw_events ingestion table та контрольованих late/duplicate/reordered events."),
  },
  "data-upstream-schema-drift": {
    scope: "Data / ETL / BI",
    dialect: "PostgreSQL",
    runtime: external("The example assumes PostgreSQL's public schema conventions and PostgreSQL-style information_schema type names.", "Example припускає PostgreSQL public schema conventions та PostgreSQL-style information_schema type names."),
  },
  "data-slowly-changing-dimensions": {
    scope: "Data / ETL / BI",
    dialect: "Portable SQL",
    runtime: external("Requires a Type 2 dim_customer history table; the example assumes valid_to is an exclusive end boundary.", "Потребує Type 2 dim_customer history table; example припускає, що valid_to є exclusive end boundary."),
    codePatch: {
      code: `WITH history AS (\n  SELECT\n    customer_id,\n    valid_from,\n    valid_to,\n    is_current,\n    LEAD(valid_from) OVER (\n      PARTITION BY customer_id\n      ORDER BY valid_from\n    ) AS next_valid_from\n  FROM dim_customer\n)\nSELECT *\nFROM history\nWHERE next_valid_from IS NOT NULL\n  AND (valid_to IS NULL OR valid_to > next_valid_from);\n\nSELECT customer_id,\n       SUM(CASE WHEN is_current = TRUE THEN 1 ELSE 0 END) AS current_rows\nFROM dim_customer\nGROUP BY customer_id\nHAVING SUM(CASE WHEN is_current = TRUE THEN 1 ELSE 0 END) <> 1;`,
      explanation: "Assuming half-open validity ranges [valid_from, valid_to), Type 2 history should not overlap and each tracked entity should have exactly one current version. Aggregating all history rows, rather than filtering to current rows first, allows the second check to detect both zero and multiple current versions.",
      explanationUk: "Якщо validity ranges є half-open [valid_from, valid_to), Type 2 history не повинна overlap, а кожна tracked entity має мати рівно одну current version. Aggregation усіх history rows, а не попередній filter лише current rows, дозволяє другому check знайти як zero, так і multiple current versions.",
    },
  },
  "data-sensitive-test-data": {
    scope: "Data / ETL / BI",
    dialect: "Portable SQL",
    runtime: external("Requires the authorized masked/synthetic test_customers and test_orders dataset.", "Потребує authorized masked/synthetic test_customers і test_orders dataset."),
    codePatch: {
      code: `-- Example test environment rule: all synthetic/masked emails use example.invalid\nSELECT id, email\nFROM test_customers\nWHERE email IS NOT NULL\n  AND email NOT LIKE '%@example.invalid';\n\n-- Find non-NULL references whose parent row is missing\nSELECT o.id\nFROM test_orders o\nLEFT JOIN test_customers c ON c.id = o.customer_id\nWHERE o.customer_id IS NOT NULL\n  AND c.id IS NULL;`,
    },
  },
  "bi-semantic-measures-calendars": {
    scope: "Data / ETL / BI",
    dialect: "SQL standard",
    runtime: external("Requires governed fact_sales/dim_date tables and uses SQL-standard DATE typed literals.", "Потребує governed fact_sales/dim_date tables і використовує SQL-standard DATE typed literals."),
  },
  "database-test-scope": {
    scope: "Database concept",
    dialect: "Portable SQL",
    runtime: sqlite("Runs against the sample database, which intentionally contains one orphan order so the integrity query demonstrates a real failure.", "Виконується проти sample database, де навмисно є один orphan order, щоб integrity query показав реальний failure."),
    codePatch: {
      expectedResult: "In the sample fixture the first query intentionally returns the orphan order; a healthy production integrity check should return zero rows. The persisted-state query should return zero rows.",
      expectedResultUk: "У sample fixture перший query навмисно повертає orphan order; у здоровому production integrity check очікується zero rows. Persisted-state query має повернути zero rows.",
    },
  },
  "sql-joins-and-aggregation": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-return-all-duplicate-rows": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-deduplicate-keep-latest": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-latest-row-per-group": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-second-highest-distinct-value": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
    codePatch: {
      code: `WITH r AS (\n  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS pos\n  FROM employees\n  WHERE salary IS NOT NULL\n)\nSELECT DISTINCT salary FROM r WHERE pos = 2;`,
      explanation: "DENSE_RANK gives equal non-NULL values the same position without gaps, so position 2 is the second-highest distinct salary. NULL is excluded explicitly so DBMS-specific NULL ordering cannot change the answer.",
      explanationUk: "DENSE_RANK надає однаковим non-NULL values одну позицію без gaps, тому pos = 2 означає second-highest distinct salary. NULL виключено явно, щоб DBMS-specific NULL ordering не змінював answer.",
    },
  },
  "sql-top-n-per-group": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-find-entities-without-related-rows": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-compare-expected-actual-datasets": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-running-total": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
    codePatch: {
      code: `SELECT account_id, occurred_at, amount,\n       SUM(amount) OVER (\n         PARTITION BY account_id\n         ORDER BY occurred_at, id\n         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\n       ) AS running_total\nFROM ledger\nORDER BY account_id, occurred_at, id;`,
    },
  },
  "sql-compare-previous-row": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
    codePatch: {
      code: `WITH x AS (\n  SELECT e.*,\n         LAG(status) OVER (\n           PARTITION BY entity_id ORDER BY occurred_at, id\n         ) AS previous_status,\n         ROW_NUMBER() OVER (\n           PARTITION BY entity_id ORDER BY occurred_at, id\n         ) AS rn\n  FROM events e\n)\nSELECT * FROM x\nWHERE rn > 1\n  AND (\n    status <> previous_status\n    OR (status IS NULL AND previous_status IS NOT NULL)\n    OR (status IS NOT NULL AND previous_status IS NULL)\n  );`,
      explanation: "LAG exposes the previous status, while ROW_NUMBER distinguishes the first event from a real previous NULL. The explicit NULL branches make NULL-to-value and value-to-NULL transitions visible without relying on a DBMS-specific null-safe comparison operator.",
      explanationUk: "LAG показує previous status, а ROW_NUMBER відрізняє first event від реального previous NULL. Явні NULL branches знаходять NULL→value та value→NULL transitions без DBMS-specific null-safe comparison operator.",
    },
  },
  "sql-find-sequence-gaps": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-conditional-aggregation": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-detect-join-multiplication": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
  "sql-keyset-pagination": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite("The core keyset predicate is portable; this playground uses SQLite LIMIT syntax for the bounded page.", "Core keyset predicate є portable; playground використовує SQLite LIMIT syntax для bounded page."),
    codePatch: {
      code: `SELECT id, customer_id, status, created_at\nFROM orders\nWHERE created_at < :last_created_at\n   OR (created_at = :last_created_at AND id < :last_id)\nORDER BY created_at DESC, id DESC\nLIMIT :limit;`,
      explanation: "Use the last seen (created_at, id) tuple as the cursor and keep the predicate aligned with the deterministic descending ORDER BY. The playground uses SQLite LIMIT syntax and sample parameter values.",
      explanationUk: "Використовуйте last seen tuple (created_at, id) як cursor і тримайте predicate узгодженим із deterministic descending ORDER BY. Playground використовує SQLite LIMIT syntax і sample parameter values.",
      expectedResult: "The next bounded page after the configured sample cursor, in deterministic descending order.",
      expectedResultUk: "Наступна bounded page після налаштованого sample cursor у deterministic descending order.",
    },
  },
  "sql-percent-of-total": {
    scope: "SQL language",
    dialect: "Portable SQL",
    runtime: sqlite(),
  },
};

type AuditableCodeExample = {
  code: string;
  explanation: string;
  explanationUk?: string;
  expectedResult?: string;
  expectedResultUk?: string;
  sqlDialect?: SqlDialect;
  sqlRuntime?: SqlRuntimeContract;
};

type AuditableQuestion = {
  id: string;
  shortAnswer?: string;
  shortAnswerUk?: string;
  example?: string;
  exampleUk?: string;
  codeExamples?: AuditableCodeExample[];
  sqlScope?: SqlQuestionScope;
};

export function applySqlInterviewAudit<T extends AuditableQuestion>(question: T): T {
  const audit = sqlInterviewAudit[question.id];
  if (!audit) return question;

  const codeExamples = question.codeExamples?.map((example) => ({
    ...example,
    ...(audit.codePatch ?? {}),
    sqlDialect: audit.dialect,
    sqlRuntime: audit.runtime,
  }));

  return {
    ...question,
    ...(audit.questionPatch ?? {}),
    ...(codeExamples ? { codeExamples } : {}),
    sqlScope: audit.scope,
  } as T;
}
