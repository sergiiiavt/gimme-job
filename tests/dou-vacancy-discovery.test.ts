import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();

const { RssJobSource, douListingQuery, parseDouCardDate, parseDouVacancyListing } = await import("../agent/src/sources/rss.ts");

/**
 * Real markup captured from https://jobs.dou.ua/vacancies/?category=QA.
 *
 * The previous hand-written fixture asserted `<span class="company">`, which
 * DOU has never emitted — the employer is an `<a class="company">`. The
 * invented fixture passed while production stored "Unknown" for every DOU
 * vacancy, so listing fixtures are now recorded from the live site.
 */
const LISTING_FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/sources/dou-listing.html", import.meta.url)),
  "utf8",
);

test("DOU listing parser reads the employer from the real card markup", () => {
  const jobs = parseDouVacancyListing(LISTING_FIXTURE, "rss:dou-qa");

  assert.ok(jobs.length >= 5, `expected several parsed cards, received ${jobs.length}`);
  assert.equal(jobs.every((job) => job.company && job.company !== "Unknown"), true);
  assert.equal(jobs[0].company, "United Tech");
  assert.equal(jobs[0].title, "Manual QA Engineer (Mobile)");
  assert.equal(jobs[0].location, "Київ, віддалено");
  assert.equal(jobs[0].remote, true);
  assert.equal((jobs[0].raw as { companySource?: string }).companySource, "listing-anchor");
});

test("DOU listing parser keeps a stable numeric identity for promoted cards", () => {
  const jobs = parseDouVacancyListing(LISTING_FIXTURE, "rss:dou-qa");

  // Promoted cards link with ?from=list_hot. Retaining it changed a vacancy's
  // identity the moment it stopped being promoted, inserting a duplicate row.
  assert.equal(jobs.every((job) => /^\d+$/.test(String(job.externalId))), true);
  assert.equal(jobs.every((job) => !job.url.includes("from=")), true);
  assert.equal(jobs[0].externalId, "362045");
  assert.equal(jobs[0].url, "https://jobs.dou.ua/companies/united-tech/vacancies/362045");
});

test("DOU listing parser reads the card's posted date", () => {
  const jobs = parseDouVacancyListing(LISTING_FIXTURE, "rss:dou-qa");

  assert.equal(jobs.every((job) => job.postedAt !== null), true);
  assert.equal(jobs[0].postedAt?.slice(0, 5), "2026-");
});

test("DOU card dates resolve the year the vacancy was actually posted", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  assert.equal(parseDouCardDate("17 серпня", now), "2026-08-17T00:00:00.000Z");
  assert.equal(parseDouCardDate("16 вересня", now), "2026-09-16T00:00:00.000Z");
  // A date well ahead of today belongs to the previous year, not the future.
  assert.equal(parseDouCardDate("20 грудня", now), "2025-12-20T00:00:00.000Z");
  assert.equal(parseDouCardDate("not a date", now), null);
});

test("the configured DOU URL decides which catalogue is collected", () => {
  assert.equal(douListingQuery("https://jobs.dou.ua/vacancies/?category=QA"), "category=QA");
  assert.equal(douListingQuery("https://jobs.dou.ua/vacancies/feeds/?search=QA"), "search=QA");
  assert.equal(douListingQuery("https://jobs.dou.ua/vacancies/?category=DevOps"), "category=DevOps");
  assert.equal(douListingQuery("https://djinni.co/jobs/rss/?primary_keyword=QA"), null);
});

test("DOU source follows xhr-load pagination and enriches every discovered vacancy", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const cards = parseDouVacancyListing(LISTING_FIXTURE, "rss:dou-qa");
  const firstPage = LISTING_FIXTURE;
  const secondCardId = String(cards[1].externalId);
  const detailCalls: string[] = [];
  const calls: Array<{ url: string; method: string }> = [];

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url === "https://jobs.dou.ua/vacancies/?category=QA") {
      return new Response(`<html><script>window.CSRF_TOKEN = "csrf-test-token";</script>${firstPage}</html>`, {
        status: 200,
        headers: { "set-cookie": "csrftoken=cookie-token; Path=/; Secure" },
      });
    }

    if (url === "https://jobs.dou.ua/vacancies/xhr-load/?category=QA") {
      assert.equal(method, "POST");
      assert.equal((init?.headers as Record<string, string>)?.["x-requested-with"], "XMLHttpRequest");
      return new Response(JSON.stringify({ html: "", last: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (/https:\/\/jobs\.dou\.ua\/companies\/.+\/vacancies\/\d+$/.test(url)) {
      detailCalls.push(url);
      return new Response(`<html><body><div class="vacancy-section"><h2>Requirements</h2><p>${"Software QA and automation experience across web and API layers. ".repeat(4)}</p><h2>Responsibilities</h2><p>Maintain regression coverage and investigate defects.</p></div></body></html>`, { status: 200 });
    }

    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as typeof fetch;

  try {
    const jobs = await new RssJobSource("dou-qa", "https://jobs.dou.ua/vacancies/?category=QA").collect();

    assert.equal(jobs.length, cards.length);
    // Every vacancy is enriched, not an arbitrary prefix: a capped pass left the
    // rest of the catalogue on a listing teaser permanently.
    assert.equal(detailCalls.length, cards.length);
    assert.equal(jobs.every((job) => job.description.length > 200), true);
    assert.equal(jobs.every((job) => job.company !== "Unknown"), true);
    assert.equal(jobs.find((job) => job.externalId === secondCardId)?.company, cards[1].company);
    assert.equal(calls.filter((call) => call.url.includes("xhr-load")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
