import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The SQL assertions below are newline-exact. A Windows checkout (core.autocrlf)
// delivers CRLF, so the source is normalized before matching.
const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const learningSource = readSource("../app/playgrounds/databases/mysql-self-join-learning.ts");
const playgroundSource = readSource("../app/playgrounds/databases/database-playground.tsx");

test("self-join lessons use real commerce tables instead of isolated exercise fixtures", () => {
  assert.match(learningSource, /FROM product_price_history AS current_price/);
  assert.match(learningSource, /FROM order_processing_events AS s/);
  assert.match(learningSource, /JOIN products AS p ON p\.id = h\.product_id/);
  assert.match(learningSource, /JOIN orders AS o\n  ON o\.id = s\.order_id/);
  assert.match(learningSource, /Inspect · Product price history/);
  assert.match(learningSource, /Inspect · Order processing events/);
  assert.doesNotMatch(learningSource, /\bWeather\b|\bActivity\b/);
});

test("price-history lesson adds one idea at a time", () => {
  for (const step of [
    "Price history self-join · 1 · all pairs",
    "Price history self-join · 2 · previous day",
    "Price history self-join · 3 · price increased",
    "Price history self-join · 4 · final answer",
  ]) assert.match(learningSource, new RegExp(step.replaceAll("·", "\\u00b7")));

  assert.match(learningSource, /CROSS JOIN product_price_history AS previous_price/);
  assert.match(learningSource, /current_price\.product_id = previous_price\.product_id/);
  assert.match(learningSource, /DATEDIFF\(current_price\.price_date, previous_price\.price_date\) = 1/);
  assert.match(learningSource, /WHERE current_price\.price > previous_price\.price/);
  assert.match(learningSource, /sql: `SELECT current_price\.product_id,\n       current_price\.price_date/);
});

test("price-history examples avoid MySQL reserved date aliases", () => {
  assert.doesNotMatch(learningSource, /\bAS\s+current_date\b/i);
  assert.match(learningSource, /current_price\.price_date AS current_price_date/);
  assert.match(learningSource, /previous_price\.price_date AS previous_price_date/);
});

test("order-processing lesson builds pairing before arithmetic, business context, and aggregation", () => {
  for (const step of [
    "Processing time · 1 · all event pairs",
    "Processing time · 2 · same order",
    "Processing time · 3 · start to end",
    "Processing time · 4 · calculate duration",
    "Processing time · 5 · attach order context",
    "Processing time · 6 · average per channel",
  ]) assert.match(learningSource, new RegExp(step.replaceAll("·", "\\u00b7")));

  assert.match(learningSource, /ON s\.order_id = e\.order_id/);
  assert.match(learningSource, /WHERE s\.event_type = 'start'\n  AND e\.event_type = 'end'/);
  assert.match(learningSource, /TIMESTAMPDIFF\(MICROSECOND, s\.event_at, e\.event_at\) \/ 1000000\.0 AS processing_seconds/);
  assert.match(learningSource, /JOIN orders AS o\n  ON o\.id = s\.order_id/);
  assert.match(learningSource, /GROUP BY o\.channel/);
  assert.match(learningSource, /mobile = 1\.456 s, partner = 0\.894 s, web = 0\.995 s/);
});

test("playground renders reasoning with the learning query and keeps it MySQL-only", () => {
  assert.match(playgroundSource, /MYSQL_SELF_JOIN_LEARNING_EXAMPLES/);
  assert.match(playgroundSource, /mysql \? MYSQL_SELF_JOIN_LEARNING_EXAMPLES/);
  assert.match(playgroundSource, /data-db-learning-note/);
  assert.match(playgroundSource, /Think: \{note\}/);
});
