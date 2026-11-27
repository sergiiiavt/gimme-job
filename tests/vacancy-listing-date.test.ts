import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { register } from "tsx/esm/api";

// The signed-in dashboard reads its database from the Worker runtime; the test
// installs a SQLite-backed binding on this shared object before calling it.
const runtimeEnv = ((globalThis as { __listingDateTestEnv?: Record<string, unknown> }).__listingDateTestEnv = {});
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent("export const env = globalThis.__listingDateTestEnv;")}` };
    }
    return nextResolve(specifier, context);
  },
});
register();

const { publicVacancies, publicVacancyById, publicVacancySummaries, upsertVacancies } = await import("../app/api/_vacancy-intake.ts");
const { dashboard } = await import("../app/api/_jobpilot.ts");
const { listedAtOf } = await import("../app/api/_vacancy-listing-date.ts");

type Row = Record<string, unknown>;

const MIGRATIONS = new URL("../drizzle/", import.meta.url);

/** The production schema from the canonical migrations, retried in order as in the import tests. */
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

/** The subset of the D1 binding the catalogue reads use, over real SQLite. */
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
  };
}

/** Each scenario: the board's date and when GimmeJob first stored the vacancy. */
const SCENARIOS = [
  { key: "prompt-today", postedAt: "2026-11-27T10:00:00.000Z", discoveredAt: "2026-11-27T10:47:00.000Z" },
  { key: "late-arrival", postedAt: "2026-11-23T15:11:33.944Z", discoveredAt: "2026-11-26T15:12:55.328Z" },
  { key: "same-day-board-date", postedAt: "2026-11-26T00:00:00.000Z", discoveredAt: "2026-11-26T20:00:00.000Z" },
  { key: "prompt-earlier", postedAt: "2026-11-25T09:00:00.000Z", discoveredAt: "2026-11-25T09:47:00.000Z" },
  { key: "no-board-date", postedAt: null, discoveredAt: "2026-11-24T08:00:00.000Z" },
  { key: "new-source-backlog", postedAt: "2026-10-01T09:00:00.000Z", discoveredAt: "2026-11-26T12:00:00.000Z" },
  { key: "republished", postedAt: "2026-11-26T20:30:00.000Z", discoveredAt: "2026-09-21T10:00:00.000Z" },
] as const;

async function seededCatalogue() {
  const db = migratedDatabase();
  const binding = d1(db);
  await upsertVacancies(SCENARIOS.map((scenario, index) => {
    const url = `https://djinni.co/jobs/${859400 + index}-${scenario.key}/`;
    return {
      source: "djinni:djinni-qa",
      externalId: String(859400 + index),
      title: `QA Engineer ${scenario.key}`,
      company: `Company ${scenario.key}`,
      location: "Remote",
      remote: true,
      url,
      applyUrl: url,
      description: `Test web applications and REST APIs for ${scenario.key}.`,
      salaryText: null,
      postedAt: scenario.postedAt,
      contactEmail: null,
    };
  }), binding);
  for (const [index, scenario] of SCENARIOS.entries()) {
    db.prepare("UPDATE jobs SET discovered_at = ? WHERE external_id = ?").run(scenario.discoveredAt, String(859400 + index));
  }
  return binding;
}

const keyOf = (job: { title: string }) => job.title.replace("QA Engineer ", "");

test("a vacancy found more than a day after its board date is listed when it was found", async () => {
  const db = await seededCatalogue();
  const { jobs } = await publicVacancySummaries(db);
  const late = jobs.find((job) => keyOf(job) === "late-arrival");

  assert.ok(late);
  assert.equal(late.listedAt, "2026-11-26T15:12:55.328Z");
  // The board date stays available for the detail view.
  assert.equal(late.postedAt, "2026-11-23T15:11:33.944Z");
});

test("the catalogue orders by listed date, keeping board dates for prompt, republished and backlog vacancies", async () => {
  const db = await seededCatalogue();
  const expected = ["prompt-today", "republished", "late-arrival", "same-day-board-date", "prompt-earlier", "no-board-date", "new-source-backlog"];

  const summaries = await publicVacancySummaries(db);
  assert.deepEqual(summaries.jobs.map(keyOf), expected);

  const full = await publicVacancies(db);
  assert.deepEqual(full.jobs.map(keyOf), expected);

  const listed = Object.fromEntries(summaries.jobs.map((job) => [keyOf(job), job.listedAt]));
  assert.equal(listed["prompt-today"], "2026-11-27T10:00:00.000Z");
  assert.equal(listed["same-day-board-date"], "2026-11-26T00:00:00.000Z");
  assert.equal(listed["no-board-date"], "2026-11-24T08:00:00.000Z");
  assert.equal(listed["new-source-backlog"], "2026-10-01T09:00:00.000Z");
  assert.equal(listed.republished, "2026-11-26T20:30:00.000Z");
});

test("the signed-in dashboard applies the same listed date and order", async () => {
  runtimeEnv.DB = await seededCatalogue();
  const result = await dashboard();

  assert.deepEqual(result.jobs.map(keyOf), ["prompt-today", "republished", "late-arrival", "same-day-board-date", "prompt-earlier", "no-board-date", "new-source-backlog"]);
  const late = result.jobs.find((job) => keyOf(job) === "late-arrival");
  assert.equal(late?.listedAt, "2026-11-26T15:12:55.328Z");
  assert.equal(late?.postedAt, "2026-11-23T15:11:33.944Z");
});

test("vacancy detail carries the same listed date as the list", async () => {
  const db = await seededCatalogue();
  const { jobs } = await publicVacancySummaries(db);
  const late = jobs.find((job) => keyOf(job) === "late-arrival");
  assert.ok(late);

  const detail = await publicVacancyById(late.id, db);
  assert.equal(detail?.listedAt, late.listedAt);
});

test("a row read without a listed date falls back to the board date, then discovery", () => {
  const discoveredAt = "2026-11-26T15:12:55.328Z";
  assert.equal(listedAtOf({ listed_at: discoveredAt, posted_at: "2026-11-23T15:11:33.944Z", discovered_at: discoveredAt }), discoveredAt);
  assert.equal(listedAtOf({ posted_at: "2026-11-23T15:11:33.944Z", discovered_at: discoveredAt }), "2026-11-23T15:11:33.944Z");
  assert.equal(listedAtOf({ listed_at: null, posted_at: " ", discovered_at: discoveredAt }), discoveredAt);
  assert.equal(listedAtOf({}), "");
});
