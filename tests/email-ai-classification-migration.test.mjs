import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../drizzle/0009_ai_email_classification.sql", import.meta.url), "utf8");

test("AI email migration adds bounded-excerpt and structured classification columns", () => {
  assert.match(migration, /ADD COLUMN `text_excerpt` text/);
  assert.match(migration, /ADD COLUMN `classification_confidence` real/);
  assert.match(migration, /ADD COLUMN `classification_source` text/);
  assert.match(migration, /ADD COLUMN `action` text/);
});

test("AI email migration converts forwarding confirmation noise and requeues legacy OTHER forwarding events", () => {
  assert.match(migration, /classification` = 'SERVICE_MESSAGE'/);
  assert.match(migration, /forwarding-noreply@google\.com/);
  assert.match(migration, /forwarding confirmation/);
  assert.match(migration, /classification` = 'UNCLASSIFIED'/);
  assert.match(migration, /provider` = 'email_forwarding'/);
  assert.match(migration, /classification` = 'OTHER'/);
});
