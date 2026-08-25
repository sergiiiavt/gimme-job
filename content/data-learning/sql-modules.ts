const SQL = "```sql";
const END = "```";

export const sqlModules = [
  {
    id: "sql-foundations",
    label: "SQL & relational foundations",
    navLabel: "Foundations",
    level: "Beginner",
    count: 5,
    description: "Understand relational data, tables, rows, keys, SQL dialects, and the read-first workflow used throughout this path.",
    sourceIds: ["postgresql-18-tutorial", "w3schools-sql-syllabus", "sqlbolt"],
    markdown: String.raw`# SQL & relational foundations

SQL is a declarative language: you describe the result you want, while the database engine decides how to produce it. That difference matters. Good SQL is less about memorizing commands and more about expressing sets, relationships, filters, and transformations precisely.

## Relational databases in one model

A relational database stores data in **tables**. A table has named columns and rows. Each column represents an attribute with a data type; each row represents one occurrence of the thing being modeled. Tables become useful when relationships are explicit: an order refers to a customer, an order item refers to an order and a product, and so on.

The sample database used by this site contains realistic tables such as users, customers, orders, order_items, employees, departments, events, payments, and test_results. Most examples in this learning path use that same dataset so you can run them rather than only read them.

## Keys and relationships

A **primary key** identifies one row inside a table. A **foreign key** stores the key of a related row in another table. The database can enforce that relationship with a foreign-key constraint, but SQL queries can also inspect data where those guarantees are absent or temporarily violated.

For example, orders.customer_id is conceptually related to customers.id. A join expresses that relationship when retrieving data.

${SQL}
SELECT o.id AS order_id,
       c.name AS customer,
       o.status,
       o.total
FROM orders AS o
JOIN customers AS c ON c.id = o.customer_id
ORDER BY o.id;
${END}

## SQL is standardized, engines are not identical

Core SQL concepts transfer across PostgreSQL, MySQL, SQL Server, Oracle, SQLite, and other relational systems, but syntax and behavior differ around data types, date functions, auto-generated keys, pagination, JSON, stored procedures, locking, and many advanced features. This path teaches portable concepts first and calls out dialect-specific behavior when it matters.

The browser runner on this site uses **SQLite in memory**. PostgreSQL documentation is used as the deeper semantic reference because it explains standard relational concepts clearly and documents advanced SQL rigorously. W3Schools is used as a beginner-oriented breadth checklist, not as the sole authority for engine behavior.

## Read queries versus write queries

SQL work usually falls into several groups:

- **DQL / querying**: SELECT and related clauses retrieve data.
- **DML**: INSERT, UPDATE, and DELETE change rows.
- **DDL**: CREATE, ALTER, and DROP change schema objects.
- **Transaction control**: BEGIN, COMMIT, ROLLBACK, and SAVEPOINT control atomic units of work.
- **Security / permissions**: GRANT and REVOKE are available in server databases such as PostgreSQL, but not in the same form in SQLite.

Start with reads. A SELECT is safer to explore, easier to reason about, and forms the basis for most debugging and QA data checks.

## First query and mental checklist

Read a query in this order: what rows exist in FROM, which rows survive WHERE, how rows are grouped, which groups survive HAVING, what expressions are selected, then how the result is sorted and limited.

${SQL}
SELECT id, email, status
FROM users
WHERE status = 'active'
ORDER BY id;
${END}

**Practice:** run the query, then change the selected columns and filter. Predict the result before pressing Run. That predict-then-run habit is more valuable than copying syntax.`
  },
  {
    id: "select-project-sort",
    label: "SELECT, projection, DISTINCT & sorting",
    navLabel: "SELECT & sorting",
    level: "Beginner",
    count: 5,
    description: "Retrieve exactly the columns and rows you need, remove duplicates deliberately, name expressions, and make result order deterministic.",
    sourceIds: ["w3schools-sql-tutorial", "postgresql-18-queries", "sqlite-select", "sqlbolt"],
    markdown: String.raw`# SELECT, projection, DISTINCT & sorting

A SELECT query produces a result table. The result does not have to mirror the source table: you can choose columns, calculate expressions, rename output fields, remove duplicate result rows, and control ordering.

## Selecting columns instead of SELECT star

SELECT * is useful while exploring an unfamiliar table, but explicit columns are better in production queries because they document intent and avoid silently changing the result shape when the schema changes.

${SQL}
SELECT id, first_name, last_name, role
FROM users;
${END}

Prefer explicit columns in API queries, reports, migrations, and assertions. Use SELECT * mainly for temporary inspection.

## Column aliases and expressions

Aliases make calculated fields readable and are essential when two joined tables contain columns with the same name.

${SQL}
SELECT id,
       first_name || ' ' || last_name AS full_name,
       role AS job_role
FROM users
ORDER BY id;
${END}

The concatenation operator shown above works in SQLite and PostgreSQL. Other engines may use different functions or operators, which is a common dialect difference.

## DISTINCT removes duplicate result rows

DISTINCT applies to the complete selected row, not independently to each column.

${SQL}
SELECT DISTINCT role, status
FROM users
ORDER BY role, status;
${END}

If you need one row per entity according to a business rule such as “latest event per user,” DISTINCT is usually not enough. That problem is handled later with grouping or window functions.

## ORDER BY and deterministic output

Without ORDER BY, SQL does **not** promise a stable row order. Even if a query appears to return rows in primary-key order today, a different execution plan, index, engine version, or data distribution can change it.

${SQL}
SELECT id, name, salary
FROM employees
ORDER BY salary DESC, id ASC;
${END}

When values can tie, add a stable tie-breaker such as the primary key. This is especially important in automated tests and pagination.

## LIMIT and pagination basics

SQLite and PostgreSQL support LIMIT and OFFSET. SQL Server commonly uses TOP or OFFSET/FETCH. Large OFFSET values become inefficient and can produce unstable pages while rows are changing; keyset pagination is introduced later.

${SQL}
SELECT id, email, created_at
FROM users
ORDER BY created_at DESC, id DESC
LIMIT 3;
${END}

**Practice:** return the three highest-paid employees, resolving salary ties by ascending employee id.`
  },
  {
    id: "filtering-null-patterns",
    label: "Filtering, boolean logic, NULL & patterns",
    navLabel: "Filtering & NULL",
    level: "Beginner",
    count: 6,
    description: "Build correct WHERE predicates with comparisons, AND/OR/NOT, IN, BETWEEN, LIKE, and SQL's three-valued NULL logic.",
    sourceIds: ["w3schools-sql-tutorial", "postgresql-18-queries", "sqlite-select", "sqlbolt"],
    markdown: String.raw`# Filtering, boolean logic, NULL & patterns

WHERE decides which input rows continue through the query. Most SQL bugs in everyday work are not syntax errors; they are predicate errors that include or exclude the wrong rows.

## Comparison predicates

Common comparisons are =, <>, <, <=, >, and >=. Strings use quotes; numbers do not.

${SQL}
SELECT id, status, total
FROM orders
WHERE total >= 100
ORDER BY total DESC;
${END}

## AND, OR, NOT and parentheses

AND binds more tightly than OR in SQL, so mixed boolean expressions should usually be parenthesized to make intent unambiguous.

${SQL}
SELECT id, email, role, status
FROM users
WHERE status = 'active'
  AND (role = 'qa' OR role = 'analyst')
ORDER BY id;
${END}

A common defect is writing A OR B AND C when the intended rule is (A OR B) AND C.

## IN and BETWEEN

IN is clearer than a long chain of equality OR conditions. BETWEEN is inclusive at both ends.

${SQL}
SELECT id, name, salary
FROM employees
WHERE salary BETWEEN 4000 AND 5000
  AND department_id IN (1, 2)
ORDER BY salary DESC, id;
${END}

For timestamps, inclusive BETWEEN can be dangerous at day boundaries. A half-open interval such as created_at >= start AND created_at < next_day is usually easier to reason about.

## NULL is unknown, not an ordinary value

NULL represents absence or unknown information. Comparisons such as email = NULL and email <> NULL do not evaluate to true. Use IS NULL and IS NOT NULL.

${SQL}
SELECT id, first_name, email, phone
FROM users
WHERE email IS NULL OR phone IS NULL
ORDER BY id;
${END}

SQL uses three-valued logic: TRUE, FALSE, and UNKNOWN. This explains many surprises with NOT IN, nullable columns, and outer joins.

## LIKE and wildcard matching

LIKE uses % for any sequence of characters and _ for exactly one character. Case sensitivity varies by engine and collation.

${SQL}
SELECT id, email
FROM users
WHERE email LIKE '%@example.com'
ORDER BY id;
${END}

Do not confuse wildcard matching with regular expressions. Regex support is vendor-specific.

## NOT IN and NULL trap

If the subquery/list used by NOT IN can contain NULL, the predicate can become UNKNOWN for every candidate row. NOT EXISTS is often safer for anti-joins because it expresses the intent directly.

**Practice:** find active users whose phone is missing and whose role is QA. Then rewrite the same logic with the conditions in a different order and confirm the result is unchanged.`
  },
  {
    id: "expressions-functions-case",
    label: "Expressions, CASE, functions & data types",
    navLabel: "Expressions & CASE",
    level: "Beginner",
    count: 6,
    description: "Calculate values, handle NULL explicitly, classify rows with CASE, and understand where scalar functions and data types become dialect-specific.",
    sourceIds: ["w3schools-sql-tutorial", "postgresql-18-queries", "sqlite-select"],
    markdown: String.raw`# Expressions, CASE, functions & data types

A SELECT list can contain far more than stored columns. Arithmetic, string operations, CASE expressions, casts, and scalar functions let SQL transform data before it leaves the database.

## Arithmetic and calculated columns

${SQL}
SELECT id,
       quantity,
       unit_price,
       quantity * unit_price AS line_total
FROM order_items
ORDER BY id;
${END}

Be explicit about units and currencies. Adding two monetary values that represent different currencies is syntactically valid SQL but semantically wrong.

## CASE for conditional logic

CASE is SQL's general conditional expression. It is useful for labels, bucketing, conditional aggregates, and safe transformations.

${SQL}
SELECT id,
       total,
       CASE
         WHEN total >= 200 THEN 'large'
         WHEN total >= 100 THEN 'medium'
         ELSE 'small'
       END AS order_size
FROM orders
ORDER BY id;
${END}

Order WHEN clauses from the most specific/highest-priority rule to the fallback rule.

## COALESCE and NULL handling

COALESCE returns the first non-NULL argument and is broadly portable.

${SQL}
SELECT id,
       COALESCE(email, '[missing email]') AS email,
       COALESCE(phone, '[missing phone]') AS phone
FROM users
ORDER BY id;
${END}

Do not replace NULL with a sentinel merely to make a query look cleaner unless that replacement is meaningful to the consumer.

## String and numeric functions

Function names differ more than basic SELECT syntax. SQLite provides functions such as length, lower, upper, round, substr, and printf; PostgreSQL has a much larger function catalog.

${SQL}
SELECT id,
       upper(first_name) AS first_name_upper,
       length(COALESCE(email, '')) AS email_length
FROM users
ORDER BY id;
${END}

## Dates and timestamps are dialect-sensitive

The sample runner stores ISO-formatted dates/timestamps as text, which sort correctly when formats are consistent. Real databases usually use DATE, TIMESTAMP, TIMESTAMP WITH TIME ZONE, or vendor equivalents. Date arithmetic and truncation syntax vary significantly between engines.

A robust learning rule is: understand the **concept** (comparison, extraction, interval, timezone) and then consult the documentation for your target engine's exact function.

## CAST and type conversion

Explicit casts document assumptions and prevent accidental string/numeric comparisons. PostgreSQL supports CAST(value AS type) and a :: shorthand; the former is more portable.

**Practice:** classify employees as high score (>= 90) or standard, and return the label alongside name and score.`
  },
  {
    id: "joins-relationships",
    label: "JOINs & multi-table relationships",
    navLabel: "JOINs",
    level: "Intermediate",
    count: 7,
    description: "Combine related tables correctly with INNER, LEFT and self joins; avoid accidental Cartesian products, duplicate amplification, and misplaced filters.",
    sourceIds: ["postgresql-18-tutorial", "postgresql-18-queries", "w3schools-sql-tutorial", "sqlbolt"],
    markdown: String.raw`# JOINs & multi-table relationships

JOIN is where relational modeling becomes useful. A join combines rows according to a relationship condition. The critical skill is not memorizing join diagrams; it is reasoning about **which rows should survive** when a match exists or does not exist.

## INNER JOIN

INNER JOIN keeps only matching pairs.

${SQL}
SELECT o.id AS order_id,
       c.name AS customer,
       o.total
FROM orders AS o
JOIN customers AS c ON c.id = o.customer_id
ORDER BY o.id;
${END}

Notice that the sample order whose customer_id is 999 disappears because no matching customer exists.

## LEFT JOIN

LEFT JOIN keeps every row from the left side and fills right-side columns with NULL when there is no match.

${SQL}
SELECT c.id,
       c.name,
       o.id AS order_id,
       o.status
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
ORDER BY c.id, o.id;
${END}

This reveals No Orders Ltd even though it has no order.

## Finding missing relationships with an anti-join

${SQL}
SELECT c.id, c.name
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.id;
${END}

NOT EXISTS is another robust expression of the same intent and often scales well.

## Filter placement changes outer-join meaning

With a LEFT JOIN, putting a condition on the right table in WHERE can remove the NULL-extended rows and effectively turn the query into an inner join. If the condition defines which right-side rows may match while unmatched left rows must remain, put it in ON.

${SQL}
SELECT c.id, c.name, o.id AS paid_order
FROM customers AS c
LEFT JOIN orders AS o
  ON o.customer_id = c.id
 AND o.status = 'paid'
ORDER BY c.id, o.id;
${END}

## Many-to-many joins and duplicate amplification

Orders and products are connected through order_items. One order can have many products; one product can appear in many orders. Joining across that bridge creates one result row per matching relationship, which is correct but can surprise you if you expected one row per order.

${SQL}
SELECT o.id AS order_id,
       p.name AS product,
       oi.quantity,
       oi.unit_price
FROM orders AS o
JOIN order_items AS oi ON oi.order_id = o.id
JOIN products AS p ON p.id = oi.product_id
ORDER BY o.id, p.id;
${END}

## Self joins

A self join treats one table as two logical roles. Typical use cases are organizational hierarchies, predecessor/successor relationships, and comparing rows inside the same entity set. Always use clear aliases.

## RIGHT and FULL joins

PostgreSQL supports RIGHT JOIN and FULL OUTER JOIN. SQLite's support depends on version and the site's learning runner intentionally focuses on the common INNER/LEFT patterns. FULL joins are useful for reconciliation, but set operations can sometimes express QA comparisons more clearly.

**Practice:** find orders with no matching customer, then find customers with no orders. These are different questions and should produce different SQL.`
  },
  {
    id: "aggregates-grouping",
    label: "Aggregates, GROUP BY & HAVING",
    navLabel: "Aggregation",
    level: "Intermediate",
    count: 6,
    description: "Summarize sets of rows with COUNT, SUM, AVG, MIN, MAX, conditional aggregation, GROUP BY, and HAVING without losing track of result grain.",
    sourceIds: ["postgresql-18-tutorial", "postgresql-18-queries", "w3schools-sql-tutorial", "sqlbolt"],
    markdown: String.raw`# Aggregates, GROUP BY & HAVING

Aggregation changes the **grain** of a result. Instead of one row per source record, you can produce one row for the whole input or one row per group.

## Core aggregate functions

COUNT counts rows or non-NULL expressions; SUM and AVG combine numeric values; MIN and MAX return extrema.

${SQL}
SELECT COUNT(*) AS order_count,
       SUM(total) AS total_value,
       AVG(total) AS average_value,
       MIN(total) AS smallest_order,
       MAX(total) AS largest_order
FROM orders;
${END}

COUNT(*) includes every row. COUNT(column) ignores rows where that column is NULL.

## GROUP BY defines output grain

${SQL}
SELECT status,
       COUNT(*) AS orders,
       SUM(total) AS total_value
FROM orders
GROUP BY status
ORDER BY status;
${END}

Every selected non-aggregate expression should be functionally compatible with the grouping. Some engines are stricter than others; write SQL that makes the grouping intention explicit.

## WHERE versus HAVING

WHERE filters individual rows **before** aggregation. HAVING filters groups **after** aggregation.

${SQL}
SELECT customer_id,
       COUNT(*) AS order_count,
       SUM(total) AS customer_total
FROM orders
WHERE status <> 'cancelled'
GROUP BY customer_id
HAVING COUNT(*) >= 2
ORDER BY customer_total DESC;
${END}

Use WHERE whenever the rule applies to source rows; use HAVING when the rule depends on an aggregate result.

## Conditional aggregation

CASE inside an aggregate can produce multiple metrics in one pass.

${SQL}
SELECT customer_id,
       COUNT(*) AS all_orders,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
       SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) AS paid_total
FROM orders
GROUP BY customer_id
ORDER BY customer_id;
${END}

## Grouping across joins

When joining one-to-many tables before aggregating, be aware that the join changes row count. A customer joined to three orders appears three times before grouping. This is expected, but joining multiple one-to-many relationships at once can multiply rows and inflate sums.

## Result-grain checklist

Before writing an aggregate query, state the desired grain in one sentence: “one row per customer,” “one row per build,” or “one row per day and status.” Then make GROUP BY match that sentence.

**Practice:** produce one row per test_results.build_id with total tests, passed tests, failed tests, and errors.`
  },
  {
    id: "subqueries-exists-sets",
    label: "Subqueries, EXISTS & set operations",
    navLabel: "Subqueries & sets",
    level: "Intermediate",
    count: 7,
    description: "Use scalar and table subqueries, correlated EXISTS/NOT EXISTS, UNION/UNION ALL, INTERSECT, and EXCEPT to express nested and reconciliation logic.",
    sourceIds: ["postgresql-18-queries", "sqlbolt", "w3schools-sql-tutorial", "sqlite-select"],
    markdown: String.raw`# Subqueries, EXISTS & set operations

A subquery is a query embedded inside another SQL statement. Set operations combine complete query results. These tools are especially useful when the business rule is naturally phrased as “rows where another set contains/does not contain something.”

## Scalar subqueries

A scalar subquery must return one value. It can be compared with each outer row.

${SQL}
SELECT id, name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC;
${END}

If the subquery unexpectedly returns multiple rows, engines normally raise an error rather than guessing.

## IN with a subquery

${SQL}
SELECT id, name
FROM customers
WHERE id IN (
  SELECT customer_id
  FROM orders
  WHERE status = 'paid'
)
ORDER BY id;
${END}

IN is readable when NULL behavior is understood and the intent is membership in a set.

## EXISTS and correlated subqueries

EXISTS asks whether at least one row satisfies a condition. The subquery can refer to the current outer row.

${SQL}
SELECT c.id, c.name
FROM customers AS c
WHERE EXISTS (
  SELECT 1
  FROM orders AS o
  WHERE o.customer_id = c.id
    AND o.status = 'paid'
)
ORDER BY c.id;
${END}

SELECT 1 is conventional because EXISTS cares about row existence, not selected values.

## NOT EXISTS for missing relationships

${SQL}
SELECT c.id, c.name
FROM customers AS c
WHERE NOT EXISTS (
  SELECT 1
  FROM orders AS o
  WHERE o.customer_id = c.id
)
ORDER BY c.id;
${END}

This avoids the NULL trap associated with NOT IN.

## UNION versus UNION ALL

UNION combines result sets and removes duplicates. UNION ALL preserves every row and is normally faster because it does not need duplicate elimination.

${SQL}
SELECT email FROM active_customers
UNION ALL
SELECT email FROM archived_customers
ORDER BY email;
${END}

Choose UNION only when deduplication is actually part of the requirement.

## INTERSECT and EXCEPT

INTERSECT returns rows present in both result sets. EXCEPT returns rows from the first set that are absent from the second. They are excellent for expected-versus-actual comparisons when both sides have compatible columns.

${SQL}
SELECT id, status, amount FROM expected
EXCEPT
SELECT id, status, amount FROM actual;
${END}

Reverse the two sides to find unexpected actual rows.

## When to prefer joins, EXISTS, or sets

Use a join when you need columns from both relations. Use EXISTS when you only need to test presence. Use a set operation when you are comparing entire compatible row sets. These choices often express intent better than forcing every problem into a join.

**Practice:** return customers that have a paid order but no pending order.`
  },
  {
    id: "ctes-query-structure",
    label: "CTEs & query decomposition",
    navLabel: "CTEs",
    level: "Intermediate",
    count: 5,
    description: "Use WITH clauses to name intermediate result sets, improve readability, reuse calculations, and understand when recursive CTEs are appropriate.",
    sourceIds: ["postgresql-18-queries", "sqlite-select"],
    markdown: String.raw`# CTEs & query decomposition

A Common Table Expression (CTE) gives a name to an intermediate query result for the duration of one statement. CTEs are not automatically “faster”; their primary benefit is clearer structure, and optimizer behavior differs by engine/version.

## Basic WITH query

${SQL}
WITH paid_orders AS (
  SELECT id, customer_id, total
  FROM orders
  WHERE status = 'paid'
)
SELECT customer_id,
       COUNT(*) AS paid_orders,
       SUM(total) AS paid_total
FROM paid_orders
GROUP BY customer_id
ORDER BY paid_total DESC;
${END}

## Multiple CTEs as a pipeline

${SQL}
WITH customer_totals AS (
  SELECT customer_id, SUM(total) AS paid_total
  FROM orders
  WHERE status = 'paid'
  GROUP BY customer_id
),
ranked AS (
  SELECT customer_id,
         paid_total,
         ROW_NUMBER() OVER (ORDER BY paid_total DESC, customer_id) AS position
  FROM customer_totals
)
SELECT customer_id, paid_total, position
FROM ranked
ORDER BY position;
${END}

Each step should have a meaningful name and a clear grain.

## CTE versus subquery

A CTE and an inline subquery can express the same relational logic. Prefer the form that makes the query easier to verify. For a multi-stage QA reconciliation, named stages such as normalized_expected, normalized_actual, and differences can dramatically improve reviewability.

## Recursive CTE concept

Recursive CTEs repeatedly apply a query until no new rows are produced. They are used for trees, graphs, hierarchical paths, sequence generation, and dependency traversal. They need an anchor term, a recursive term, and a termination condition.

A recursive query is powerful enough to create runaway work if the termination rule is wrong, so test it on bounded data first.

## CTE performance caution

Do not assume that extracting logic into a CTE improves execution speed. PostgreSQL can inline or materialize CTEs depending on the query and version; other engines have different rules. Read the execution plan when performance matters.

**Practice:** build a CTE containing only QA employees, then query it for the highest score and average salary.`
  },
  {
    id: "window-functions",
    label: "Window functions",
    navLabel: "Window functions",
    level: "Advanced",
    count: 7,
    description: "Calculate rankings, running totals, previous/next values, and per-group analytics while retaining individual rows.",
    sourceIds: ["postgresql-18-window", "postgresql-18-queries", "sqlite-select"],
    markdown: String.raw`# Window functions

Window functions calculate across related rows **without collapsing them into one row per group**. That makes them ideal for ranking, latest-row selection, running balances, comparisons with previous events, and analytics.

## OVER and PARTITION BY

${SQL}
SELECT id,
       name,
       department_id,
       salary,
       AVG(salary) OVER (PARTITION BY department_id) AS department_avg
FROM employees
ORDER BY department_id, id;
${END}

Every employee remains visible while the department average is repeated for the relevant partition.

## ROW_NUMBER, RANK, and DENSE_RANK

ROW_NUMBER gives a unique sequence. RANK leaves gaps after ties. DENSE_RANK does not leave gaps.

${SQL}
SELECT id,
       name,
       salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC, id) AS row_number,
       RANK() OVER (ORDER BY salary DESC) AS salary_rank,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_salary_rank
FROM employees
ORDER BY salary DESC, id;
${END}

Choose based on the business meaning of ties.

## Top N per group

A classic SQL task is “top two employees in each department.” Calculate a row number inside each department, then filter in an outer query.

${SQL}
WITH ranked AS (
  SELECT id,
         name,
         department_id,
         salary,
         ROW_NUMBER() OVER (
           PARTITION BY department_id
           ORDER BY salary DESC, id
         ) AS rn
  FROM employees
)
SELECT id, name, department_id, salary
FROM ranked
WHERE rn <= 2
ORDER BY department_id, rn;
${END}

## LAG and LEAD

LAG accesses a previous row in window order; LEAD accesses a following row. This is useful for event transitions and detecting gaps.

${SQL}
SELECT entity_id,
       sequence_no,
       status,
       LAG(sequence_no) OVER (
         PARTITION BY entity_id
         ORDER BY sequence_no
       ) AS previous_sequence
FROM events
ORDER BY entity_id, sequence_no;
${END}

## Running totals

${SQL}
SELECT account_id,
       occurred_at,
       amount,
       SUM(amount) OVER (
         PARTITION BY account_id
         ORDER BY occurred_at, id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_balance
FROM ledger
ORDER BY account_id, occurred_at, id;
${END}

Specify the frame explicitly when cumulative semantics matter; default frames can surprise you when ordering values tie.

## Latest row per entity

Window functions are one of the cleanest solutions to “latest event per entity.” Rank each entity's rows by timestamp descending and keep rn = 1.

## Execution-order implication

Window functions are evaluated after WHERE/GROUP BY/HAVING. You normally cannot filter directly on a window alias in WHERE; use a subquery or CTE, as shown in the top-N example.

**Practice:** return the latest status for each entity from events, resolving equal timestamps by the highest id.`
  },
  {
    id: "dml-transactions",
    label: "INSERT, UPDATE, DELETE & transactions",
    navLabel: "DML & transactions",
    level: "Intermediate",
    count: 7,
    description: "Modify data safely, verify affected rows, use transactions and savepoints, and avoid destructive statements without bounded predicates.",
    sourceIds: ["postgresql-18-tutorial", "postgresql-18-transactions", "sqlite-transaction", "w3schools-sql-tutorial"],
    markdown: String.raw`# INSERT, UPDATE, DELETE & transactions

Write statements change state. In a real environment, the safe workflow is: understand the target set with SELECT, perform the change inside a transaction where possible, verify the result, then commit deliberately.

The site's SQL runner is isolated in memory. Changes persist only within that runner session and Reset restores the sample database.

## INSERT

Always list target columns unless there is a very specific reason not to. This makes the statement resilient to schema changes and self-documenting.

${SQL}
INSERT INTO users (id, email, first_name, last_name, status, role, created_at, updated_at)
VALUES (100, 'new@example.com', 'New', 'User', 'pending', 'qa', '2026-08-25T10:00:00', '2026-08-25T10:00:00');

SELECT id, email, status, role
FROM users
WHERE id = 100;
${END}

## UPDATE with a bounded predicate

Before UPDATE, run the same WHERE clause as a SELECT and inspect every row it would touch.

${SQL}
UPDATE users
SET status = 'inactive',
    updated_at = '2026-08-25T12:00:00'
WHERE id = 2;

SELECT id, email, status, updated_at
FROM users
WHERE id = 2;
${END}

An UPDATE without WHERE can modify every row.

## DELETE with a bounded predicate

DELETE removes rows; DROP removes schema objects. For production work, verify the target set first and consider whether soft deletion/audit requirements apply.

${SQL}
DELETE FROM users
WHERE id = 3;

SELECT id, email
FROM users
ORDER BY id;
${END}

## Transactions and atomicity

A transaction groups changes into one logical unit: either all intended changes commit or they can be rolled back. PostgreSQL's tutorial emphasizes this all-or-nothing property.

${SQL}
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 5;
UPDATE payments SET status = 'captured' WHERE order_id = 5;
COMMIT;
${END}

The exact locking and isolation behavior depends on the database engine.

## ROLLBACK and SAVEPOINT

ROLLBACK abandons uncommitted work. SAVEPOINT establishes a point within a transaction that can be rolled back without discarding earlier transaction work. Savepoints are useful in complex migrations and controlled batch operations.

## Read-modify-write race conditions

A transaction does not automatically make every application pattern safe. If two transactions read the same current value and then both write based on it, isolation level and locking determine what can happen. Prefer atomic SQL updates or database constraints when possible.

## Safe write checklist

1. Identify rows with SELECT.
2. Confirm expected row count and business scope.
3. Use explicit transaction control where appropriate.
4. Execute the mutation.
5. Re-query invariants and affected rows.
6. Commit only after verification; otherwise roll back.

**Practice:** in the runner, update one pending order to paid, inspect it, then press Reset and confirm the original state returns.`
  },
  {
    id: "ddl-constraints-design",
    label: "Tables, keys, constraints & schema design",
    navLabel: "Schema & constraints",
    level: "Intermediate",
    count: 8,
    description: "Design tables with suitable types, primary/foreign keys, uniqueness, NOT NULL, CHECK, defaults, and normalization principles.",
    sourceIds: ["postgresql-18-ddl", "postgresql-18-tutorial", "w3schools-sql-tutorial"],
    markdown: String.raw`# Tables, keys, constraints & schema design

Schema design decides what invalid states the database can represent. Strong constraints move critical correctness rules closer to the data and protect every application that writes to the database.

## CREATE TABLE and data types

DDL examples in this chapter are intentionally shown as static SQL rather than runnable learning blocks because the site's general learning runner protects schema-changing statements.

${SQL}
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
${END}

Choose types that represent the domain accurately. Engine-specific type systems differ, especially around booleans, timestamps, JSON, arrays, UUIDs, identity columns, and numeric precision.

## Primary keys

A primary key must uniquely identify a row and should be stable. Natural keys can work when the business identifier is truly immutable; surrogate numeric/UUID keys are often simpler for internal relationships.

## Foreign keys and referential integrity

${SQL}
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
${END}

Foreign keys prevent orphan references when enforcement is enabled and configured correctly. ON DELETE/ON UPDATE actions such as RESTRICT, CASCADE, SET NULL, and SET DEFAULT should match the domain, not convenience.

## NOT NULL, UNIQUE, CHECK, DEFAULT

Constraints are executable business rules.

${SQL}
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'blocked', 'closed'))
);
${END}

A UNIQUE constraint involving nullable columns can behave differently across engines, so verify target-database semantics.

## Composite keys and uniqueness

Some relationships are naturally unique only across multiple columns, such as (order_id, product_id) or (tenant_id, external_id). Composite UNIQUE constraints express that invariant directly.

## Normalization

Normalization reduces duplicated facts and update anomalies. Practical OLTP design commonly aims for well-structured entities where each fact has one authoritative place. Denormalization can be justified for performance/read models, but it should be deliberate and accompanied by a synchronization strategy.

## ALTER and migration safety

Schema changes happen over time. Safe migrations consider existing rows, lock duration, backfills, application compatibility, rollback strategy, and deployment order. “ALTER TABLE succeeded in development” is not enough evidence for a large production table.

## Schema-design review questions

- What uniquely identifies a row?
- Which values are mandatory?
- Which values must be unique?
- Which relationships must always point to an existing row?
- Which state combinations are invalid?
- What happens when a referenced row is deleted?
- Which columns are searched/sorted often enough to consider indexing?

**Practice:** design a test_run table with a primary key, unique external run id, required status, start/end timestamps, and a CHECK restricting status values.`
  },
  {
    id: "indexes-query-plans",
    label: "Indexes, EXPLAIN & query performance",
    navLabel: "Indexes & performance",
    level: "Advanced",
    count: 7,
    description: "Understand what indexes accelerate, why they cost writes/storage, how composite indexes work, and how to read execution plans instead of guessing.",
    sourceIds: ["sqlite-query-planner", "postgresql-18-queries", "postgresql-18-ddl"],
    markdown: String.raw`# Indexes, EXPLAIN & query performance

An index is an additional data structure that helps the engine locate rows without scanning every row. Indexes can transform query performance, but every index consumes storage and adds work to INSERT/UPDATE/DELETE operations.

## What an index helps

Indexes are often useful for selective WHERE predicates, join keys, and ORDER BY patterns. A primary key normally creates or uses an index automatically, depending on the engine.

A query such as WHERE customer_id = ? over millions of orders is a typical candidate for an index on orders(customer_id).

## Single-column indexes

${SQL}
CREATE INDEX idx_orders_customer_id
ON orders(customer_id);
${END}

This is static because schema modification is not enabled in learning blocks. In a real database, benchmark the actual workload instead of adding indexes mechanically.

## Composite indexes and column order

${SQL}
CREATE INDEX idx_orders_customer_status_date
ON orders(customer_id, status, order_date);
${END}

Column order matters. An index beginning with customer_id can efficiently support many searches constrained by customer_id, but it is not equivalent to a separate index beginning with status.

## Covering indexes

If an index contains all columns required by a query, some engines can answer it without reading the base table for each match. This can be fast, but wider indexes consume more space and maintenance work.

## Selectivity and low-cardinality columns

An index on a boolean-like or low-cardinality status column may be unhelpful when a large fraction of the table matches. Data distribution matters as much as syntax.

## EXPLAIN instead of intuition

PostgreSQL and SQLite provide EXPLAIN facilities that show the chosen plan. PostgreSQL also supports EXPLAIN ANALYZE, which actually executes the query and reports observed timing/row information. Use production-like data and caution with write queries.

Learn to inspect:

- scan type (sequential/table scan versus index access),
- estimated versus actual rows,
- join strategy and join order,
- sort/aggregate steps,
- repeated loops,
- large intermediate result sets.

## Performance anti-patterns

Common issues include selecting unnecessary columns, missing join predicates, functions/casts that prevent useful index access, deep OFFSET pagination, N+1 application queries, leading-wildcard searches, and aggregating far more rows than needed.

**Practice:** explain which index you would consider for “all paid orders for one customer ordered by order_date descending,” and why column order matters.`
  },
  {
    id: "views-security-parameters",
    label: "Views, parameters & SQL security",
    navLabel: "Views & security",
    level: "Advanced",
    count: 6,
    description: "Encapsulate stable query interfaces with views, separate data access from presentation, and prevent SQL injection with parameterized queries.",
    sourceIds: ["postgresql-18-ddl", "w3schools-sql-tutorial", "owasp-sql-injection"],
    markdown: String.raw`# Views, parameters & SQL security

SQL correctness includes security. A perfectly written SELECT can still be dangerous if an application builds it by concatenating untrusted strings.

## Views as stored query interfaces

A view presents the result of a query as a named relation. It can hide joins, centralize stable derivations, and expose a narrower interface to consumers.

${SQL}
CREATE VIEW paid_order_summary AS
SELECT customer_id,
       COUNT(*) AS order_count,
       SUM(total) AS total_value
FROM orders
WHERE status = 'paid'
GROUP BY customer_id;
${END}

Views do not automatically mean materialized data. Ordinary views normally execute their underlying query when referenced; materialized views are a separate feature in databases such as PostgreSQL.

## SQL injection: the unsafe pattern

Do not construct SQL like this in application code:

${SQL}
SELECT id, email
FROM users
WHERE email = '" + userInput + "';
${END}

If userInput contains SQL syntax, string concatenation can change the query structure. Escaping alone is fragile and database-specific.

## Parameterized queries / prepared statements

OWASP's primary recommendation is to use prepared statements with parameter binding so SQL structure and data remain separate.

Conceptually:

${SQL}
SELECT id, email, status
FROM users
WHERE email = :email;
${END}

The site's runner provides safe sample values for a small set of named parameters, so the query above can be executed without concatenating input.

## Dynamic identifiers are different

Parameters represent data values, not table names, column names, or sort directions in most database APIs. If an application truly needs dynamic identifiers, map user choices to a fixed allow-list of known identifiers rather than injecting raw input into SQL.

## Least privilege

Application database accounts should have only the permissions they need. Read-only reporting code should not be able to drop tables; a service that only touches one schema should not be a database superuser. PostgreSQL exposes GRANT/REVOKE and role management; exact mechanisms differ by engine.

## Security testing ideas

Test quotation characters, comment markers, boolean expressions, encoded payloads, unexpected types, very long values, and alternate input paths—but verify that the application still uses parameter binding rather than judging safety from a small payload list.

**Practice:** identify which parts of a “sort by user-selected column” feature can be parameters and which require allow-listing.`
  },
  {
    id: "advanced-query-patterns",
    label: "Advanced query patterns",
    navLabel: "Advanced patterns",
    level: "Advanced",
    count: 7,
    description: "Apply relational techniques to latest-row selection, de-duplication, gaps, running state, keyset pagination, and expected-versus-actual reconciliation.",
    sourceIds: ["postgresql-18-queries", "postgresql-18-window", "sqlite-select"],
    markdown: String.raw`# Advanced query patterns

Advanced SQL is usually a combination of fundamentals rather than a new language. The key is to define the desired grain and tie-breaking rules explicitly.

## Latest row per entity

${SQL}
WITH ranked AS (
  SELECT e.*,
         ROW_NUMBER() OVER (
           PARTITION BY entity_id
           ORDER BY occurred_at DESC, id DESC
         ) AS rn
  FROM events AS e
)
SELECT entity_id, status, occurred_at
FROM ranked
WHERE rn = 1
ORDER BY entity_id;
${END}

Always define a deterministic tie-breaker.

## Detecting duplicates

${SQL}
SELECT email,
       COUNT(*) AS occurrences
FROM users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY occurrences DESC, email;
${END}

A duplicate query is only meaningful when the business key is correctly defined.

## Keeping one duplicate and identifying extras

${SQL}
WITH ranked AS (
  SELECT id,
         email,
         ROW_NUMBER() OVER (
           PARTITION BY email
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM users
  WHERE email IS NOT NULL
)
SELECT id, email
FROM ranked
WHERE rn > 1
ORDER BY email, id;
${END}

Do not delete duplicate-looking rows until the survivor rule and dependent relationships are understood.

## Detecting sequence gaps

${SQL}
WITH sequenced AS (
  SELECT entity_id,
         sequence_no,
         LAG(sequence_no) OVER (
           PARTITION BY entity_id
           ORDER BY sequence_no
         ) AS previous_sequence
  FROM events
)
SELECT entity_id, previous_sequence, sequence_no
FROM sequenced
WHERE previous_sequence IS NOT NULL
  AND sequence_no <> previous_sequence + 1
ORDER BY entity_id, sequence_no;
${END}

This is useful for event streams, imported records, telemetry, and ordered processing pipelines.

## Keyset pagination

OFFSET pagination asks the database to skip rows and becomes unstable when data changes between pages. Keyset pagination says “give me the next rows after the last key I saw.”

For descending (created_at, id), the next-page predicate compares against both values. Exact tuple-comparison syntax is engine-specific, but the core rule is to preserve the complete sort key.

## Expected versus actual reconciliation

EXCEPT can identify missing/mismatched expected rows and the reverse EXCEPT can identify unexpected actual rows.

${SQL}
SELECT id, status, amount FROM expected
EXCEPT
SELECT id, status, amount FROM actual;
${END}

## Running state from an event/ledger stream

Window SUM, LAG/LEAD, and cumulative counts let you derive state while retaining every event. This pattern appears in financial ledgers, monitoring, test execution history, and audit trails.

## Relational division / “has all required things”

Problems such as “customers who bought every required category” can be solved with nested NOT EXISTS or grouping/count comparisons. The important step is to define the required set and prove there are no missing members.

**Practice:** find the latest event per user rather than per entity, then compare the result with latest per entity and explain why the grains differ.`
  },
  {
    id: "qa-data-validation",
    label: "SQL for QA & data validation",
    navLabel: "QA data validation",
    level: "Advanced",
    count: 8,
    description: "Turn SQL into a practical testing tool for integrity checks, API/database validation, reconciliation, orphan detection, duplicates, state transitions, and release evidence.",
    sourceIds: ["postgresql-18-queries", "postgresql-18-window", "sqlite-select"],
    markdown: String.raw`# SQL for QA & data validation

For QA engineers, SQL is not only a developer language. It is a way to inspect state independently of the UI/API, validate invariants, compare systems, and create evidence about data quality.

## Validate API results against the database

A strong comparison starts by matching **scope and transformations**. If an API applies authorization, currency conversion, soft-delete filters, or timezone formatting, a raw table query is not automatically the expected result.

Use SQL to reproduce the server-side business scope as closely as possible, then compare stable identifiers and fields.

## Find orphan references

The sample dataset deliberately contains an order that references a non-existent customer.

${SQL}
SELECT o.id, o.customer_id
FROM orders AS o
LEFT JOIN customers AS c ON c.id = o.customer_id
WHERE c.id IS NULL
ORDER BY o.id;
${END}

This is a high-value integrity check where foreign keys are missing, disabled, deferred, or data arrived from external systems.

## Check duplicates by business key

${SQL}
SELECT email, COUNT(*) AS duplicate_count
FROM users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, email;
${END}

The challenge is selecting the **business key**, not writing GROUP BY.

## Validate aggregate invariants

A payment/order invariant might require captured payment amount to equal order total. Join the relevant relations and isolate violations.

${SQL}
SELECT o.id AS order_id,
       o.total,
       p.amount AS payment_amount,
       p.status AS payment_status
FROM orders AS o
JOIN payments AS p ON p.order_id = o.id
WHERE p.status = 'captured'
  AND p.amount <> o.total
ORDER BY o.id;
${END}

A result of zero rows can be a useful assertion when the query explicitly describes invalid states.

## Validate status transitions

Use LAG over event history to compare current and previous states. Then encode allowed transitions in CASE or join to a transition-rules table. This catches impossible state jumps that individual row checks cannot see.

${SQL}
SELECT entity_id,
       occurred_at,
       LAG(status) OVER (
         PARTITION BY entity_id
         ORDER BY occurred_at, id
       ) AS previous_status,
       status AS current_status
FROM events
ORDER BY entity_id, occurred_at, id;
${END}

## Expected versus actual datasets

Normalize both sides to the same columns/types/grain before comparison. Then use joins or EXCEPT in both directions. Differences should be explainable: missing, extra, or mismatched.

## Test-data cleanup safely

Never use broad DELETE statements simply because data is “test data.” Scope by tenant/environment/test-run identifier, inspect the candidate rows first, and respect relationships. In shared QA environments, accidental cleanup can destroy other teams' evidence.

## Database assertions in automation

Database checks are valuable when they verify a behavior that cannot be observed reliably through the public interface, but overusing direct DB assertions can tightly couple tests to implementation. Prefer API/UI behavior for externally visible contracts and DB checks for persistence/integration invariants.

## Practical SQL review checklist for QA

- Does the query use the same tenant/user/environment scope as the system under test?
- Is result grain explicit?
- Are NULLs handled intentionally?
- Are joins one-to-one, one-to-many, or many-to-many as expected?
- Could duplicate amplification invalidate counts/sums?
- Is ordering deterministic?
- Are timestamp/timezone boundaries correct?
- Does zero rows mean “pass,” or did the query accidentally filter everything out?

**Practice:** write three “should return zero rows” integrity queries against the sample database: orphan orders, captured-payment amount mismatch, and impossible/missing email rule of your choice.`
  },
  {
    id: "dialects-production-sql",
    label: "SQL dialects & production habits",
    navLabel: "Dialects & production",
    level: "Expert",
    count: 7,
    description: "Carry portable SQL knowledge into PostgreSQL, MySQL, SQL Server and SQLite while handling dialect differences, concurrency, migrations, observability, and review discipline.",
    sourceIds: ["postgresql-18-tutorial", "postgresql-18-queries", "sqlite-select", "sqlite-transaction", "owasp-sql-injection"],
    markdown: String.raw`# SQL dialects & production habits

Finishing a SQL tutorial does not mean every query is portable or production-safe. Real work adds dialect differences, large data volumes, concurrent transactions, permissions, migrations, monitoring, and failure recovery.

## Common dialect differences to expect

Check target-engine documentation for:

- LIMIT/OFFSET versus TOP/OFFSET-FETCH pagination,
- identity/auto-increment/sequence syntax,
- date/time functions and timezone handling,
- string concatenation and case-insensitive matching,
- boolean types,
- JSON/array operators,
- UPSERT/MERGE syntax,
- RETURNING/OUTPUT clauses,
- stored procedures/functions/triggers,
- locking hints and isolation behavior.

Do not “learn around” these differences by memorizing every vendor. Learn the relational operation first, then look up the concrete syntax.

## Transactions and isolation in production

Atomicity is only one transaction property. Isolation determines which concurrent effects a transaction may observe. Terms such as read committed, repeatable read, serializable, snapshots, locks, deadlocks, and write conflicts matter when multiple requests modify related state.

A test that passes in a single-threaded local database may still fail under production concurrency.

## Migrations are deployment work

Schema migrations need compatibility planning. Common safe patterns include additive changes first, application rollout second, backfill in bounded batches, validation, and only then removal of old columns/constraints. Large index creation or table rewrites can lock or load production systems.

## Query observability

Production database work should expose slow-query information, lock/deadlock metrics, connection-pool saturation, replication lag where applicable, storage growth, and query-plan regressions. A “fast on my laptop” query is not performance evidence.

## Review SQL as code

Important SQL deserves the same review standards as application code:

- intent and expected grain documented,
- parameters instead of concatenated input,
- bounded writes,
- explicit deterministic ordering where required,
- edge cases for NULL and duplicates,
- execution plan checked for expensive queries,
- migration/rollback strategy for schema changes,
- representative tests.

## Choosing a practice engine

SQLite is ideal for this site's zero-install browser exercises and teaches a large portion of relational SQL. PostgreSQL is a strong next step for server-side practice because it exposes rich types, constraints, transactions, query plans, window functions, CTEs, JSON, roles, and production-grade concurrency behavior.

## What “done” looks like

You should be able to solve a new data problem without searching for a copied query: define the desired grain, identify relations and keys, choose filters/joins/grouping/windows, predict NULL and duplicate behavior, produce deterministic results, and validate performance/security assumptions against the target engine.

**Capstone:** write a small investigation using at least one join, one aggregate or window function, one CTE, and one integrity assertion. Explain the result grain and why your query is safe against duplicates and NULL surprises.`
  },
  {
    id: "sql-practice-roadmap",
    label: "Practice roadmap & mastery checks",
    navLabel: "Practice roadmap",
    level: "Expert",
    count: 6,
    description: "Convert the curriculum into deliberate practice with runnable exercises, interview-style problems, debugging tasks, and a clear definition of SQL mastery.",
    sourceIds: ["sqlbolt", "w3schools-sql-syllabus", "postgresql-18-tutorial"],
    markdown: String.raw`# Practice roadmap & mastery checks

SQL becomes durable knowledge when you repeatedly solve unfamiliar questions against data. Reading syntax is only the first pass.

## Stage 1 — query fluency

Without notes, be able to write SELECT, WHERE, ORDER BY, aliases, DISTINCT, IN, BETWEEN, LIKE, IS NULL, CASE, and basic aggregates. Complete several variations of the same problem rather than one copied example.

## Stage 2 — relational reasoning

Practice INNER/LEFT joins, missing relationships, many-to-many joins, GROUP BY/HAVING, EXISTS/NOT EXISTS, UNION ALL, and EXCEPT. Before each query, write down the expected output grain.

## Stage 3 — analytical SQL

Solve latest-row-per-group, top-N-per-group, running totals, previous/next event comparison, duplicate survivor selection, and sequence-gap detection with CTEs and window functions.

## Stage 4 — safe data modification

In a disposable database, practice INSERT/UPDATE/DELETE inside transactions. Verify target rows before and after each mutation. Create tables with primary keys, foreign keys, uniqueness, NOT NULL, CHECK, and indexes.

## Stage 5 — QA investigations

Use the site's practical SQL tasks and interview questions to diagnose intentionally imperfect data. Good tasks have no obvious keyword in the prompt; you must decide whether the solution needs a join, aggregate, subquery, set operation, or window function.

## Mastery checklist

You are ready to call the core path complete when you can:

- explain result grain before running a query,
- predict INNER versus LEFT join survival,
- reason correctly about NULL and NOT EXISTS,
- prevent duplicate amplification in aggregates,
- use windows for ranking/latest/running calculations,
- compare expected and actual sets,
- design basic constraints and indexes,
- execute bounded writes transactionally,
- explain why parameter binding prevents SQL injection,
- read an execution plan at a basic level,
- identify when syntax is SQLite/PostgreSQL/MySQL/SQL Server specific.

This page is currently marked **Under review** while the new curriculum is validated against the site's runnable examples and cross-checked for dialect wording. The path is usable now; the status is intentionally between “under construction” and “review complete.”`
  }
] as const;

export default sqlModules;
