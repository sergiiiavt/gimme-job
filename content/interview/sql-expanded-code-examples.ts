import type { InterviewCodeExampleEnhancement } from "./sql-code-examples";

const sqlExpandedCodeExamples: InterviewCodeExampleEnhancement[] = [
  {
    id: "database-test-scope",
    codeExamples: [{
      title: "Validate database integrity beyond row existence",
      titleUk: "Перевірити цілісність БД, а не лише наявність row",
      language: "sql",
      code: `-- Orphaned foreign-key relationships should not exist\nSELECT o.id AS order_id, o.customer_id\nFROM orders o\nLEFT JOIN customers c ON c.id = o.customer_id\nWHERE c.id IS NULL;\n\n-- Required audit/default fields should satisfy their invariants\nSELECT id, created_at, updated_at\nFROM orders\nWHERE created_at IS NULL\n   OR updated_at IS NULL\n   OR updated_at < created_at;`,
      explanation: "A database integration check should verify invariants, not only that an INSERT produced a row. Use SQL to look for broken relationships and invalid persisted state, while separate tests exercise transaction rollback, isolation/concurrency, migrations, encoding and time-zone behavior through the supported application or database boundary.",
      explanationUk: "Database integration check має перевіряти invariants, а не лише те, що INSERT створив row. SQL допомагає знайти зламані relationships та некоректний persisted state; окремими тестами перевіряйте rollback транзакцій, isolation/concurrency, migrations, encoding і time-zone behavior через підтримувану межу застосунку або БД.",
      expectedResult: "Both queries return zero rows when referential integrity and required persisted-state rules hold.",
      expectedResultUk: "Обидва queries повертають нуль rows, якщо referential integrity і required persisted-state rules виконуються."
    }]
  },
  {
    id: "sql-joins-and-aggregation",
    codeExamples: [{
      title: "Compare JOIN behavior and aggregate groups",
      titleUk: "Порівняти JOIN behavior та агрегувати groups",
      language: "sql",
      code: `-- INNER JOIN keeps only customers that have matching orders\nSELECT c.id, o.id AS order_id\nFROM customers c\nINNER JOIN orders o ON o.customer_id = c.id;\n\n-- LEFT JOIN keeps every customer, including customers with zero orders\nSELECT\n  c.id,\n  COUNT(o.id) AS order_count,\n  COALESCE(SUM(o.total), 0) AS total_spend\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.id\nHAVING COUNT(o.id) >= 2\nORDER BY total_spend DESC;`,
      explanation: "INNER JOIN removes left-side rows without a match; LEFT JOIN preserves them and fills right-side columns with NULL. GROUP BY creates one aggregate group per customer, aggregate functions calculate values for each group, and HAVING filters those groups after aggregation. COUNT(o.id), rather than COUNT(*), keeps zero-order customers from being counted as one joined row.",
      explanationUk: "INNER JOIN відкидає left-side rows без match; LEFT JOIN зберігає їх і заповнює right-side columns значеннями NULL. GROUP BY створює aggregate group для кожного customer, aggregate functions рахують значення для групи, а HAVING фільтрує групи вже після aggregation. COUNT(o.id), на відміну від COUNT(*), не рахує customer без orders як один joined row.",
      expectedResult: "The first query contains only matched customers/orders; the second returns customers with at least two orders and their aggregated spend.",
      expectedResultUk: "Перший query містить лише matched customers/orders; другий повертає customers щонайменше з двома orders та їх aggregated spend."
    }]
  }
];

export default sqlExpandedCodeExamples;
