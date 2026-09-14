export type MysqlLearningExample = {
  category: "Tables & data" | "Joins";
  title: string;
  description: string;
  reasoning: string[];
  sql: string;
};

export const MYSQL_SELF_JOIN_LEARNING_EXAMPLES: MysqlLearningExample[] = [
  {
    category: "Tables & data",
    title: "Inspect · Product price history",
    description: "Inspect price history that belongs to real products before comparing each date with the previous day.",
    reasoning: [
      "product_price_history is not a standalone exercise table: product_id references products.id.",
      "Two products have four consecutive history rows each, so the self-join must match both the product and the date relationship.",
      "Expected result: 8 rows. The latest prices are 5.00 for product 1 and 6.37 for product 2, matching products.price.",
    ],
    sql: `SELECT h.product_id,
       p.sku,
       h.price_date,
       h.price
FROM product_price_history AS h
JOIN products AS p ON p.id = h.product_id
ORDER BY h.product_id, h.price_date;`,
  },
  {
    category: "Tables & data",
    title: "Inspect · Order processing events",
    description: "Inspect start/end events that belong to real shipped orders before pairing each order's two events.",
    reasoning: [
      "order_processing_events.order_id references orders.id, so every event belongs to an order already present in the playground.",
      "Each selected shipped order has exactly two rows: one start event and one end event.",
      "Expected result: 12 rows = 6 orders × 2 events. The final example will reuse orders.channel to calculate an average per channel.",
    ],
    sql: `SELECT e.order_id,
       o.channel,
       o.status,
       e.event_type,
       e.event_at
FROM order_processing_events AS e
JOIN orders AS o ON o.id = e.order_id
ORDER BY e.order_id, e.event_at;`,
  },
  {
    category: "Joins",
    title: "Price history self-join · 1 · all pairs",
    description: "Read the same price-history table twice and inspect every candidate current/previous pair before defining the relationship.",
    reasoning: [
      "The comparison needs two different history rows at once, so product_price_history receives the aliases current_price and previous_price.",
      "CROSS JOIN intentionally includes wrong combinations, including rows from different products.",
      "Expected result: 64 rows because 8 current rows × 8 previous rows = 64 candidate pairs.",
    ],
    sql: `SELECT current_price.product_id AS current_product,
       current_price.price_date AS current_date,
       current_price.price AS current_price,
       previous_price.product_id AS previous_product,
       previous_price.price_date AS previous_date,
       previous_price.price AS previous_price
FROM product_price_history AS current_price
CROSS JOIN product_price_history AS previous_price
ORDER BY current_price.product_id, current_price.price_date,
         previous_price.product_id, previous_price.price_date;`,
  },
  {
    category: "Joins",
    title: "Price history self-join · 2 · previous day",
    description: "Define which two history rows belong together: same product, with the previous row exactly one calendar day earlier.",
    reasoning: [
      "current_price.product_id = previous_price.product_id prevents product 1 from being compared with product 2.",
      "DATEDIFF = 1 means the immediately previous calendar day, not any earlier date.",
      "Expected result: 6 rows: each product contributes three consecutive-day pairs because its first history row has no previous day in the table.",
    ],
    sql: `SELECT current_price.product_id,
       current_price.price_date AS current_date,
       current_price.price AS current_price,
       previous_price.price_date AS previous_date,
       previous_price.price AS previous_price
FROM product_price_history AS current_price
JOIN product_price_history AS previous_price
  ON current_price.product_id = previous_price.product_id
 AND DATEDIFF(current_price.price_date, previous_price.price_date) = 1
ORDER BY current_price.product_id, current_price.price_date;`,
  },
  {
    category: "Joins",
    title: "Price history self-join · 3 · price increased",
    description: "After the correct day pairs exist, keep only dates where the product price is higher than on the previous day.",
    reasoning: [
      "ON defines the valid row pair; WHERE applies the actual business condition to those pairs.",
      "Keeping pairing and filtering separate makes it easy to see whether a wrong result comes from the relationship or the comparison.",
      "Expected result: 4 rows. Both products increased on Aug 26 and Aug 28, but not on Aug 27.",
    ],
    sql: `SELECT current_price.product_id,
       current_price.price_date,
       current_price.price,
       previous_price.price AS previous_price
FROM product_price_history AS current_price
JOIN product_price_history AS previous_price
  ON current_price.product_id = previous_price.product_id
 AND DATEDIFF(current_price.price_date, previous_price.price_date) = 1
WHERE current_price.price > previous_price.price
ORDER BY current_price.product_id, current_price.price_date;`,
  },
  {
    category: "Joins",
    title: "Price history self-join · 4 · final answer",
    description: "Return only the product and date requested after the self-join logic has already been verified.",
    reasoning: [
      "During construction, diagnostic price columns help verify the comparison; remove them only after the rows are correct.",
      "This is the same self-join pattern as the classic previous-day comparison exercise, but the data now belongs to the playground's commerce model.",
      "Expected final result: product 1 on Aug 26/Aug 28 and product 2 on Aug 26/Aug 28.",
    ],
    sql: `SELECT current_price.product_id,
       current_price.price_date
FROM product_price_history AS current_price
JOIN product_price_history AS previous_price
  ON current_price.product_id = previous_price.product_id
 AND DATEDIFF(current_price.price_date, previous_price.price_date) = 1
WHERE current_price.price > previous_price.price
ORDER BY current_price.product_id, current_price.price_date;`,
  },
  {
    category: "Joins",
    title: "Processing time · 1 · all event pairs",
    description: "Read order_processing_events twice so one alias can eventually be start and the other end; first inspect all combinations.",
    reasoning: [
      "A duration needs two rows at once: the start event and the end event.",
      "Both rows live in order_processing_events, so this is another self-join.",
      "Expected result: 144 rows because 12 event rows × 12 event rows = 144 candidate pairs.",
    ],
    sql: `SELECT s.order_id AS s_order,
       s.event_type AS s_type,
       s.event_at AS s_time,
       e.order_id AS e_order,
       e.event_type AS e_type,
       e.event_at AS e_time
FROM order_processing_events AS s
CROSS JOIN order_processing_events AS e
ORDER BY s.order_id, s.event_at, e.order_id, e.event_at;`,
  },
  {
    category: "Joins",
    title: "Processing time · 2 · same order",
    description: "Add the relationship key so candidate rows can pair only when both events belong to the same order.",
    reasoning: [
      "order_id is the entity relationship we need: events from different orders can never form one processing duration.",
      "Each order still has start/start, start/end, end/start and end/end combinations because the alias roles are not fixed yet.",
      "Expected result: 24 rows = 6 orders × 4 event-role combinations per order.",
    ],
    sql: `SELECT s.order_id,
       s.event_type AS s_type,
       s.event_at AS s_time,
       e.event_type AS e_type,
       e.event_at AS e_time
FROM order_processing_events AS s
JOIN order_processing_events AS e
  ON s.order_id = e.order_id
ORDER BY s.order_id, s.event_at, e.event_at;`,
  },
  {
    category: "Joins",
    title: "Processing time · 3 · start to end",
    description: "Assign the two aliases their real roles: s is the start event and e is the end event for the same order.",
    reasoning: [
      "The ON condition says which entity the rows belong to; the WHERE conditions say which event role each alias represents.",
      "After this step every result row has exactly one order with its correct start and end timestamps side by side.",
      "Expected result: 6 rows = one valid event pair for each seeded order.",
    ],
    sql: `SELECT s.order_id,
       s.event_at AS start_time,
       e.event_at AS end_time
FROM order_processing_events AS s
JOIN order_processing_events AS e
  ON s.order_id = e.order_id
WHERE s.event_type = 'start'
  AND e.event_type = 'end'
ORDER BY s.order_id;`,
  },
  {
    category: "Joins",
    title: "Processing time · 4 · calculate duration",
    description: "Once each row contains the correct start and end, calculate the order's processing duration in seconds.",
    reasoning: [
      "TIMESTAMPDIFF calculates the interval between the paired timestamps; using microseconds preserves the millisecond fixture precision.",
      "Do arithmetic only after row pairing is correct, otherwise a valid number can still be calculated from the wrong events.",
      "Expected result: still 6 rows. Only a calculated processing_seconds column is added.",
    ],
    sql: `SELECT s.order_id,
       s.event_at AS start_time,
       e.event_at AS end_time,
       TIMESTAMPDIFF(MICROSECOND, s.event_at, e.event_at) / 1000000.0 AS processing_seconds
FROM order_processing_events AS s
JOIN order_processing_events AS e
  ON s.order_id = e.order_id
WHERE s.event_type = 'start'
  AND e.event_type = 'end'
ORDER BY s.order_id;`,
  },
  {
    category: "Joins",
    title: "Processing time · 5 · attach order context",
    description: "Join each correctly paired duration back to orders so the existing commerce data supplies channel and status.",
    reasoning: [
      "The self-join solves the event-pair problem; JOIN orders adds business context instead of duplicating channel inside the event table.",
      "This is why order_processing_events stores order_id rather than unrelated machine/process identifiers.",
      "Expected result: 6 shipped orders across partner, web, and mobile channels.",
    ],
    sql: `SELECT o.id AS order_id,
       o.channel,
       o.status,
       TIMESTAMPDIFF(MICROSECOND, s.event_at, e.event_at) / 1000000.0 AS processing_seconds
FROM order_processing_events AS s
JOIN order_processing_events AS e
  ON s.order_id = e.order_id
JOIN orders AS o
  ON o.id = s.order_id
WHERE s.event_type = 'start'
  AND e.event_type = 'end'
ORDER BY o.channel, o.id;`,
  },
  {
    category: "Joins",
    title: "Processing time · 6 · average per channel",
    description: "Only after each order has one correct duration, group those durations by the channel already stored on orders.",
    reasoning: [
      "GROUP BY comes last because AVG should receive one correct duration per order, not the raw event rows.",
      "The event table stays normalized: channel belongs to orders, so the final query joins to orders instead of copying channel into every event.",
      "Expected final result: mobile = 1.456 s, partner = 0.894 s, web = 0.995 s.",
    ],
    sql: `SELECT o.channel,
       ROUND(AVG(TIMESTAMPDIFF(MICROSECOND, s.event_at, e.event_at) / 1000000.0), 3) AS processing_seconds
FROM order_processing_events AS s
JOIN order_processing_events AS e
  ON s.order_id = e.order_id
JOIN orders AS o
  ON o.id = s.order_id
WHERE s.event_type = 'start'
  AND e.event_type = 'end'
GROUP BY o.channel
ORDER BY o.channel;`,
  },
];
