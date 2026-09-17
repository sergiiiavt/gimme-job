import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { handleVacancySync } = await import("../app/api/_vacancy-sync-route.ts");
const { buildVacancySources } = await import("../app/api/_vacancy-intake.ts");
const { RssJobSource } = await import("../agent/src/sources/rss.ts");

const openTenant = { multiUser: false, authenticated: false, userId: null };

test("a sync whose sources all failed is reported as a failure, with the reasons", async () => {
  const failure = Object.assign(new Error("Vacancy sync collected nothing. rss:dou-qa: 403 Forbidden"), {
    name: "VacancySyncFailure",
  });
  const response = await handleVacancySync(
    new Request("https://example.com/api/sync", { method: "POST" }),
    openTenant,
    async () => { throw failure; },
    async () => ({ jobs: [] }),
  );

  assert.equal(response.status, 502);
  const payload = await response.json() as { ok: boolean; error: string };
  assert.equal(payload.ok, false);
  assert.match(payload.error, /Vacancy sync collected nothing/);
  assert.match(payload.error, /403 Forbidden/);
});

test("a healthy sync still reports success with its dashboard", async () => {
  const response = await handleVacancySync(
    new Request("https://example.com/api/sync", { method: "POST" }),
    openTenant,
    async () => ({ accepted: 3, errors: [] }),
    async () => ({ jobs: [{ id: "job_1" }] }),
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as { ok: boolean; result: { accepted: number } };
  assert.equal(payload.ok, true);
  assert.equal(payload.result.accepted, 3);
});

test("multi-user authentication is still enforced before any collection runs", async () => {
  let collected = false;
  const response = await handleVacancySync(
    new Request("https://example.com/api/sync", { method: "POST" }),
    { multiUser: true, authenticated: false, userId: null },
    async () => { collected = true; return {}; },
    async () => ({}),
  );

  assert.equal(response.status, 401);
  assert.equal(collected, false);
});

test("Worker DOU sync spends no subrequests on details while the Node runner can enrich all", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const total = 65;
  const card = (id: number) => `<li class="l-vacancy"><div class="date">16 вересня</div><div class="title">`
    + `<a class="vt" href="https://jobs.dou.ua/companies/acme/vacancies/${id}/">QA Engineer ${id}</a>`
    + `<strong>в&nbsp;<a class="company" href="https://jobs.dou.ua/companies/acme/vacancies/">Acme</a></strong>`
    + `<span class="cities">Київ</span></div><div class="sh-info">Teaser.</div></li>`;
  const listing = Array.from({ length: total }, (_, index) => card(1000 + index)).join("");
  let detailRequests = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://jobs.dou.ua/vacancies/?category=QA") {
      return new Response(`<html><script>window.CSRF_TOKEN = "t";</script><ul>${listing}</ul></html>`, { status: 200 });
    }
    if (url.includes("xhr-load")) {
      return new Response(JSON.stringify({ html: "", last: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    detailRequests += 1;
    return new Response('<html><body><div class="vacancy-section"><p>Full body.</p></div></body></html>', { status: 200 });
  }) as typeof fetch;

  try {
    const [workerSource] = buildVacancySources({
      rss: [{ name: "dou-qa", url: "https://jobs.dou.ua/vacancies/?category=QA" }],
      djinni: [],
      greenhouse: [],
      lever: [],
      ashby: [],
      workUa: [],
      robotaUa: [],
      lobbyX: [],
    });
    assert.ok(workerSource);
    const jobs = await workerSource.collect();
    assert.equal(jobs.length, total);
    assert.equal(detailRequests, 0);

    detailRequests = 0;
    const all = await new RssJobSource("dou-qa", "https://jobs.dou.ua/vacancies/?category=QA", {
      detailBudget: Number.POSITIVE_INFINITY,
    }).collect();
    assert.equal(all.length, total);
    assert.equal(detailRequests, total);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
