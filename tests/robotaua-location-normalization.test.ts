import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { normalizeUkrainianLocation } = await import("../agent/src/location.ts");
const { parseRobotaUaResponse } = await import("../agent/src/sources/robotaua.ts");

test("location canonicalizer converts legacy Russian Ukrainian-city labels only in location data", () => {
  assert.equal(normalizeUkrainianLocation("Киев"), "Київ");
  assert.equal(normalizeUkrainianLocation("Львов"), "Львів");
  assert.equal(normalizeUkrainianLocation("Харьков, удаленно"), "Харків, віддалено");
  assert.equal(normalizeUkrainianLocation("Київ"), "Київ");
  assert.equal(normalizeUkrainianLocation("Warszawa (Polska)"), "Warszawa (Polska)");
});

test("Robota.ua parser canonicalizes cityName before it reaches vacancy storage", () => {
  const jobs = parseRobotaUaResponse({
    documents: [
      {
        id: 11314908,
        notebookId: 16775048,
        name: "Junior QA Engineer",
        companyName: "Noctra Agency",
        cityName: "Киев",
        shortDescription: "Software QA testing for web and mobile products.",
      },
      {
        id: 11314832,
        notebookId: 853429,
        name: "Junior Manual QA Engineer",
        companyName: "Банк Львів",
        cityName: "Львов",
        shortDescription: "Manual software testing, API, SQL and regression testing.",
      },
      {
        id: 11314471,
        notebookId: 2038573,
        name: "QA Engineer (Mobile & Backend) Remote",
        companyName: "Opti",
        cityName: "Киев",
        shortDescription: "Mobile, backend and API testing with automation.",
      },
    ],
  });

  assert.deepEqual(jobs.map((job) => job.location), ["Київ", "Львів", "Київ"]);
  assert.equal((jobs[0]?.raw as { cityName?: string }).cityName, "Киев");
});
