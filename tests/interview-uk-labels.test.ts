import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";
import { ukrainianInterviewLabel } from "../content/interview/ukrainian-labels.ts";

register();
const [{ default: catalog, interviewCatalogForDomain }, { default: python }, { INTERVIEW_DOMAIN_ROUTES }] = await Promise.all([
  import("../content/interview/catalog.ts"),
  import("../content/python-interview/catalog.ts"),
  import("../content/interview/domain-routes.ts"),
]);

test("every published interview category, topic and question type has Ukrainian copy", () => {
  const catalogs = [catalog, python, ...INTERVIEW_DOMAIN_ROUTES.map((route) => interviewCatalogForDomain(route.id))];
  const labels = new Set<string>();
  for (const item of catalogs) {
    for (const topic of item.taxonomy) labels.add(topic.label);
    for (const question of item.questions) {
      labels.add(question.category);
      labels.add(question.prevalence);
      if ("sqlScope" in question && typeof question.sqlScope === "string") labels.add(question.sqlScope);
      if (question.kind) labels.add(question.kind);
    }
  }

  for (const label of labels) {
    const translated = ukrainianInterviewLabel(label);
    assert.notEqual(translated, label, "Missing Ukrainian interview label: " + label);
    assert.match(translated, /[А-Яа-яІіЇїЄєҐґ]/u, label);
  }
});

test("label aliases retain technical names while handling case, spaces and conjunctions", () => {
  assert.equal(ukrainianInterviewLabel("Workload modelling"), "Моделювання навантаження");
  assert.equal(ukrainianInterviewLabel("  CORE language & syntax  "), "Основи мови та синтаксис");
  assert.equal(ukrainianInterviewLabel("Core language and syntax"), "Основи мови та синтаксис");
  assert.equal(ukrainianInterviewLabel("JMeter, k6 & Locust"), "JMeter, k6 та Locust");
  assert.equal(ukrainianInterviewLabel("Very common"), "Дуже поширене");
  assert.equal(ukrainianInterviewLabel("QA interview question"), "Питання для QA-співбесіди");
});

test("unknown or proper-name labels remain readable", () => {
  assert.equal(ukrainianInterviewLabel("PostgreSQL"), "PostgreSQL");
  assert.equal(ukrainianInterviewLabel("New category"), "New category");
});
