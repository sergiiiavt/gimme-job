import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const {
  buildVacancySources,
  ensureVacancyCatalog,
  mergeVacancySourceDefaults,
  publicHttpsUrl,
  publicVacancies,
  sanitizeDashboardPayload,
  skippedCloudSources,
  syncVacancySources,
  upsertVacancies,
} = await import("../app/api/_vacancy-intake.ts");

class FakeD1 {
  jobs: Record<string, unknown>[] = [];
  sourceSetting: Record<string, unknown> | null = null;

  prepare(query: string) {
    const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();
    const execute = (values: unknown[]) => ({
      first: async <T>() => {
        if (normalized.includes("select value_json from settings")) return this.sourceSetting as T | null;
        if (normalized.includes("select count(*) as count from jobs")) return { count: this.jobs.length } as T;
        return null;
      },
      all: async <T>() => {
        if (normalized.includes("from jobs")) return { results: [...this.jobs] as T[] };
        return { results: [] as T[] };
      },
      run: async () => {
        if (normalized.startsWith("update jobs set")) {
          const id = String(values[14]);
          const row = this.jobs.find((entry) => entry.id === id);
          assert.ok(row, `FakeD1 update target ${id} must exist`);
          Object.assign(row, {
            source: values[0], external_id: values[1] ?? row.external_id, title: values[2], company: values[3],
            location: values[4], remote: values[5], url: values[6], apply_url: values[7], description: values[8],
            salary_text: values[9] ?? row.salary_text, posted_at: values[10] ?? row.posted_at,
            contact_email: values[11] ?? row.contact_email, updated_at: values[12], raw_json: values[13],
          });
        } else if (normalized.startsWith("insert into jobs")) {
          const [id, fingerprint, source, externalId, title, company, location, remote, url, applyUrl, description,
            salaryText, postedAt, contactEmail, discoveredAt, updatedAt, rawJson] = values;
          const existing = this.jobs.find((entry) => entry.fingerprint === fingerprint);
          if (existing) {
            Object.assign(existing, {
              source, external_id: externalId ?? existing.external_id, title, company, location, remote, url,
              apply_url: applyUrl, description: String(description).length > String(existing.description ?? "").length ? description : existing.description,
              salary_text: salaryText ?? existing.salary_text, posted_at: postedAt ?? existing.posted_at,
              contact_email: contactEmail ?? existing.contact_email, updated_at: updatedAt, raw_json: rawJson,
            });
          } else {
            this.jobs.push({
              id, fingerprint, source, external_id: externalId, title, company, location, remote, url,
              apply_url: applyUrl, description, salary_text: salaryText, posted_at: postedAt,
              contact_email: contactEmail, discovered_at: discoveredAt, updated_at: updatedAt,
              status: "NEW", raw_json: rawJson,
            });
          }
        }
        return {};
      },
    });

    return {
      bind: (...values: unknown[]) => execute(values),
      first: async <T>() => execute([]).first<T>(),
      all: async <T>() => execute([]).all<T>(),
    };
  }
}

function vacancy(overrides: Record<string, unknown> = {}) {
  return {
    source: "rss:dou-qa",
    externalId: "dou-1",
    title: "Senior QA Engineer",
    company: "Example Tech LLC",
    location: "Kyiv",
    remote: false,
    url: "https://jobs.dou.ua/companies/example/vacancies/1",
    applyUrl: "https://jobs.dou.ua/companies/example/vacancies/1",
    description: "Requirements\n- API testing\n- SQL\n- Playwright\n\nResponsibilities\n- Test a web application and REST services.",
    salaryText: null,
    postedAt: "2026-08-16T08:00:00.000Z",
    contactEmail: null,
    raw: {},
    ...overrides,
  };
}

test("publicHttpsUrl permits public HTTPS and blocks local/private sources", () => {
  assert.equal(publicHttpsUrl("https://jobs.dou.ua/vacancies/feeds/?search=QA"), "https://jobs.dou.ua/vacancies/feeds/?search=QA");
  assert.throws(() => publicHttpsUrl("http://jobs.dou.ua/feed"), /public HTTPS/);
  assert.throws(() => publicHttpsUrl("https://localhost/feed"), /public HTTPS/);
  assert.throws(() => publicHttpsUrl("https://127.0.0.1/feed"), /public HTTPS/);
  assert.throws(() => publicHttpsUrl("https://192.168.1.4/feed"), /public HTTPS/);
});

test("buildVacancySources constructs cloud-safe configured sources and excludes direct Work.ua HTML", () => {
  const config = {
    rss: [{ name: "dou", url: "https://jobs.dou.ua/vacancies/feeds/?search=QA" }],
    greenhouse: [{ name: "Acme", board: "acme" }],
    lever: [{ name: "LeverCo", board: "leverco" }],
    ashby: [{ name: "AshbyCo", board: "ashbyco" }],
    workUa: [{ name: "work", query: "QA Engineer" }],
    robotaUa: [{ name: "robota", query: "QA Engineer" }],
    lobbyX: [{ name: "lobby", query: "QA Engineer" }],
  };
  const sources = buildVacancySources(config);
  assert.deepEqual(sources.map((source) => source.name), [
    "rss:dou", "greenhouse:Acme", "lever:LeverCo", "ashby:AshbyCo", "robotaua:robota", "lobbyx:lobby",
  ]);
  assert.deepEqual(skippedCloudSources(config), [{
    source: "workua:work",
    reason: "Direct Work.ua HTML access is blocked from cloud-hosted runners (HTTP 403); the adapter remains available for local sync only.",
  }]);
});

