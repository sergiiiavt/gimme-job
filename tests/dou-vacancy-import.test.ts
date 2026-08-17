import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDouImportJobs } from "../app/api/_dou-vacancy-import.ts";

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

test("DOU import forces canonical source, URL and vacancy ID", () => {
  const jobs = normalizeDouImportJobs({
    mode: "dou-import",
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

test("DOU import rejects non-DOU or non-vacancy URLs", () => {
  assert.throws(
    () => normalizeDouImportJobs({ mode: "dou-import", jobs: [{ ...vacancy(1, "Example", "QA"), url: "https://example.com/vacancies/1" }] }),
    /not a DOU vacancy URL/,
  );
  assert.throws(
    () => normalizeDouImportJobs({ mode: "dou-import", jobs: [{ ...vacancy(1, "Example", "QA"), url: "https://jobs.dou.ua/vacancies/" }] }),
    /not a DOU vacancy URL/,
  );
});
