import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { handleVacancySync } = await import("../app/api/_vacancy-sync-route.ts");
const { RssJobSource, DEFAULT_DETAIL_BUDGET } = await import("../agent/src/sources/rss.ts");

const openTenant = { multiUser: false, authenticated: false, userId: null };

test("a sync whose sources all failed is reported as a failure, with the reasons", async () => {
  // Every source failing collects nothing and writes nothing. Reporting that as
  // success told the operator the catalogue was refreshed while the real
  // per-source errors went unread — Djinni silently stopped updating for weeks.
  const failure = Object.assign(new Error("Every vacancy source failed, so nothing was collected. rss:dou-qa: 403 Forbidden"), {
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
  assert.match(payload.error, /Every vacancy source failed/);
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

test("the Worker-hosted sync keeps a bounded detail budget", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const card = (id: number) => `<li class="l-vacancy"><div class="date">16 вересня</div><div class="title">`
    + `<a class="vt" href="https://jobs.dou.ua/companies/acme/vacancies/${id}/">QA Engineer ${id}</a>`
    + `<strong>в&nbsp;<a class="company" href="https://jobs.dou.ua/companies/acme/vacancies/">Acme</a></strong>`
    + `<span class="cities">Київ</span></div><div class="sh-info">Teaser.</div></li>`;
  const listing = Array.from({ length: DEFAULT_DETAIL_BUDGET + 25 }, (_, index) => card(1000 + index)).join("");
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
    // The default is what a Cloudflare Worker invocation uses; exceeding it is
    // what made every source fail inside one request.
    const jobs = await new RssJobSource("dou-qa", "https://jobs.dou.ua/vacancies/?category=QA").collect();
    assert.equal(jobs.length, DEFAULT_DETAIL_BUDGET + 25);
    assert.equal(detailRequests, DEFAULT_DETAIL_BUDGET);

    detailRequests = 0;
    const all = await new RssJobSource("dou-qa", "https://jobs.dou.ua/vacancies/?category=QA", {
      detailBudget: Number.POSITIVE_INFINITY,
    }).collect();
    assert.equal(all.length, DEFAULT_DETAIL_BUDGET + 25);
    assert.equal(detailRequests, DEFAULT_DETAIL_BUDGET + 25);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
