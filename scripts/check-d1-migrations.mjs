import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = path.join(projectRoot, "drizzle");
const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

const HISTORICAL_DUPLICATES = new Map([
  ["0004", new Set(["0004_clear_stale_resume_pii.sql", "0004_hard_thena.sql"])],
  ["0007", new Set(["0007_legal_shocker.sql", "0007_multi_user_auth_foundation.sql"])],
  ["0009", new Set(["0009_ai_email_classification.sql", "0009_password_auth_forwarding.sql"])],
  ["0013", new Set(["0013_clear_interview_stars.sql", "0013_preserve_known_job_company.sql"])],
]);

const entries = await readdir(migrationDir, { withFileTypes: true });
const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
assert.ok(files.length > 0, "drizzle/ must contain D1 migration SQL files");

const byPrefix = new Map();
for (const file of files) {
  const match = file.match(FILE_PATTERN);
  assert.ok(match, `Unexpected file in drizzle/: ${file}. Migrations must use NNNN_snake_case.sql.`);
  const sql = await readFile(path.join(migrationDir, file), "utf8");
  assert.ok(sql.trim(), `Migration ${file} must not be empty.`);
  const prefix = match[1];
  const group = byPrefix.get(prefix) ?? [];
  group.push(file);
  byPrefix.set(prefix, group);
}

const numericPrefixes = [...byPrefix.keys()].map(Number).sort((left, right) => left - right);
assert.equal(numericPrefixes[0], 0, "D1 migration history must start at 0000");
for (let index = 1; index < numericPrefixes.length; index += 1) {
  assert.equal(
    numericPrefixes[index],
    numericPrefixes[index - 1] + 1,
    `D1 migration sequence has a gap between ${String(numericPrefixes[index - 1]).padStart(4, "0")} and ${String(numericPrefixes[index]).padStart(4, "0")}`,
  );
}

for (const [prefix, group] of byPrefix) {
  if (group.length === 1) continue;
  const historical = HISTORICAL_DUPLICATES.get(prefix);
  assert.ok(historical, `Migration prefix ${prefix} is duplicated. New migrations must use the next unused prefix.`);
  assert.deepEqual(
    new Set(group),
    historical,
    `Historical duplicate prefix ${prefix} changed. Do not rename already-applied migrations.`,
  );
}

for (const [prefix, expected] of HISTORICAL_DUPLICATES) {
  assert.deepEqual(
    new Set(byPrefix.get(prefix) ?? []),
    expected,
    `Historical migration set ${prefix} changed. Applied migration filenames are immutable.`,
  );
}

const latest = String(numericPrefixes.at(-1)).padStart(4, "0");
console.log(`D1 migration contract valid: ${files.length} migrations through ${latest}.`);
