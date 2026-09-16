import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();

const { DjinniListingSource, parseDjinniListing } = await import("../agent/src/sources/djinni.ts");

/**
 * Real `schema.org/JobPosting` metadata captured from
 * https://djinni.co/jobs/?primary_keyword=QA.
 *
 * Djinni's RSS feed publishes neither company nor location, so the previous RSS
 * adapter resolved roughly one employer in a hundred. The listing page carries
 * the complete record for fifteen vacancies at a time.
 */
const LISTING_FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/sources/djinni-listing.html", import.meta.url)),
  "utf8",
);

test("Djinni listing parser reads employer, body and dates from JobPosting metadata", () => {
  const jobs = parseDjinniListing(LISTING_FIXTURE, "djinni:djinni-qa");

  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs.map((job) => job.company), [
    "Mind Studios",
    "Digis (a Fiverr company)",
    "Dynamica Labs",
  ]);
  assert.equal(jobs.every((job) => job.postedAt !== null), true);
  assert.equal(jobs.every((job) => job.description.length > 600), true);
  assert.equal(jobs.every((job) => job.location !== "Unknown"), true);
  assert.equal(jobs.every((job) => /^\d+$/.test(String(job.externalId))), true);
  assert.equal((jobs[0].raw as { companySource?: string }).companySource, "jsonld");
});

test("Djinni listing parser distinguishes remote from on-site postings", () => {
  const jobs = parseDjinniListing(LISTING_FIXTURE, "djinni:djinni-qa");
  const warsaw = jobs.find((job) => job.title.includes("Warsaw"));

  assert.ok(warsaw);
  assert.equal(warsaw.remote, false);
  assert.equal(warsaw.location, "Польща");
  assert.equal(jobs[0].remote, true);
});

test("Djinni listing parser keeps the vacancy's expiry date for lifecycle use", () => {
  const jobs = parseDjinniListing(LISTING_FIXTURE, "djinni:djinni-qa");
  const raw = jobs[0].raw as { validThrough?: string | null };

  assert.ok(raw.validThrough);
  assert.equal(Number.isNaN(Date.parse(raw.validThrough)), false);
});

test("Djinni listing parser ignores malformed metadata instead of failing the source", () => {
  const jobs = parseDjinniListing(
    `<script type="application/ld+json">{ not json </script>${LISTING_FIXTURE}`,
    "djinni:djinni-qa",
  );

  assert.equal(jobs.length, 3);
});

test("Djinni source stops when a page repeats vacancies it already collected", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];

  globalThis.fetch = (async (input) => {
    const url = String(input);
    requested.push(url);
    // Djinni serves the first page again for an out-of-range page number.
    return new Response(LISTING_FIXTURE, { status: 200 });
  }) as typeof fetch;

  try {
    const jobs = await new DjinniListingSource("djinni-qa", "QA").collect();

    assert.equal(jobs.length, 3);
    assert.equal(requested.length, 2);
    assert.equal(requested[0], "https://djinni.co/jobs/?primary_keyword=QA");
    assert.equal(requested[1], "https://djinni.co/jobs/?primary_keyword=QA&page=2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
