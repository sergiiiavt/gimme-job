import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { collectAllSources } = await import("../agent/src/sources/types.ts");

test("source intake recovers a missing company before relevance and persistence", async () => {
  const source = {
    name: "rss:test",
    async collect() {
      return [{
        source: "rss:test",
        externalId: "vacancy-1",
        title: "QA Engineer",
        company: "Unknown",
        location: "Kyiv",
        remote: false,
        url: "https://invalid.example/jobs/1",
        applyUrl: "https://invalid.example/jobs/1",
        description: "Occam Industries is a European defence technology company.\nRequirements\n- API testing\n- regression testing",
        salaryText: null,
        postedAt: null,
        contactEmail: null,
      }];
    },
  };

  const results = await collectAllSources([source]);
  const intake = results.find((result) => result.source === "intake");
  assert.ok(intake);
  assert.equal(intake.jobs.length, 1);
  assert.equal(intake.jobs[0].company, "Occam Industries");
});

test("source intake preserves a native company instead of re-inferring it", async () => {
  const source = {
    name: "robotaua:test",
    async collect() {
      return [{
        source: "robotaua:test",
        externalId: "vacancy-2",
        title: "Senior QA Engineer",
        company: "Ajax Systems",
        location: "Kyiv",
        remote: false,
        url: "https://invalid.example/jobs/2",
        applyUrl: "https://invalid.example/jobs/2",
        description: "Another Company — this text must not replace the API company.\nSoftware testing and API automation.",
        salaryText: null,
        postedAt: null,
        contactEmail: null,
      }];
    },
  };

  const results = await collectAllSources([source]);
  const intake = results.find((result) => result.source === "intake");
  assert.ok(intake);
  assert.equal(intake.jobs[0].company, "Ajax Systems");
});
