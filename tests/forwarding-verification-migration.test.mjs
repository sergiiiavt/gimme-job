import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../drizzle/0010_forwarding_verification.sql", import.meta.url), "utf8");

test("forwarding verification storage is user-scoped and expiring", () => {
  assert.match(migration, /user_id TEXT PRIMARY KEY NOT NULL/);
  assert.match(migration, /verification_url TEXT/);
  assert.match(migration, /confirmation_code TEXT/);
  assert.match(migration, /expires_at TEXT NOT NULL/);
});