test("upsertVacancies rejects noise, inserts QA, then merges a cross-source duplicate", async () => {
  const db = new FakeD1();
  const first = await upsertVacancies([
    vacancy(),
    vacancy({
      source: "workua:noise",
      externalId: "noise-1",
      title: "Тестувальник косметики",
      company: "Beauty Lab",
      url: "https://www.work.ua/jobs/999",
      applyUrl: "https://www.work.ua/jobs/999",
      description: "Перевірка косметичних продуктів та ароматів.",
    }),
  ], db);

  assert.equal(first.seen, 2);
  assert.equal(first.relevant, 1);
  assert.equal(first.rejected, 1);
  assert.equal(first.inserted, 1);
  assert.equal(db.jobs.length, 1);
  assert.match(String(db.jobs[0].fingerprint), /^[a-f0-9]{64}$/);

  const second = await upsertVacancies([
    vacancy({
      source: "workua:qa",
      externalId: "work-123",
      company: "Example Tech",
      url: "https://www.work.ua/jobs/123",
      applyUrl: "https://www.work.ua/jobs/123",
      description: "Requirements\n- API testing\n- SQL\n- Playwright\n\nResponsibilities\n- Test a web application and REST services.\n- Maintain regression coverage.",
    }),
  ], db);

  assert.equal(second.inserted, 0);
  assert.equal(second.updated, 1);
  assert.equal(db.jobs.length, 1);
  assert.match(String(db.jobs[0].source), /dou/);
  assert.match(String(db.jobs[0].source), /workua/);
  assert.match(String(db.jobs[0].description), /Maintain regression coverage/);
});

test("sanitizeDashboardPayload filters legacy noise and merges duplicate cards without dropping incomplete compatibility stubs", () => {
  const result = sanitizeDashboardPayload({ jobs: [
    { ...vacancy(), id: "a" },
    { ...vacancy({ source: "workua:qa", company: "Example Tech", url: "https://www.work.ua/jobs/123", applyUrl: "https://www.work.ua/jobs/123" }), id: "b" },
    { ...vacancy({ title: "Тестувальник косметики", company: "Beauty", description: "Косметика та аромати", url: "https://example.com/noise", applyUrl: "https://example.com/noise" }), id: "noise" },
    { id: "compatibility-stub" },
  ] });

  assert.equal(result.jobs.length, 2);
  const full = result.jobs.find((job) => (job as { title?: string }).title);
  assert.ok(full);
  assert.match(String((full as { source: string }).source), /DOU/);
  assert.ok(result.jobs.some((job) => (job as { id?: string }).id === "compatibility-stub"));
});

test("publicVacancies returns sanitized stored rows", async () => {
  const db = new FakeD1();
  await upsertVacancies([vacancy()], db);
  const result = await publicVacancies(db);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].source, "DOU");
  assert.equal(result.jobs[0].title, "Senior QA Engineer");
  assert.ok(result.generatedAt);
});

test("empty configured source lists make production sync deterministic without external fetches", async () => {
  const db = new FakeD1();
  db.sourceSetting = { value_json: JSON.stringify({ rss: [], greenhouse: [], lever: [], ashby: [], workUa: [], robotaUa: [], lobbyX: [] }) };
  const result = await syncVacancySources(db);
  assert.deepEqual(result, { seen: 0, relevant: 0, rejected: 0, duplicates: 0, inserted: 0, updated: 0, accepted: 0, errors: [], skipped: [] });
});

test("configured Work.ua is reported as skipped rather than failing cloud sync", async () => {
  const db = new FakeD1();
  db.sourceSetting = { value_json: JSON.stringify({ rss: [], greenhouse: [], lever: [], ashby: [], workUa: [{ name: "work", query: "QA" }], robotaUa: [], lobbyX: [] }) };
  const result = await syncVacancySources(db);
  assert.equal(result.errors.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].source, "workua:work");
  assert.match(result.skipped[0].reason, /HTTP 403/);
});

test("ensureVacancyCatalog does not resync a non-empty catalog", async () => {
  const db = new FakeD1();
  db.jobs.push({ id: "existing" });
  await ensureVacancyCatalog(db);
  assert.equal(db.jobs.length, 1);
});

test("mergeVacancySourceDefaults adds Robota.ua without overwriting configured arrays", () => {
  const result = mergeVacancySourceDefaults({ sources: { workUa: [{ name: "custom", query: "SDET" }] } }) as {
    sources: { workUa: unknown[]; robotaUa: Array<{ name: string; query: string }> };
  };
  assert.deepEqual(result.sources.workUa, [{ name: "custom", query: "SDET" }]);
  assert.deepEqual(result.sources.robotaUa, [{ name: "robotaua-qa", query: "QA Engineer" }]);
});
