export interface InterviewCodeExample {
  title: string;
  titleUk: string;
  language: "sql";
  code: string;
  explanation: string;
  explanationUk: string;
  expectedResult?: string;
  expectedResultUk?: string;
}

export interface InterviewCodeExampleEnhancement {
  id: string;
  codeExamples: InterviewCodeExample[];
}

const sqlCodeExamples: InterviewCodeExampleEnhancement[] = [
  {
    id: "relational-versus-nonrelational-databases",
    codeExamples: [{
      title: "Relational lookup across a declared relationship",
      titleUk: "Реляційний запит через заданий зв'язок",
      language: "sql",
      code: `SELECT o.id, o.total, c.email\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'paid';`,
      explanation: "The foreign-key relationship gives the query an explicit join path. A document database may instead embed customer data inside the order, so the equivalent test focuses on duplicated embedded values and update consistency rather than JOIN correctness.",
      explanationUk: "Foreign key задає явний шлях JOIN. У document database дані клієнта можуть бути вкладені в order, тому еквівалентний тест більше перевіряє дубльовані embedded values та їх узгоджене оновлення, а не коректність JOIN.",
      expectedResult: "Paid orders paired with an existing customer row.",
      expectedResultUk: "Оплачені замовлення, зіставлені з існуючим рядком клієнта."
    }]
  },
  {
    id: "sql-command-families",
    codeExamples: [{
      title: "Preview a write and keep a rollback path",
      titleUk: "Перевірити write перед зміною та зберегти rollback",
      language: "sql",
      code: `BEGIN;\n\nSELECT id, status\nFROM orders\nWHERE customer_id = 42;\n\nUPDATE orders\nSET status = 'cancelled'\nWHERE customer_id = 42;\n\n-- Inspect affected rows before deciding:\nSELECT id, status\nFROM orders\nWHERE customer_id = 42;\n\nROLLBACK; -- use COMMIT only when the change is intended`,
      explanation: "SELECT is used as a safe preview, UPDATE changes state, and the explicit transaction keeps the operation reversible while it is being verified. The same separation applies to INSERT/DELETE, while CREATE/ALTER/DROP change schema objects.",
      explanationUk: "SELECT використовується як безпечний preview, UPDATE змінює стан, а явна транзакція залишає операцію оборотною під час перевірки. Та сама логіка стосується INSERT/DELETE, тоді як CREATE/ALTER/DROP змінюють об'єкти схеми.",
      expectedResult: "The rows change inside the transaction and return to their previous state after ROLLBACK.",
      expectedResultUk: "Рядки змінюються всередині транзакції та повертаються до попереднього стану після ROLLBACK."
    }]
  },
  {
    id: "database-keys-and-constraints",
    codeExamples: [{
      title: "Declare and then challenge integrity constraints",
      titleUk: "Оголосити та перевірити constraints цілісності",
      language: "sql",
      code: `CREATE TABLE users (\n  id BIGINT PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  age INTEGER CHECK (age >= 18),\n  status TEXT DEFAULT 'active'\n);\n\nCREATE TABLE orders (\n  id BIGINT PRIMARY KEY,\n  user_id BIGINT NOT NULL REFERENCES users(id)\n);\n\n-- Negative tests:\nINSERT INTO users (id, email, age) VALUES (1, 'a@example.com', 17);\nINSERT INTO orders (id, user_id) VALUES (10, 999);`,
      explanation: "The first negative insert should violate CHECK; the second should violate the foreign key. Similar tests should cover duplicate email, NULL email, updates and delete behavior on referenced users.",
      explanationUk: "Перший негативний INSERT має порушити CHECK, другий — foreign key. Аналогічно потрібно перевірити duplicate email, NULL email, UPDATE та поведінку DELETE для referenced users.",
      expectedResult: "Both negative inserts are rejected by the database.",
      expectedResultUk: "Обидва негативні INSERT відхиляються базою даних."
    }]
  },
  {
    id: "sql-null-semantics",
    codeExamples: [{
      title: "NULL comparison: wrong and correct forms",
      titleUk: "Порівняння NULL: неправильна та правильна форми",
      language: "sql",
      code: `-- Wrong: comparison evaluates to UNKNOWN\nSELECT * FROM users WHERE phone = NULL;\n\n-- Correct\nSELECT * FROM users WHERE phone IS NULL;\n\n-- Safer anti-join when the subquery key may contain NULL\nSELECT c.*\nFROM customers c\nWHERE NOT EXISTS (\n  SELECT 1 FROM orders o WHERE o.customer_id = c.id\n);`,
      explanation: "NULL is not an ordinary value, so equality does not test for absence. NOT EXISTS is also preferable to NOT IN when the subquery can contain NULL because three-valued logic can otherwise make every comparison UNKNOWN.",
      explanationUk: "NULL не є звичайним значенням, тому equality не перевіряє відсутність. NOT EXISTS також безпечніший за NOT IN, коли підзапит може містити NULL, бо three-valued logic інакше може зробити всі порівняння UNKNOWN.",
      expectedResult: "IS NULL returns missing phones; the NOT EXISTS query returns customers without matching orders.",
      expectedResultUk: "IS NULL повертає відсутні phone, а NOT EXISTS — клієнтів без пов'язаних orders."
    }]
  },
  {
    id: "sql-where-group-by-having",
    codeExamples: [{
      title: "Filter rows, aggregate, then filter groups",
      titleUk: "Відфільтрувати рядки, агрегувати та відфільтрувати групи",
      language: "sql",
      code: `SELECT customer_id, SUM(amount) AS total\nFROM orders\nWHERE order_date >= DATE '2025-01-01'\n  AND order_date <  DATE '2026-01-01'\nGROUP BY customer_id\nHAVING SUM(amount) > 1000\nORDER BY total DESC;`,
      explanation: "WHERE removes rows before aggregation, GROUP BY creates one group per customer, and HAVING keeps only aggregated groups whose total is above the threshold.",
      explanationUk: "WHERE відкидає рядки до агрегації, GROUP BY створює одну групу на клієнта, а HAVING залишає лише агреговані групи, total яких перевищує поріг.",
      expectedResult: "Customers whose 2025 order total is greater than 1000.",
      expectedResultUk: "Клієнти, сума замовлень яких за 2025 рік перевищує 1000."
    }]
  },
  {
    id: "sql-union-versus-union-all",
    codeExamples: [{
      title: "See duplicate removal versus retention",
      titleUk: "Побачити видалення та збереження дублікатів",
      language: "sql",
      code: `-- Removes identical result rows\nSELECT email FROM active_customers\nUNION\nSELECT email FROM archived_customers;\n\n-- Keeps every row\nSELECT email FROM active_customers\nUNION ALL\nSELECT email FROM archived_customers;`,
      explanation: "UNION performs duplicate elimination across the combined result. UNION ALL preserves multiplicity and is usually cheaper when duplicate removal is not part of the requirement.",
      explanationUk: "UNION видаляє дублікати в об'єднаному результаті. UNION ALL зберігає multiplicity і зазвичай дешевший, коли видалення дублікатів не є вимогою.",
      expectedResult: "UNION may return fewer rows than UNION ALL when the inputs overlap.",
      expectedResultUk: "UNION може повернути менше рядків за UNION ALL, якщо input sets перетинаються."
    }]
  },
  {
    id: "sql-find-duplicate-rows",
    codeExamples: [{
      title: "Find duplicate normalized business keys",
      titleUk: "Знайти дублікати нормалізованого бізнес-ключа",
      language: "sql",
      code: `SELECT\n  LOWER(TRIM(email)) AS normalized_email,\n  COUNT(*) AS copies\nFROM users\nWHERE email IS NOT NULL\nGROUP BY LOWER(TRIM(email))\nHAVING COUNT(*) > 1\nORDER BY copies DESC;`,
      explanation: "GROUP BY collapses rows to the business-key grain and HAVING filters after the count is calculated. Normalization makes the query match a rule where case and surrounding whitespace are insignificant.",
      explanationUk: "GROUP BY згортає рядки до grain бізнес-ключа, а HAVING фільтрує після обчислення count. Нормалізація відповідає правилу, де регістр і пробіли на краях не мають значення.",
      expectedResult: "One row per duplicated normalized email, with the number of copies.",
      expectedResultUk: "Один рядок на кожен дубльований normalized email із кількістю копій."
    }]
  },
  {
    id: "sql-find-orphan-records",
    codeExamples: [{
      title: "Find child rows whose parent is missing",
      titleUk: "Знайти child rows без існуючого parent",
      language: "sql",
      code: `SELECT o.*\nFROM orders o\nWHERE o.customer_id IS NOT NULL\n  AND NOT EXISTS (\n    SELECT 1\n    FROM customers c\n    WHERE c.id = o.customer_id\n  );`,
      explanation: "The child row is kept only when no matching parent exists. The explicit customer_id IS NOT NULL condition avoids treating a deliberately nullable relationship as an orphan.",
      explanationUk: "Child row залишається лише тоді, коли matching parent не існує. Явна умова customer_id IS NOT NULL не дозволяє помилково трактувати навмисно nullable relationship як orphan.",
      expectedResult: "Zero rows when referential integrity is intact.",
      expectedResultUk: "Нуль рядків, коли referential integrity не порушена."
    }]
  },
  {
    id: "database-normalization-denormalization",
    codeExamples: [{
      title: "Normalized order/customer model",
      titleUk: "Нормалізована модель order/customer",
      language: "sql",
      code: `SELECT\n  o.id AS order_id,\n  o.total,\n  c.id AS customer_id,\n  c.email\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.id = :order_id;`,
      explanation: "Customer identity is stored once and referenced from orders, reducing update anomalies. A denormalized design that copied customer email into every order would need tests proving those copies stay consistent when the source value changes.",
      explanationUk: "Customer identity зберігається один раз і referenced з orders, що зменшує update anomalies. Denormalized design із копією email у кожному order потребував би тестів узгодженості цих копій після зміни source value.",
      expectedResult: "One order resolved to its current customer record through the relationship.",
      expectedResultUk: "Один order, зв'язаний з актуальним customer record через relationship."
    }]
  },
  {
    id: "sql-subqueries-and-ctes",
    codeExamples: [{
      title: "CTE for a named intermediate result",
      titleUk: "CTE для іменованого проміжного результату",
      language: "sql",
      code: `WITH customer_totals AS (\n  SELECT customer_id, SUM(amount) AS total\n  FROM orders\n  WHERE status = 'paid'\n  GROUP BY customer_id\n)\nSELECT c.id, c.email, t.total\nFROM customers c\nJOIN customer_totals t ON t.customer_id = c.id\nWHERE t.total > 1000;`,
      explanation: "The CTE isolates the aggregation and gives it a name before it is joined to customer data. This often makes complex logic easier to reason about and test independently than deeply nested subqueries.",
      explanationUk: "CTE ізолює агрегацію та дає їй ім'я до JOIN з customer data. Це часто полегшує аналіз і окреме тестування складної логіки порівняно з глибоко вкладеними subqueries.",
      expectedResult: "Customers whose paid-order total exceeds 1000.",
      expectedResultUk: "Клієнти, total оплачених замовлень яких перевищує 1000."
    }]
  },
  {
    id: "sql-window-functions",
    codeExamples: [{
      title: "Latest row per customer with ROW_NUMBER",
      titleUk: "Останній рядок кожного клієнта через ROW_NUMBER",
      language: "sql",
      code: `WITH ranked AS (\n  SELECT\n    o.*,\n    ROW_NUMBER() OVER (\n      PARTITION BY customer_id\n      ORDER BY created_at DESC, id DESC\n    ) AS rn\n  FROM orders o\n)\nSELECT *\nFROM ranked\nWHERE rn = 1;`,
      explanation: "Window functions calculate across related rows without collapsing them. PARTITION BY restarts the ranking for each customer, and the stable secondary ordering makes ties deterministic.",
      explanationUk: "Window functions обчислюють значення по пов'язаних рядках, не згортаючи їх. PARTITION BY починає ranking заново для кожного customer, а стабільне вторинне сортування детерміновано розв'язує ties.",
      expectedResult: "Exactly one newest order per customer with orders.",
      expectedResultUk: "Рівно один найновіший order для кожного клієнта, який має orders."
    }]
  },
  {
    id: "star-schema-facts-dimensions-grain",
    codeExamples: [{
      title: "Aggregate facts through dimensions at a declared grain",
      titleUk: "Агрегувати facts через dimensions на заданому grain",
      language: "sql",
      code: `SELECT\n  d.calendar_date,\n  p.category,\n  SUM(f.sales_amount) AS revenue\nFROM fact_sales f\nJOIN dim_date d    ON d.date_key = f.date_key\nJOIN dim_product p ON p.product_key = f.product_key\nGROUP BY d.calendar_date, p.category\nORDER BY d.calendar_date, p.category;`,
      explanation: "The fact table supplies measures and foreign keys; dimensions supply descriptive attributes. QA should verify that each join preserves the intended fact grain and does not duplicate sales rows.",
      explanationUk: "Fact table містить measures і foreign keys, dimensions — описові attributes. QA має перевірити, що кожен JOIN зберігає очікуваний fact grain і не дублює sales rows.",
      expectedResult: "One aggregate row per date/category without duplicated fact measures.",
      expectedResultUk: "Один агрегований рядок на date/category без дублювання fact measures."
    }]
  },
  {
    id: "bi-dashboard-reconciliation",
    codeExamples: [{
      title: "Independent control total for a dashboard KPI",
      titleUk: "Незалежний control total для dashboard KPI",
      language: "sql",
      code: `SELECT\n  COUNT(*) AS paid_orders,\n  SUM(amount) AS paid_revenue\nFROM orders\nWHERE status = 'paid'\n  AND paid_at >= TIMESTAMP '2026-08-01 00:00:00'\n  AND paid_at <  TIMESTAMP '2026-09-01 00:00:00';`,
      explanation: "The query reproduces the business definition directly from source rows rather than copying the dashboard calculation. The comparison must use the same time zone, status definition, refresh cutoff and grain as the KPI specification.",
      explanationUk: "Запит відтворює business definition безпосередньо з source rows, а не копіює dashboard calculation. Порівняння має використовувати ті самі timezone, status definition, refresh cutoff і grain, що й специфікація KPI.",
      expectedResult: "Source counts and totals that can be reconciled against the displayed KPI.",
      expectedResultUk: "Source counts і totals, які можна звірити з відображеним KPI."
    }]
  },
  {
    id: "database-transactions-acid",
    codeExamples: [{
      title: "Atomic multi-step business change",
      titleUk: "Атомарна багатокрокова бізнес-зміна",
      language: "sql",
      code: `BEGIN;\n\nUPDATE inventory\nSET quantity = quantity - 1\nWHERE product_id = 10\n  AND quantity > 0;\n\nINSERT INTO orders (id, product_id, status)\nVALUES (1001, 10, 'created');\n\nCOMMIT;\n-- On any failed invariant, ROLLBACK instead.`,
      explanation: "The inventory update and order insert form one business unit. An injected failure between the two statements should not leave only half of the state committed; that is the practical atomicity check.",
      explanationUk: "Inventory update та order insert утворюють одну business unit. Ін'єкція failure між двома statements не повинна залишити закоміченою лише половину стану — це практична перевірка atomicity.",
      expectedResult: "Either both changes commit or neither change remains after rollback/failure.",
      expectedResultUk: "Або обидві зміни commit, або після rollback/failure не залишається жодної."
    }]
  },
  {
    id: "transaction-isolation-anomalies",
    codeExamples: [{
      title: "Two-session non-repeatable-read experiment",
      titleUk: "Двосесійний експеримент з non-repeatable read",
      language: "sql",
      code: `-- Session A\nBEGIN;\nSELECT balance FROM accounts WHERE id = 1;\n-- pause here\nSELECT balance FROM accounts WHERE id = 1;\nCOMMIT;\n\n-- Session B, during the pause\nBEGIN;\nUPDATE accounts SET balance = balance + 100 WHERE id = 1;\nCOMMIT;`,
      explanation: "Run the statements with a deliberate barrier between Session A reads. What Session A observes depends on the configured isolation level and the database's MVCC/locking implementation, so the test should assert the business invariant rather than only the isolation-level label.",
      explanationUk: "Виконайте statements із контрольованою паузою між reads у Session A. Те, що бачить Session A, залежить від isolation level та MVCC/locking реалізації БД, тому тест має перевіряти business invariant, а не лише назву рівня ізоляції.",
      expectedResult: "Observation differs by isolation level; the test records whether the second read may see Session B's committed change.",
      expectedResultUk: "Спостереження залежить від isolation level; тест фіксує, чи може другий read побачити committed change із Session B."
    }]
  },
  {
    id: "database-locks-and-deadlocks",
    codeExamples: [{
      title: "Create a deterministic deadlock in two sessions",
      titleUk: "Створити детермінований deadlock у двох sessions",
      language: "sql",
      code: `-- Session A\nBEGIN;\nUPDATE accounts SET balance = balance - 10 WHERE id = 1;\n-- then wait and update id = 2\nUPDATE accounts SET balance = balance + 10 WHERE id = 2;\n\n-- Session B\nBEGIN;\nUPDATE accounts SET balance = balance - 20 WHERE id = 2;\n-- then wait and update id = 1\nUPDATE accounts SET balance = balance + 20 WHERE id = 1;`,
      explanation: "Each session holds one row lock and then requests the row held by the other session, creating a wait cycle. The database should abort one participant; the application test then verifies rollback, bounded retry and no duplicated business effect.",
      explanationUk: "Кожна session утримує один row lock і потім запитує row, заблокований іншою session, утворюючи цикл очікування. БД має abort одну транзакцію; application test після цього перевіряє rollback, bounded retry та відсутність дубльованого business effect.",
      expectedResult: "One transaction is chosen as the deadlock victim and rolled back rather than both waiting forever.",
      expectedResultUk: "Одна транзакція обирається deadlock victim і rollback, замість нескінченного очікування обох."
    }]
  },
  {
    id: "database-indexes",
    codeExamples: [{
      title: "Index a real query shape and measure it",
      titleUk: "Проіндексувати реальний query shape та виміряти",
      language: "sql",
      code: `CREATE INDEX idx_orders_customer_created\nON orders (customer_id, created_at DESC);\n\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT id, status, created_at\nFROM orders\nWHERE customer_id = 42\nORDER BY created_at DESC\nLIMIT 20;`,
      explanation: "The index matches the equality predicate and requested ordering. The execution plan proves whether the optimizer actually uses it and whether the measured read benefit justifies its storage and write cost.",
      explanationUk: "Index відповідає equality predicate та потрібному ordering. Execution plan показує, чи optimizer реально його використовує і чи виправдовує measured read benefit витрати на storage та writes.",
      expectedResult: "A plan that can retrieve the customer's newest rows efficiently on representative data.",
      expectedResultUk: "Plan, який ефективно дістає найновіші rows клієнта на representative data."
    }]
  },
  {
    id: "sql-explain-query-plan",
    codeExamples: [{
      title: "Compare estimated and actual execution",
      titleUk: "Порівняти estimated та actual execution",
      language: "sql",
      code: `EXPLAIN (ANALYZE, BUFFERS)\nSELECT c.id, SUM(o.amount) AS total\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nWHERE o.created_at >= DATE '2026-01-01'\nGROUP BY c.id\nHAVING SUM(o.amount) > 1000;`,
      explanation: "Inspect scan types, join order, estimated versus actual rows, filters, sorts, timing and buffer activity. Large estimate errors can point to stale statistics, skewed data or predicates the optimizer cannot estimate well.",
      explanationUk: "Перевіряйте scan types, join order, estimated проти actual rows, filters, sorts, timing і buffer activity. Великі помилки оцінки можуть вказувати на stale statistics, skewed data або predicates, які optimizer погано оцінює.",
      expectedResult: "A measured plan whose expensive or misestimated nodes identify where investigation should continue.",
      expectedResultUk: "Measured plan, дорогі або неправильно оцінені nodes якого показують напрям подальшого investigation."
    }]
  },
  {
    id: "composite-index-column-order",
    codeExamples: [{
      title: "Leading-column behavior of a composite index",
      titleUk: "Поведінка leading columns у composite index",
      language: "sql",
      code: `CREATE INDEX idx_orders_customer_status_created\nON orders (customer_id, status, created_at DESC);\n\n-- Strong match for leading columns\nSELECT * FROM orders\nWHERE customer_id = 42 AND status = 'paid'\nORDER BY created_at DESC;\n\n-- Later column alone may not benefit efficiently\nSELECT * FROM orders\nWHERE status = 'paid';`,
      explanation: "The index is ordered first by customer_id, then status, then created_at. Queries that constrain the leading key sequence usually benefit more than a query that only filters a later column.",
      explanationUk: "Index впорядкований спочатку за customer_id, потім status і created_at. Queries, що обмежують leading key sequence, зазвичай отримують більше користі, ніж query з filter лише по пізнішій колонці.",
      expectedResult: "Different plans for the two query shapes, verified with representative data rather than assumed from index existence.",
      expectedResultUk: "Різні plans для двох query shapes, перевірені на representative data, а не припущені лише через наявність index."
    }]
  },
  {
    id: "database-schema-migrations",
    codeExamples: [{
      title: "Backfill and verify a new constrained column",
      titleUk: "Backfill та перевірка нової constrained column",
      language: "sql",
      code: `ALTER TABLE orders ADD COLUMN currency CHAR(3);\n\nUPDATE orders\nSET currency = 'USD'\nWHERE currency IS NULL;\n\nSELECT COUNT(*) AS missing_currency\nFROM orders\nWHERE currency IS NULL;\n\nALTER TABLE orders ALTER COLUMN currency SET NOT NULL;`,
      explanation: "A safe migration separates schema introduction, data backfill, verification and constraint enforcement. Production rehearsal should also measure locks/duration and cover interruption, rollback or forward-fix behavior.",
      explanationUk: "Безпечна migration розділяє додавання schema, data backfill, verification та enforcement constraint. Production rehearsal також має вимірювати locks/duration і покривати interruption, rollback або forward-fix behavior.",
      expectedResult: "The verification query returns zero before NOT NULL is enforced.",
      expectedResultUk: "Verification query повертає нуль до того, як застосовується NOT NULL."
    }]
  },
  {
    id: "database-data-types-and-boundaries",
    codeExamples: [{
      title: "Probe numeric, text and timestamp boundaries",
      titleUk: "Перевірити numeric, text та timestamp boundaries",
      language: "sql",
      code: `CREATE TABLE payments (\n  amount NUMERIC(10,2) NOT NULL,\n  reference VARCHAR(8) NOT NULL,\n  paid_at TIMESTAMPTZ NOT NULL\n);\n\n-- Boundary probes\nINSERT INTO payments VALUES (99999999.99, 'ABCDEFGH', '2026-03-29T00:30:00+00');\nINSERT INTO payments VALUES (100000000.00, 'ABCDEFGHI', '2026-03-29T00:30:00+00');`,
      explanation: "The first row is at declared numeric/text limits; the second exceeds both. Boundary tests should also trace rounding, encoding and time-zone conversions through API, application, database and export layers.",
      explanationUk: "Перший row знаходиться на declared numeric/text limits, другий перевищує обидві. Boundary tests також мають простежувати rounding, encoding і timezone conversions через API, application, database та export layers.",
      expectedResult: "The in-range insert succeeds and the out-of-range values are rejected rather than silently truncated.",
      expectedResultUk: "In-range INSERT успішний, а out-of-range values відхиляються замість silent truncation."
    }]
  },
  {
    id: "database-test-data-isolation",
    codeExamples: [{
      title: "Transaction-scoped integration-test data",
      titleUk: "Integration-test data у межах транзакції",
      language: "sql",
      code: `BEGIN;\n\nINSERT INTO users (id, email)\nVALUES (900001, 'test-900001@example.invalid');\n\nSELECT id, email\nFROM users\nWHERE id = 900001;\n\nROLLBACK;\n\nSELECT COUNT(*)\nFROM users\nWHERE id = 900001;`,
      explanation: "The test owns a unique row and rolls it back after assertions. This pattern is useful when the behavior under test does not require observing a committed transaction from another connection; otherwise a disposable schema/database or explicit cleanup may be more faithful.",
      explanationUk: "Тест володіє унікальним row і робить rollback після assertions. Патерн підходить, коли behavior under test не потребує бачити committed transaction з іншого connection; інакше disposable schema/database або explicit cleanup може бути точнішим.",
      expectedResult: "The final count is zero after rollback.",
      expectedResultUk: "Після rollback фінальний count дорівнює нулю."
    }]
  },
  {
    id: "database-replication-backup-recovery",
    codeExamples: [{
      title: "Verify restored or replicated business data",
      titleUk: "Перевірити restored або replicated business data",
      language: "sql",
      code: `SELECT\n  COUNT(*) AS order_count,\n  SUM(amount) AS revenue,\n  MAX(updated_at) AS newest_update\nFROM orders\nWHERE created_at >= DATE '2026-08-01';\n\nSELECT status, COUNT(*)\nFROM orders\nWHERE created_at >= DATE '2026-08-01'\nGROUP BY status\nORDER BY status;`,
      explanation: "Run the same control queries against the authoritative database and the replica/restored database. Matching infrastructure status is not enough; critical row counts, totals, recent records, constraints and permissions must also be proven.",
      explanationUk: "Запустіть однакові control queries проти authoritative database та replica/restored database. Green infrastructure status недостатній: потрібно також підтвердити critical row counts, totals, recent records, constraints і permissions.",
      expectedResult: "Control totals match within the explicitly allowed replication/recovery window.",
      expectedResultUk: "Control totals збігаються в межах явно дозволеного replication/recovery window."
    }]
  },
  {
    id: "sql-injection-parameterized-queries",
    codeExamples: [{
      title: "Keep user data outside SQL structure",
      titleUk: "Тримати user data поза SQL structure",
      language: "sql",
      code: `-- SQL text sent to the database\nSELECT id, email, role\nFROM users\nWHERE email = $1;\n\n-- The driver binds $1 separately, for example:\n-- value: attacker@example.com' OR '1'='1`,
      explanation: "The placeholder is part of the fixed SQL structure while the supplied text is bound as a value, so quote characters inside the input do not become executable SQL. Dynamic identifiers and ORDER BY fragments still require allowlists rather than value binding.",
      explanationUk: "Placeholder є частиною фіксованої SQL structure, а введений text передається окремо як value, тому quotes усередині input не стають executable SQL. Dynamic identifiers та ORDER BY fragments все одно потребують allowlist, а не value binding.",
      expectedResult: "Only a row whose email literally equals the supplied value can match.",
      expectedResultUk: "Збіг можливий лише для row, email якого буквально дорівнює переданому value."
    }]
  },
  {
    id: "database-views-procedures-triggers",
    codeExamples: [{
      title: "Test a view at its public result boundary",
      titleUk: "Перевірити view на його public result boundary",
      language: "sql",
      code: `CREATE VIEW paid_order_totals AS\nSELECT customer_id, SUM(amount) AS total\nFROM orders\nWHERE status = 'paid'\nGROUP BY customer_id;\n\nSELECT *\nFROM paid_order_totals\nWHERE customer_id = 42;`,
      explanation: "A view should be tested for result shape, filtering, permissions, freshness and performance just like another public query contract. Procedures and triggers add inputs, transaction boundaries and hidden side effects that require additional direct and application-mediated tests.",
      explanationUk: "View потрібно тестувати на result shape, filtering, permissions, freshness і performance як інший public query contract. Procedures і triggers додають inputs, transaction boundaries та hidden side effects, тому потребують додаткових direct і application-mediated tests.",
      expectedResult: "The view exposes the same paid-order total that an independently calculated source query produces.",
      expectedResultUk: "View повертає той самий paid-order total, що й незалежно обчислений source query."
    }]
  }
];

export default sqlCodeExamples;
