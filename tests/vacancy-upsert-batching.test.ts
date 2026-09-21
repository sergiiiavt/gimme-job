import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { upsertVacancies } = await import("../app/api/_vacancy-intake.ts");
const { VacancyDuplicateIndex, areDuplicateVacancies, deduplicateVacancies } = await import("../agent/src/job-intake.ts");

type Row = Record<string, unknown>;

/**
 * Records how the catalogue is written: a sync used to spend one awaited
 * round trip per vacancy, so the shape of the write traffic is the contract.
 */
class RecordingD1 {
  jobs: Row[] = [];
  batches: number[] = [];
  looseRuns = 0;
  supportsBatch = true;

  private apply(normalized: string, values: unknown[]) {
    if (normalized.startsWith("update jobs set relevant =")) {
      const id = String(values[4]);
      const row = this.jobs.find((entry) => entry.id === id);
      assert.ok(row, `metadata target ${id} must already exist when the statement runs`);
      Object.assign(row, {
        relevant: values[0],
        display_source: values[1],
        dedupe_url: values[2],
        dedupe_company: values[3],
      });
      return;
    }
    if (normalized.startsWith("update jobs set")) {
      const id = String(values[17]);
      const row = this.jobs.find((entry) => entry.id === id);
      assert.ok(row, `update target ${id} must already exist when the statement runs`);
      Object.assign(row, {
        title: values[2],
        company: values[3],
        description: values[8],
        source: values[0],
        relevant: 1,
        display_source: values[14],
        dedupe_url: values[15],
        dedupe_company: values[16],
      });
      return;
    }
    if (normalized.startsWith("insert into jobs")) {
      const [id, fingerprint, source, , title, company, , , url, , description,
        , , , , , , displaySource, dedupeUrl, dedupeCompany] = values;
      const existing = this.jobs.find((entry) => entry.fingerprint === fingerprint);
      if (existing) {
        Object.assign(existing, {
          source, title, company, url, description,
          relevant: 1,
          display_source: displaySource,
          dedupe_url: dedupeUrl,
          dedupe_company: dedupeCompany,
        });
        return;
      }
      this.jobs.push({
        id, fingerprint, source, title, company, url, description,
        discovered_at: "2026-09-20T00:00:00.000Z",
        relevant: 1,
        display_source: displaySource,
        dedupe_url: dedupeUrl,
        dedupe_company: dedupeCompany,
      });
    }
  }

  prepare(query: string) {
    const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();
    const statement = (values: unknown[]) => ({
      normalized,
      values,
      first: async <T>() => (normalized.includes("count(*)") ? { count: this.jobs.length } as T : null),
      all: async <T>() => {
        if (!normalized.includes("from jobs")) return { results: [] as T[] };
        const rows = normalized.includes("where display_source is null")
          ? this.jobs.filter((row) => row.display_source == null)
          : this.jobs;
        return { results: [...rows] as T[] };
      },
      run: async () => {
        this.looseRuns += 1;
        this.apply(normalized, values);
        return {};
      },
    });
    return {
      bind: (...values: unknown[]) => statement(values),
      first: async <T>() => statement([]).first<T>(),
      all: async <T>() => statement([]).all<T>(),
    };
  }

  get batch() {
    if (!this.supportsBatch) return undefined;
    return async (statements: Array<{ normalized: string; values: unknown[] }>) => {
      this.batches.push(statements.length);
      for (const entry of statements) this.apply(entry.normalized, entry.values);
      return [];
    };
  }
}

function vacancy(index: number) {
  return {
    source: "djinni:qa",
    externalId: `djinni-${index}`,
    title: `Senior QA Automation Engineer ${index}`,
    company: `Studio ${index}`,
    location: "Kyiv",
    remote: false,
    url: `https://djinni.co/jobs/${index}-qa/`,
    applyUrl: `https://djinni.co/jobs/${index}-qa/`,
    description: "Requirements\n- API testing\n- SQL\n- Playwright\n\nResponsibilities\n- Test a web application and REST services.",
    salaryText: null,
    postedAt: "2026-09-18T08:00:00.000Z",
    contactEmail: null,
    raw: {},
  };
}

test("a sync writes the catalogue in batches instead of one round trip per vacancy", async () => {
  const db = new RecordingD1();
  const result = await upsertVacancies(Array.from({ length: 120 }, (_, index) => vacancy(index)), db);

  assert.equal(result.inserted, 120);
  assert.equal(db.jobs.length, 120);
  assert.equal(db.looseRuns, 0, "no statement should be awaited individually");
  assert.deepEqual(db.batches, [50, 50, 20]);
});

