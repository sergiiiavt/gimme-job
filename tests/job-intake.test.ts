import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const {
  areDuplicateVacancies,
  classifyJobRelevance,
  deduplicateVacancies,
  filterRelevantVacancies,
} = await import("../agent/src/job-intake.ts");
const { parseRobotaUaResponse } = await import("../agent/src/sources/robotaua.ts");

function job(overrides: Record<string, unknown> = {}) {
  return {
    source: "rss:dou-qa",
    externalId: "1",
    title: "Senior QA Engineer",
    company: "Example LLC",
    location: "Kyiv",
    remote: false,
    url: "https://jobs.example/1",
    applyUrl: "https://jobs.example/1",
    description: "Web application testing, API testing, Jira, SQL and Playwright.",
    salaryText: null,
    postedAt: "2026-08-15T10:00:00.000Z",
    contactEmail: null,
    raw: {},
    ...overrides,
  };
}

test("relevance accepts explicit software QA roles", () => {
  assert.deepEqual(classifyJobRelevance(job()), {
    accepted: true,
    score: 100,
    reason: "explicit_software_qa_role",
  });
  assert.equal(classifyJobRelevance(job({ title: "AQA Engineer" })).accepted, true);
  assert.equal(classifyJobRelevance(job({ title: "SDET" })).accepted, true);
  assert.equal(classifyJobRelevance(job({ title: "Тестувальник ПЗ" })).accepted, true);
});

test("relevance keeps QA leadership and management roles", () => {
  const titles = [
    "QA Lead",
    "Lead QA",
    "QA Team Lead",
    "QA Manager",
    "Test Lead",
    "Test Manager",
    "Head of QA",
    "QA Head",
    "Head of Quality Assurance",
    "Head of Testing",
    "QA Director",
    "Director of QA",
    "Director of Quality Assurance",
    "Керівник відділу тестування",
    "Руководитель отдела тестирования",
  ];

  for (const title of titles) {
    const decision = classifyJobRelevance(job({ title }));
    assert.equal(decision.accepted, true, `${title} should be accepted`);
    assert.equal(decision.reason, "explicit_software_qa_role", `${title} should be explicit QA`);
  }
});

test("leadership wording does not override explicit non-software testing", () => {
  const decision = classifyJobRelevance(job({
    title: "Electronics Test Manager",
    description: "Manage laboratory hardware benches and electronics manufacturing validation.",
  }));
  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, "non_software_testing_role");
});

test("relevance rejects non-software tester noise", () => {
  const decision = classifyJobRelevance(job({
    title: "Тестувальник косметики",
    description: "Перевірка косметичних продуктів, ароматів та пакування.",
  }));
  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, "non_software_testing_role");
});

test("generic tester requires software-testing context", () => {
  assert.equal(classifyJobRelevance(job({
    title: "Tester",
    description: "Manual testing of a web application, API checks, Jira and test cases.",
  })).accepted, true);

  assert.equal(classifyJobRelevance(job({
    title: "Tester",
    description: "Testing physical consumer products on a production line.",
  })).accepted, false);
});

test("conflicting primary roles are rejected even when QA is only a skill hint", () => {
  const decision = classifyJobRelevance(job({
    title: "Technical Support Specialist (QA Skills)",
    description: "Customer support role. QA knowledge is a plus.",
  }));
  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, "conflicting_primary_role");
});

test("cross-source copies of the same vacancy are merged", () => {
  const dou = job({
    source: "rss:dou-qa",
    url: "https://jobs.dou.ua/companies/acme/vacancies/123",
    applyUrl: "https://jobs.dou.ua/companies/acme/vacancies/123",
    description: "Acme builds a web platform. We need a Senior QA Engineer for API, UI, SQL, Jira and Playwright testing.",
  });
  const robota = job({
    source: "robotaua:robotaua-qa",
    externalId: "987",
    url: "https://robota.ua/company42/vacancy987",
    applyUrl: "https://robota.ua/company42/vacancy987",
    company: "Example",
    location: "Київ",
    description: "Acme builds a web platform. We need a Senior QA Engineer for API, UI, SQL, Jira and Playwright testing.",
    postedAt: "2026-08-16T08:00:00.000Z",
  });

  assert.equal(areDuplicateVacancies(dou, robota), true);
  const result = deduplicateVacancies([dou, robota]);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.match(result.jobs[0].source, /dou/);
  assert.match(result.jobs[0].source, /robotaua/);
});

test("same company and title are not blindly merged when descriptions differ", () => {
  const webTeam = job({ description: "QA for the customer web portal using Playwright, REST API and PostgreSQL." });
  const firmwareTeam = job({
    source: "workua:qa",
    externalId: "2",
    url: "https://work.ua/jobs/2",
    applyUrl: "https://work.ua/jobs/2",
    description: "QA for a separate device-management platform using embedded simulators and hardware benches.",
    postedAt: "2026-06-01T10:00:00.000Z",
  });
  assert.equal(areDuplicateVacancies(webTeam, firmwareTeam), false);
});

test("filterRelevantVacancies reports rejected rows instead of silently accepting them", () => {
  const result = filterRelevantVacancies([
    job(),
    job({ title: "Тестувальник косметики", description: "Перевірка косметики" }),
  ]);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].decision.reason, "non_software_testing_role");
});

test("Robota.ua API response is normalized into JobInput", () => {
  const jobs = parseRobotaUaResponse({
    total: 1,
    documents: [{
      id: 123456,
      notebookId: 77,
      name: "Middle QA Engineer (Manual)",
      companyName: "robota.ua",
      cityName: "Київ",
      date: "2026-08-16T09:00:00",
      shortDescription: "<p>Web and API testing, Jira, SQL.</p>",
      salaryFrom: 60000,
      salaryTo: 80000,
    }],
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].source, "robotaua:robotaua-qa");
  assert.equal(jobs[0].externalId, "123456");
  assert.equal(jobs[0].title, "Middle QA Engineer (Manual)");
  assert.equal(jobs[0].company, "robota.ua");
  assert.equal(jobs[0].location, "Київ");
  assert.equal(jobs[0].description, "Web and API testing, Jira, SQL.");
  assert.equal(jobs[0].salaryText, "60000–80000");
  assert.equal(jobs[0].url, "https://robota.ua/company77/vacancy123456");
});