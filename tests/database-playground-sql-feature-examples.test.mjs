import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const enhancer = readFileSync(new URL("../app/playgrounds/databases/database-code-enhancer.tsx", import.meta.url), "utf8");

test("Database Playground exposes runnable transaction examples", () => {
  assert.match(enhancer, /Transaction · ROLLBACK/);
  assert.match(enhancer, /START TRANSACTION;/);
  assert.match(enhancer, /BEGIN;/);
  assert.match(enhancer, /ROLLBACK;/);
  assert.match(enhancer, /Transaction · COMMIT/);
  assert.match(enhancer, /CREATE TEMPORARY TABLE IF NOT EXISTS transaction_demo/);
  assert.match(enhancer, /COMMIT;/);
});

test("Database Playground exposes several window-function patterns", () => {
  assert.match(enhancer, /Window function · running SUM/);
  assert.match(enhancer, /SUM\(total_amount\) OVER/);
  assert.match(enhancer, /ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW/);
  assert.match(enhancer, /Window function · LAG/);
  assert.match(enhancer, /LAG\(total_amount\) OVER/);
  assert.match(enhancer, /Window function · RANK/);
  assert.match(enhancer, /RANK\(\) OVER/);
});

test("Database Playground trigger example uses the correct MySQL and PostgreSQL forms", () => {
  assert.match(enhancer, /Trigger · audit order updates/);
  assert.match(enhancer, /DROP TRIGGER IF EXISTS trg_orders_status_audit;/);
  assert.match(enhancer, /CREATE TRIGGER trg_orders_status_audit/);
  assert.match(enhancer, /VALUES \(OLD\.id, OLD\.status, NEW\.status\)/);
  assert.match(enhancer, /CREATE OR REPLACE FUNCTION log_order_status_change\(\)/);
  assert.match(enhancer, /RETURNS trigger/);
  assert.match(enhancer, /EXECUTE FUNCTION log_order_status_change\(\)/);
});

test("supplemental SQL examples are restricted to MySQL and PostgreSQL Advanced SQL", () => {
  assert.match(enhancer, /type SqlEngine = "mysql" \| "postgres"/);
  assert.match(enhancer, /selectedCategory\?\.textContent\?\.trim\(\) !== "Advanced SQL"/);
  assert.match(enhancer, /if \(label === "MySQL"\) return "mysql"/);
  assert.match(enhancer, /if \(label === "PG"\) return "postgres"/);
  assert.match(enhancer, /return null;/);
});
