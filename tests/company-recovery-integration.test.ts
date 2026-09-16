import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { collectAllSources } = await import("../agent/src/sources/types.ts");

function source(name: string, job: Record<string, unknown>) {
  return {
    name,
    async collect() {
      return [{
        source: name,
        externalId: "vacancy-1",
        location: "Kyiv",
        remote: false,
        salaryText: null,
        postedAt: null,
        contactEmail: null,
        ...job,
      }];
    },
  };
}

async function intakeOf(collected: ReturnType<typeof source>) {
  const results = await collectAllSources([collected]);
  const intake = results.find((result) => result.source === "intake");
  assert.ok(intake);
  return intake;
}

test("source intake leaves an unresolvable company unknown instead of inventing one", async () => {
  // Description prose used to be mined for company names, which produced values
  // such as "- Hands", "We provides e" and "The project is a large". An invented
  // name is indistinguishable from collected data and breaks deduplication,
  // which keys on the company, so an unresolvable employer stays "Unknown".
  const intake = await intakeOf(source("rss:test", {
    title: "QA Engineer",
    company: "Unknown",
    url: "https://invalid.example/jobs/1",
    applyUrl: "https://invalid.example/jobs/1",
    description: "Occam Industries is a European defence technology company.\nRequirements\n- API testing\n- regression testing",
  }));

  assert.equal(intake.jobs.length, 1);
  assert.equal(intake.jobs[0].company, "Unknown");
});

test("source intake still recovers a company the title states structurally", async () => {
  const intake = await intakeOf(source("rss:test", {
    title: "QA Engineer at Ajax Systems",
    company: "Unknown",
    url: "https://invalid.example/jobs/3",
    applyUrl: "https://invalid.example/jobs/3",
    description: "Software testing and API automation for a web application.",
  }));

  assert.equal(intake.jobs[0].company, "Ajax Systems");
});

test("source intake preserves a native company instead of re-inferring it", async () => {
  const intake = await intakeOf(source("robotaua:test", {
    title: "Senior QA Engineer",
    company: "Ajax Systems",
    url: "https://invalid.example/jobs/2",
    applyUrl: "https://invalid.example/jobs/2",
    description: "Another Company — this text must not replace the API company.\nSoftware testing and API automation.",
  }));

  assert.equal(intake.jobs[0].company, "Ajax Systems");
});
