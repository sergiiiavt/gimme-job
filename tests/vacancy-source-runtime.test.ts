import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { fetchJson, fetchText } = await import("../agent/src/sources/http.ts");
const { AshbySource, GreenhouseSource, LeverSource } = await import("../agent/src/sources/ats.ts");

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
    assert.equal(greenhouse[0].location, "Kyiv / Remote");
    assert.equal(greenhouse[0].remote, true);
    assert.equal(greenhouse[0].url, "https://company.example/jobs/101");
    assert.match(greenhouse[0].description, /Playwright automation/);

    const lever = await new LeverSource("Beta", "beta-board").collect();
    assert.equal(lever.length, 1);
    assert.equal(lever[0].source, "lever:Beta");
    assert.equal(lever[0].externalId, "lever-7");
    assert.equal(lever[0].remote, true);
    assert.equal(lever[0].url, "https://jobs.example/lever-7");
    assert.equal(lever[0].applyUrl, "https://jobs.example/lever-7/apply");
    assert.equal(lever[0].salaryText, "$3000-$4000");

    const ashby = await new AshbySource("Gamma", "gamma-board").collect();
    assert.equal(ashby.length, 1);
    assert.equal(ashby[0].source, "ashby:Gamma");
    assert.equal(ashby[0].externalId, "ashby-3");
    assert.equal(ashby[0].location, "Kyiv, Lviv");
    assert.equal(ashby[0].url, "https://jobs.example/ashby-3");
    assert.equal(ashby[0].applyUrl, "https://jobs.example/ashby-3/apply");
    assert.equal(ashby[0].salaryText, "$2500-$3200");
    assert.equal(ashby[0].postedAt, "2026-08-13T08:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
