import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { classifyJobRelevance } = await import("../agent/src/job-intake.ts");

function vacancy(title: string, description: string) {
  return { title, description, company: "Example", location: "Kyiv" };
}

test("software QA leadership variants remain accepted", () => {
  const cases = [
    vacancy("QA Manager", "Web and API testing, Jira, Playwright, SQL and test strategy."),
    vacancy("Head of QA", "Lead software quality for web and mobile applications."),
    vacancy("Head of Quality Assurance", "Own software test strategy, API testing and automation."),
    vacancy("Test Manager", "Manage web, mobile and API testing teams using Jira."),
    vacancy("Керівник відділу тестування", "Тестування програмного забезпечення, API, web та автоматизація."),
  ];
  for (const candidate of cases) {
    assert.equal(classifyJobRelevance(candidate).accepted, true, candidate.title);
  }
});

test("ambiguous QA management is rejected for pharmaceutical manufacturing", () => {
  const cases = [
    vacancy(
      "Quality Assurance Manager",
      "Pharmaceutical manufacturing, GMP compliance, batch release and raw materials quality control.",
    ),
    vacancy(
      "QA Manager",
      "QA manager for pharmaceutical manufacturing, GMP compliance, batch release and laboratory quality control.",
    ),
  ];

  for (const candidate of cases) {
    const decision = classifyJobRelevance(candidate);
    assert.equal(decision.accepted, false, candidate.title);
    assert.equal(decision.reason, "non_software_testing_role", candidate.title);
  }
});

test("testing leadership is rejected for food production laboratories", () => {
  const decision = classifyJobRelevance(vacancy(
    "Head of Testing",
    "Lead a food production laboratory, sensory testing and HACCP quality processes.",
  ));
  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, "non_software_testing_role");
});

test("ambiguous testing leadership without software evidence is not assumed to be IT", () => {
  const decision = classifyJobRelevance(vacancy(
    "Test Manager",
    "Manage the testing department and coordinate quality activities.",
  ));
  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, "generic_test_role_without_software_context");
});