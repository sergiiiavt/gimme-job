import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(projectRoot, "drizzle");
const retiredDrizzleContracts = [
  path.join(projectRoot, "db", "schema.ts"),
  path.join(projectRoot, "db", "index.ts"),
  path.join(projectRoot, "drizzle.config.ts"),
];

const legacyDuplicatePrefixes = new Set(["0004", "0007", "0009", "0013"]);

for (const retired of retiredDrizzleContracts) {
  try {
    await access(retired);
    throw new Error(`${path.relative(projectRoot, retired)} must not be restored: production D1 schema ownership belongs to ordered SQL migrations in drizzle/.`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

if (!files.length) throw new Error("No production D1 migrations were found.");

const byPrefix = new Map();
for (const file of files) {
  const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) throw new Error(`Invalid migration filename: ${file}`);
  const prefix = match[1];
  const entries = byPrefix.get(prefix) ?? [];
  entries.push(file);
  byPrefix.set(prefix, entries);

  const sql = (await readFile(path.join(migrationsDir, file), "utf8")).trim();
  if (!sql) throw new Error(`Migration is empty: ${file}`);
}

for (const [prefix, entries] of byPrefix) {
  if (entries.length > 1 && !legacyDuplicatePrefixes.has(prefix)) {
    throw new Error(`Migration prefix ${prefix} is duplicated: ${entries.join(", ")}`);
  }
}

const numericPrefixes = [...byPrefix.keys()].map(Number);
const maximum = Math.max(...numericPrefixes);
for (let index = 0; index <= maximum; index += 1) {
  const prefix = String(index).padStart(4, "0");
  if (!byPrefix.has(prefix)) throw new Error(`Migration sequence has a gap at ${prefix}.`);
}

console.log(`D1 migration contract valid: ${files.length} SQL files through ${String(maximum).padStart(4, "0")}.`);
