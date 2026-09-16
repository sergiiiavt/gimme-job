import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();

const { parseRobotaUaResponse, RobotaUaSource } = await import("../agent/src/sources/robotaua.ts");
const { classifyJobRelevance, hasCompleteDescription } = await import("../agent/src/job-intake.ts");

/**
 * Real response captured from api.rabota.ua/vacancy/search.
 *
 * The search API publishes no `description` field at all, and truncates
 * `shortDescription` at 251 characters. The detail page that would carry the
 * full body sits behind a Cloudflare managed challenge and answers HTTP 403.
 */
const SEARCH_FIXTURE = JSON.parse(readFileSync(
  fileURLToPath(new URL("./fixtures/sources/robotaua-search.json", import.meta.url)),
  "utf8",
));

test("Robota.ua vacancies are marked as carrying an incomplete description", () => {
  const jobs = parseRobotaUaResponse(SEARCH_FIXTURE, "robotaua-qa");

  assert.ok(jobs.length > 0);
  assert.equal(jobs.every((job) => job.company && job.company !== "Unknown"), true);
  assert.equal(jobs.every((job) => job.description.length <= 260), true);
  assert.equal(jobs.every((job) => hasCompleteDescription(job) === false), true);
});

test("Robota.ua sync does not request detail pages that always answer 403", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];

  globalThis.fetch = (async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.startsWith("https://api.rabota.ua/vacancy/search")) {
      return new Response(JSON.stringify({ ...SEARCH_FIXTURE, total: SEARCH_FIXTURE.documents.length }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unexpected request to ${url}`);
  }) as typeof fetch;

  try {
    const jobs = await new RobotaUaSource("robotaua-qa", "QA Engineer").collect();

    assert.equal(jobs.length, SEARCH_FIXTURE.documents.length);
    assert.equal(requested.every((url) => url.startsWith("https://api.rabota.ua/vacancy/search")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a teaser-only vacancy is held for review rather than silently rejected", () => {
  // "Тестувальник QA (CRM Siebel)" is a genuine software-QA role. With only a
  // 251-character teaser there is no software context to match, which rejected
  // 19% of the source outright.
  const teaser = {
    title: "Тестувальник QA (CRM Siebel)",
    company: "Example Bank",
    location: "Київ",
    description: "Запрошуємо до команди фахівця у відділ супроводу.",
    raw: { descriptionComplete: false },
  };

  const pending = classifyJobRelevance(teaser);
  assert.equal(pending.accepted, true);
  assert.equal(pending.reason, "generic_test_role_pending_context");

  // A complete description with no software signal is still a real rejection.
  const complete = classifyJobRelevance({ ...teaser, raw: {} });
  assert.equal(complete.accepted, false);
  assert.equal(complete.reason, "generic_test_role_without_software_context");
});

test("an incomplete description never rescues a non-software testing role", () => {
  const decision = classifyJobRelevance({
    title: "Тестувальник косметики",
    company: "Beauty Lab",
    location: "Київ",
    description: "Лабораторія косметики.",
    raw: { descriptionComplete: false },
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, "non_software_testing_role");
});
