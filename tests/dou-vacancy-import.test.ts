import test from "node:test";
import assert from "node:assert/strict";
import {
  handleDouVacancyImport,
  normalizeDouImportJobs,
} from "../app/api/_dou-vacancy-import.ts";

function vacancy(id: number, company: string, title: string) {
  return {
    source: "untrusted-source",
    externalId: "wrong-id",
    title,
    company,
    location: "Київ",
    remote: false,
    url: `https://jobs.dou.ua/companies/${company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/vacancies/${id}/?utm_source=test#apply`,
    applyUrl: "https://example.com/not-trusted",
    description: "Software QA and automation testing responsibilities.",
  };
}

function importRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://gimmejob.example/internal/n8n/vacancies-sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gimmejob-mode": "dou-import",
      ...headers,
    },
    body,
  });
}

test("DOU import forces canonical source, URL and vacancy ID", () => {
  const jobs = normalizeDouImportJobs({
    jobs: [
      vacancy(368919, "Twist Robotics", "AQA Engineer"),
      vacancy(368979, "Airlogix", "QA Automation Engineer (.Net) / Kyiv"),
      vacancy(364050, "Eleven", "AQA/Manual (офіс, Київ)"),
    ],
  });

  assert.deepEqual(jobs.map((job) => job.externalId), ["368919", "368979", "364050"]);
  assert.equal(jobs.every((job) => job.source === "rss:dou-qa"), true);
  assert.equal(jobs.every((job) => String(job.url).startsWith("https://jobs.dou.ua/companies/")), true);
  assert.equal(jobs.every((job) => !String(job.url).includes("utm_") && !String(job.url).includes("#")), true);
  assert.deepEqual(jobs.map((job) => job.applyUrl), jobs.map((job) => job.url));
});

test("DOU import rejects invalid payloads and non-DOU URLs", () => {
  assert.throws(() => normalizeDouImportJobs(null), /JSON object/);
  assert.throws(() => normalizeDouImportJobs({}), /jobs must be an array/);
  assert.throws(() => normalizeDouImportJobs({ jobs: [null] }), /must be an object/);
  assert.throws(
    () => normalizeDouImportJobs({ jobs: [{ ...vacancy(1, "Example", "QA"), url: "not-a-url" }] }),
    /invalid URL/,
  );
  assert.throws(
    () => normalizeDouImportJobs({ jobs: [{ ...vacancy(1, "Example", "QA"), url: "https://example.com/vacancies/1" }] }),
    /not a DOU vacancy URL/,
  );
  assert.throws(
    () => normalizeDouImportJobs({ jobs: [{ ...vacancy(1, "Example", "QA"), url: "https://jobs.dou.ua/vacancies/" }] }),
    /not a DOU vacancy URL/,
  );
  assert.throws(
    () => normalizeDouImportJobs({ jobs: Array.from({ length: 501 }, () => vacancy(1, "Example", "QA")) }),
    /at most 500/,
  );
});

test("DOU import handler ignores ordinary vacancy sync requests", async () => {
  let calls = 0;
  const request = new Request("https://gimmejob.example/internal/n8n/vacancies-sync", { method: "POST" });
  const response = await handleDouVacancyImport(request, async () => {
    calls += 1;
    return { relevant: 0, rejected: 0, inserted: 0, updated: 0 };
  });

  assert.equal(response, null);
  assert.equal(calls, 0);
});

test("DOU import handler normalizes and upserts runner vacancies", async () => {
  let received: unknown[] = [];
  const request = importRequest(JSON.stringify({
    jobs: [vacancy(368919, "Twist Robotics", "AQA Engineer")],
  }));
  const response = await handleDouVacancyImport(request, async (jobs) => {
    received = jobs;
    return { relevant: 1, rejected: 0, inserted: 1, updated: 0 };
  });

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(received.length, 1);
  assert.equal((received[0] as Record<string, unknown>).externalId, "368919");
  assert.equal((received[0] as Record<string, unknown>).source, "rss:dou-qa");
  assert.deepEqual(await response.json(), {
    ok: true,
    result: { relevant: 1, rejected: 0, inserted: 1, updated: 0 },
  });
});

test("DOU import handler returns bounded validation errors", async () => {
  const invalidJson = await handleDouVacancyImport(
    importRequest("not-json"),
    async () => ({ relevant: 0, rejected: 0, inserted: 0, updated: 0 }),
  );
  assert.ok(invalidJson);
  assert.equal(invalidJson.status, 400);
  assert.deepEqual(await invalidJson.json(), { error: "Request body must be valid JSON." });

  const oversized = await handleDouVacancyImport(
    importRequest("{}", { "content-length": String(2 * 1024 * 1024 + 1) }),
    async () => ({ relevant: 0, rejected: 0, inserted: 0, updated: 0 }),
  );
  assert.ok(oversized);
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { error: "Request is too large." });

  const missingJobs = await handleDouVacancyImport(
    importRequest("{}"),
    async () => ({ relevant: 0, rejected: 0, inserted: 0, updated: 0 }),
  );
  assert.ok(missingJobs);
  assert.equal(missingJobs.status, 400);
  assert.deepEqual(await missingJobs.json(), { error: "jobs must be an array." });
});

test("DOU import handler hides storage failures", async () => {
  const request = importRequest(JSON.stringify({
    jobs: [vacancy(368979, "Airlogix", "QA Automation Engineer (.Net) / Kyiv")],
  }));
  const response = await handleDouVacancyImport(request, async () => {
    throw new Error("database connection string should not leak");
  });

  assert.ok(response);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "DOU vacancy import failed." });
});