test("a database without batch support still applies every statement in order", async () => {
  const db = new RecordingD1();
  db.supportsBatch = false;
  const result = await upsertVacancies(Array.from({ length: 7 }, (_, index) => vacancy(index)), db);

  assert.equal(result.inserted, 7);
  assert.equal(db.jobs.length, 7);
  assert.equal(db.looseRuns, 7);
  assert.deepEqual(db.batches, []);
});

test("a vacancy merged into one inserted by the same run updates a row that already exists", async () => {
  const db = new RecordingD1();
  const listing = vacancy(1);
  const crossPost = {
    ...vacancy(1),
    source: "rss:dou-qa",
    externalId: "dou-1",
    url: "https://jobs.dou.ua/companies/studio-1/vacancies/1/",
    applyUrl: "https://jobs.dou.ua/companies/studio-1/vacancies/1/",
    description: `${listing.description}\n- Maintain regression coverage across releases.`,
  };

  // Two separate calls, so the merge target is a stored row rather than an
  // in-batch sibling — the ordering the batch must preserve.
  await upsertVacancies([listing], db);
  const second = await upsertVacancies([crossPost], db);

  assert.equal(second.inserted, 0);
  assert.equal(second.updated, 1);
  assert.equal(db.jobs.length, 1);
  assert.match(String(db.jobs[0]!.description), /Maintain regression coverage/);
});

test("the duplicate index finds exactly what a full scan finds", () => {
  const jobs = [
    vacancy(1),
    { ...vacancy(2), company: "Studio 1" },
    { ...vacancy(3), url: vacancy(1).url, applyUrl: vacancy(1).url, company: "Different Co" },
    { ...vacancy(1), source: "rss:dou-qa", externalId: "dou-1", url: "https://jobs.dou.ua/companies/s/vacancies/1/" },
    { ...vacancy(4), company: "" },
    { ...vacancy(5), company: "Unknown" },
  ];

  const index = new VacancyDuplicateIndex();
  jobs.forEach((job, position) => index.register(position, job));

  for (const probe of jobs) {
    assert.equal(
      index.findDuplicateIndex(jobs, probe),
      jobs.findIndex((candidate) => areDuplicateVacancies(candidate, probe)),
      `blocked lookup must agree with the full scan for ${probe.title}`,
    );
  }
});

test("deduplication still merges a cross-source copy after the index rewrite", () => {
  const listing = vacancy(7);
  const crossPost = {
    ...listing,
    source: "rss:dou-qa",
    externalId: "dou-7",
    url: "https://jobs.dou.ua/companies/studio-7/vacancies/7/",
    applyUrl: "https://jobs.dou.ua/companies/studio-7/vacancies/7/",
  };

  const result = deduplicateVacancies([listing, crossPost, vacancy(8)]);
  assert.equal(result.jobs.length, 2);
  assert.equal(result.duplicateCount, 1);
  assert.match(result.jobs[0]!.source, /djinni/);
  assert.match(result.jobs[0]!.source, /dou/);
});

test("the index agrees with a full scan across a randomized catalogue", () => {
  // Merges move records between buckets, so equivalence is asserted against a
  // naive re-implementation rather than against hand-picked shapes.
  let seed = 20260920;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const companies = ["Studio One", "Studio One LLC", "Northstar", "Unknown", "", "Orbit Systems"];
  const titles = ["Senior QA Engineer", "QA Automation Engineer", "Middle QA Engineer", "SDET", "Test Engineer"];
  const urls = ["https://djinni.co/jobs/1/", "https://jobs.dou.ua/companies/a/vacancies/2/", "https://djinni.co/jobs/3/", ""];

  const jobs = Array.from({ length: 150 }, (_, index) => ({
    ...vacancy(index),
    company: companies[Math.floor(random() * companies.length)]!,
    title: titles[Math.floor(random() * titles.length)]!,
    url: urls[Math.floor(random() * urls.length)]!,
    postedAt: random() < 0.5 ? "2026-09-18T08:00:00.000Z" : "2026-08-01T08:00:00.000Z",
  }));

  const naive: typeof jobs = [];
  const indexed: typeof jobs = [];
  const index = new VacancyDuplicateIndex();

  for (const job of jobs) {
    const expected = naive.findIndex((candidate) => areDuplicateVacancies(candidate, job));
    const actual = index.findDuplicateIndex(indexed, job);
    assert.equal(actual, expected, `index disagreed at ${job.title} / ${job.company} / ${job.url}`);
    if (expected < 0) {
      naive.push(job);
      index.register(indexed.length, job);
      indexed.push(job);
    } else {
      naive[expected] = { ...naive[expected]!, company: job.company || naive[expected]!.company };
      indexed[expected] = naive[expected]!;
      index.register(expected, indexed[expected]!);
    }
  }

  assert.ok(naive.length < jobs.length, "the fixture must actually produce duplicates");
  assert.equal(indexed.length, naive.length);
});
