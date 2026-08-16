import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { fetchJson, fetchText } = await import("../agent/src/sources/http.ts");
const { AshbySource, GreenhouseSource, LeverSource } = await import("../agent/src/sources/ats.ts");
const { RssJobSource } = await import("../agent/src/sources/rss.ts");
const { RobotaUaSource } = await import("../agent/src/sources/robotaua.ts");
const { WorkUaSource } = await import("../agent/src/sources/workua.ts");

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("HTTP helpers return payloads and surface non-2xx responses", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.endsWith("/text")) return new Response("vacancy body", { status: 200 });
    if (url.endsWith("/json")) return jsonResponse({ ok: true, count: 2 });
    return new Response("unavailable", { status: 503, statusText: "Service Unavailable" });
  }) as typeof fetch;

  try {
    assert.equal(await fetchText("https://example.com/text"), "vacancy body");
    assert.deepEqual(await fetchJson("https://example.com/json"), { ok: true, count: 2 });
    await assert.rejects(
      () => fetchText("https://example.com/fail"),
      /503 Service Unavailable from https:\/\/example\.com\/fail/,
    );
    await assert.rejects(
      () => fetchJson("https://example.com/fail-json"),
      /503 Service Unavailable from https:\/\/example\.com\/fail-json/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Greenhouse, Lever, and Ashby adapters normalize live-shaped API payloads", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);

    if (url.includes("boards-api.greenhouse.io")) {
      return jsonResponse({
        jobs: [{
          id: 101,
          title: "Senior QA Engineer",
          location: { name: "Kyiv / Remote" },
          content: "<p>Own API and Playwright automation.</p>",
          absolute_url: "https://company.example/jobs/101?utm_source=board",
          updated_at: "2026-08-15T10:00:00Z",
        }],
      });
    }

    if (url.includes("api.lever.co")) {
      return jsonResponse([{
        id: "lever-7",
        text: "QA Automation Engineer",
        categories: { location: "Ukraine" },
        descriptionPlain: "Build automated API tests.",
        hostedUrl: "https://jobs.example/lever-7?gclid=tracking",
        applyUrl: "https://jobs.example/lever-7/apply?utm_campaign=qa",
        workplaceType: "remote",
        salaryRange: "$3000-$4000",
        createdAt: "2026-08-14T09:00:00Z",
      }]);
    }

    if (url.includes("api.ashbyhq.com")) {
      return jsonResponse({
        jobs: [{
          id: "ashby-3",
          title: "Manual QA Engineer",
          location: "Kyiv",
          secondaryLocations: [{ location: "Lviv" }],
          descriptionPlain: "Test web and mobile applications.",
          jobUrl: "https://jobs.example/ashby-3#details",
          applyUrl: "https://jobs.example/ashby-3/apply",
          isRemote: false,
          compensation: "$2500-$3200",
          publishedAt: "2026-08-13T08:00:00Z",
        }],
      });
    }

    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as typeof fetch;

  try {
    const greenhouse = await new GreenhouseSource("Acme", "acme-board").collect();
    assert.equal(greenhouse.length, 1);
    assert.equal(greenhouse[0].source, "greenhouse:Acme");
    assert.equal(greenhouse[0].externalId, "101");
    assert.equal(greenhouse[0].title, "Senior QA Engineer");
    assert.equal(greenhouse[0].company, "Acme");
    assert.equal(greenhouse[0].location, "Kyiv / Remote");
    assert.equal(greenhouse[0].remote, true);
    assert.equal(greenhouse[0].url, "https://company.example/jobs/101");
    assert.equal(greenhouse[0].applyUrl, "https://company.example/jobs/101");
    assert.equal(greenhouse[0].postedAt, "2026-08-15T10:00:00.000Z");
    assert.match(greenhouse[0].description, /Playwright automation/);

    const lever = await new LeverSource("Beta", "beta-board").collect();
    assert.equal(lever.length, 1);
    assert.equal(lever[0].source, "lever:Beta");
    assert.equal(lever[0].externalId, "lever-7");
    assert.equal(lever[0].company, "Beta");
    assert.equal(lever[0].location, "Ukraine");
    assert.equal(lever[0].remote, true);
    assert.equal(lever[0].url, "https://jobs.example/lever-7");
    assert.equal(lever[0].applyUrl, "https://jobs.example/lever-7/apply");
    assert.equal(lever[0].salaryText, "$3000-$4000");
    assert.equal(lever[0].postedAt, "2026-08-14T09:00:00.000Z");

    const ashby = await new AshbySource("Gamma", "gamma-board").collect();
    assert.equal(ashby.length, 1);
    assert.equal(ashby[0].source, "ashby:Gamma");
    assert.equal(ashby[0].externalId, "ashby-3");
    assert.equal(ashby[0].company, "Gamma");
    assert.equal(ashby[0].location, "Kyiv, Lviv");
    assert.equal(ashby[0].remote, false);
    assert.equal(ashby[0].url, "https://jobs.example/ashby-3");
    assert.equal(ashby[0].applyUrl, "https://jobs.example/ashby-3/apply");
    assert.equal(ashby[0].salaryText, "$2500-$3200");
    assert.equal(ashby[0].postedAt, "2026-08-13T08:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RSS adapter follows DOU detail pages and keeps structured full descriptions", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const feedUrl = "https://jobs.dou.ua/vacancies/feeds/?category=QA";
  const detailUrl = "https://jobs.dou.ua/companies/acme/vacancies/123";
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url === feedUrl) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <rss><channel><item>
          <title>QA Engineer в Acme, Київ</title>
          <link>${detailUrl}?utm_source=feed</link>
          <description><![CDATA[<p>Short QA teaser.</p>]]></description>
          <pubDate>Sat, 15 Aug 2026 10:00:00 GMT</pubDate>
        </item></channel></rss>`, { status: 200 });
    }
    if (url === detailUrl) {
      return new Response(`<html><body><div class="vacancy-section">
        <h2>Requirements</h2>
        <ul><li>Strong API testing, SQL, Playwright, and CI/CD experience.</li><li>Ability to design maintainable automated regression coverage.</li></ul>
        <h2>Responsibilities</h2>
        <ul><li>Own test strategy, investigate defects, and maintain release quality across web services.</li></ul>
      </div></body></html>`, { status: 200 });
    }
    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as typeof fetch;

  try {
    const jobs = await new RssJobSource("dou-qa", feedUrl).collect();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].source, "rss:dou-qa");
    assert.equal(jobs[0].title, "QA Engineer");
    assert.equal(jobs[0].company, "Acme");
    assert.equal(jobs[0].location, "Київ");
    assert.equal(jobs[0].url, detailUrl);
    assert.equal(jobs[0].postedAt, "2026-08-15T10:00:00.000Z");
    assert.match(jobs[0].description, /Requirements/);
    assert.match(jobs[0].description, /Responsibilities/);
    assert.match(jobs[0].description, /Playwright/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Robota.ua adapter enriches search results from vacancy detail pages", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const detailUrl = "https://robota.ua/company99/vacancy777";
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.rabota.ua/vacancy/search?")) {
      return jsonResponse({
        total: 1,
        documents: [{
          id: 777,
          notebookId: 99,
          name: "Senior QA Engineer",
          companyName: "Acme Ukraine",
          cityName: "Kyiv",
          date: "2026-08-15T12:00:00Z",
          shortDescription: "Short QA teaser.",
          salaryFrom: 3000,
          salaryTo: 4000,
        }],
      });
    }
    if (url === detailUrl) {
      return new Response(`<html><head><script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        description: "<h2>Requirements</h2><ul><li>API, SQL, Playwright, and test automation experience.</li></ul><h2>Responsibilities</h2><ul><li>Build regression coverage and investigate production defects.</li></ul><h2>Benefits</h2><p>Remote work in Ukraine and a learning budget.</p>",
      })}</script></head><body></body></html>`, { status: 200 });
    }
    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as typeof fetch;

  try {
    const jobs = await new RobotaUaSource("qa", "QA Engineer").collect();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].source, "robotaua:qa");
    assert.equal(jobs[0].externalId, "777");
    assert.equal(jobs[0].company, "Acme Ukraine");
    assert.equal(jobs[0].location, "Kyiv");
    assert.equal(jobs[0].salaryText, "3000–4000");
    assert.equal(jobs[0].postedAt, "2026-08-15T12:00:00.000Z");
    assert.equal(jobs[0].url, detailUrl);
    assert.equal(jobs[0].remote, true);
    assert.match(jobs[0].description, /Requirements/);
    assert.match(jobs[0].description, /Remote work/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Work.ua adapter keeps a search result and upgrades it with the detail body", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const searchUrl = "https://www.work.ua/en/jobs/?search=QA%20Engineer";
  const detailUrl = "https://www.work.ua/en/jobs/8336058";
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url === searchUrl) {
      return new Response(`
        <div class="mb-lg"><h2 class="my-0"><a href="/en/jobs/8336058/">QA Engineer</a></h2></div>
        <div class="mt-sm"><div class="text-indent"><span class="strong-600">Ajax Systems</span><span class="">Kyiv</span></div></div>
        <p class="ellipsis ellipsis-line ellipsis-line-3 text-default-7 mb-0">Short web QA teaser.</p>
      `, { status: 200 });
    }
    if (url === detailUrl) {
      return new Response(`<html><body><div id="job-description">
        <h2>Requirements</h2><ul><li>Web and mobile testing, API validation, SQL, and test design.</li></ul>
        <h2>Responsibilities</h2><ul><li>Execute release testing and maintain regression suites for customer applications.</li></ul>
      </div></body></html>`, { status: 200 });
    }
    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as typeof fetch;

  try {
    const jobs = await new WorkUaSource("qa", "QA Engineer").collect();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].source, "workua:qa");
    assert.equal(jobs[0].title, "QA Engineer");
    assert.equal(jobs[0].company, "Ajax Systems");
    assert.equal(jobs[0].location, "Kyiv");
    assert.equal(jobs[0].url, detailUrl);
    assert.match(jobs[0].description, /Requirements/);
    assert.match(jobs[0].description, /release testing/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
