import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { register } from "tsx/esm/api";

register();

const { importVacancyCatalog } = await import("../app/api/_vacancy-import.ts");
const { readVacancySyncState } = await import("../app/api/_vacancy-sync-state.ts");

type Row = Record<string, unknown>;

const MIGRATIONS = new URL("../drizzle/", import.meta.url);

/**
 * The production schema, built from the canonical migrations. Some historical
 * files were applied out of filename order (0007_legal_shocker alters a table
 * 0008 creates), so a file that fails is retried after the rest have run.
 */
function migratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  const apply = (file: string): boolean => {
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
      db.exec("COMMIT");
      return true;
    } catch {
      db.exec("ROLLBACK");
      return false;
    }
  };
  let pending = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
  while (pending.length > 0) {
    const remaining = pending.filter((file) => !apply(file));
    if (remaining.length === pending.length) break;
    pending = remaining;
  }
  assert.deepEqual(pending, [], "every migration must apply");
  return db;
}

/** The subset of the D1 binding the vacancy import uses, over real SQLite. */
function d1(db: DatabaseSync) {
  const statement = (sql: string, values: unknown[]) => {
    const bound = values as SQLInputValue[];
    return {
      async first<T = Row>() {
        return (db.prepare(sql).get(...bound) as T | undefined) ?? null;
      },
      async all<T = Row>() {
        return { results: db.prepare(sql).all(...bound) as T[] };
      },
      async run() {
        return db.prepare(sql).run(...bound);
      },
    };
  };
  return {
    prepare(sql: string) {
      return {
        bind: (...values: unknown[]) => statement(sql, values),
        first: <T = Row>() => statement(sql, []).first<T>(),
        all: <T = Row>() => statement(sql, []).all<T>(),
      };
    },
    // D1 batches are atomic.
    async batch(statements: Array<{ run(): Promise<unknown> }>) {
      db.exec("BEGIN");
      try {
        for (const entry of statements) await entry.run();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return [];
    },
  };
}

/** One vacancy as the hourly DOU runner posts it to the import route. */
function douVacancy(id: number) {
  const company = ["Acme", "Globex"][id - 1] ?? `Studio ${id}`;
  const url = `https://jobs.dou.ua/companies/${company.toLowerCase().replace(/\s+/g, "-")}/vacancies/${id}/`;
  return {
    source: "rss:dou-qa",
    externalId: String(id),
    title: "Middle QA Engineer",
    company,
    location: "Київ",
    remote: false,
    url,
    applyUrl: url,
    description: `Vacancy ${id}. ${"Тестування веб-застосунку, REST API, SQL, Jira та Playwright. ".repeat(30)}`,
    salaryText: null,
    postedAt: "2026-11-01T08:00:00.000Z",
    contactEmail: null,
    raw: { discovery: "dou-listing", companySource: "listing-anchor", descriptionSource: "detail-page" },
  };
}

function rawJsonSizes(db: DatabaseSync): number[] {
  return (db.prepare("SELECT length(raw_json) AS size FROM jobs ORDER BY external_id").all() as Array<{ size: number }>)
    .map((row) => row.size);
}

test("hourly DOU imports of the same vacancies keep each stored row the same size", async () => {
  const db = migratedDatabase();
  const catalogue = [douVacancy(1), douVacancy(2)];
  const sizes: number[][] = [];

  for (let run = 0; run < 30; run += 1) {
    await importVacancyCatalog(catalogue, "scheduled-dou", d1(db));
    sizes.push(rawJsonSizes(db));
  }

  assert.equal(sizes[0]!.length, 2, "the two vacancies stay two rows");
  // Each import before the fix added a full copy of the row's metadata.
  assert.deepEqual(sizes.at(-1), sizes[2]);
  assert.equal((await readVacancySyncState(d1(db))).status, "SUCCESS");
  db.close();
});

test("a row bloated by earlier imports is compacted by its next import", async () => {
  const db = migratedDatabase();
  // The merge's own keys are added during the first imports; three reach the steady state.
  for (let run = 0; run < 3; run += 1) await importVacancyCatalog([douVacancy(1)], "scheduled-dou", d1(db));
  const [healthySize] = rawJsonSizes(db);

  // What production rows looked like: one nested copy of the previous metadata per sync.
  const stored = JSON.parse(String((db.prepare("SELECT raw_json FROM jobs").get() as Row).raw_json)) as Row;
  let bloated: Row = stored;
  for (let sync = 0; sync < 300; sync += 1) bloated = { ...stored, primary: bloated };
  db.prepare("UPDATE jobs SET raw_json = ?").run(JSON.stringify(bloated));
  assert.ok(rawJsonSizes(db)[0]! > 100 * healthySize!, "the fixture must reproduce the growth");

  await importVacancyCatalog([douVacancy(1)], "scheduled-dou", d1(db));

  assert.deepEqual(rawJsonSizes(db), [healthySize]);
  const raw = JSON.parse(String((db.prepare("SELECT raw_json FROM jobs").get() as Row).raw_json)) as Row;
  assert.equal("primary" in (raw.primary as Row), false, "provenance keeps one level");
  db.close();
});

test("a stored row whose raw_json is not valid JSON does not block the import", async () => {
  const db = migratedDatabase();
  await importVacancyCatalog([douVacancy(1)], "scheduled-dou", d1(db));
  db.prepare("UPDATE jobs SET raw_json = ?").run("{not json");

  const result = await importVacancyCatalog([douVacancy(1), douVacancy(2)], "scheduled-dou", d1(db));

  assert.equal(result.updated, 1);
  assert.equal(result.inserted, 1);
  db.close();
});
