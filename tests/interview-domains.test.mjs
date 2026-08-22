import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);
const readText = (path) => readFile(projectFile(path), "utf8");

function classifySubtopic(question, config) {
  const searchable = [question.id, question.category, question.kind ?? "", question.question, ...(question.tags ?? [])]
    .join(" ")
    .toLowerCase();
  const rule = config.rules?.find((candidate) => {
    if (candidate.category && candidate.category !== question.category) return false;
    if (candidate.kind && candidate.kind !== question.kind) return false;
    return !candidate.any?.length || candidate.any.some((term) => searchable.includes(term.toLowerCase()));
  });
  return rule?.target ?? config.fallbackByCategory?.[question.category] ?? config.fallback;
}

async function readQuestionJsonFiles(directory) {
  const names = await readdir(projectFile(directory));
  const questionFiles = names.filter((name) => name.endsWith(".json"));
  const documents = await Promise.all(questionFiles.map((name) => readJson(`${directory}/${name}`).catch(() => null)));
  const unique = new Map();
  for (const document of documents) {
    for (const question of document?.questions ?? []) unique.set(question.id, question);
  }
  return [...unique.values()];
}

test("maps every detailed QA interview topic to exactly one public domain", async () => {
  const [topics, domains] = await Promise.all([
    readJson("content/interview/taxonomy.json"),
    readJson("content/interview/domains.json"),
  ]);

  const detailedCategories = topics.filter((item) => item.category).map((item) => item.category);
  const publicDomains = domains.taxonomy.filter((item) => item.category).map((item) => item.category);
  const mappedCategories = Object.keys(domains.categoryToDomain);
  const mappedDomains = Object.values(domains.categoryToDomain);

  assert.equal(detailedCategories.length, 20);
  assert.equal(new Set(detailedCategories).size, detailedCategories.length);
  assert.deepEqual(new Set(mappedCategories), new Set(detailedCategories));

  assert.equal(publicDomains.length, 7);
  assert.equal(new Set(publicDomains).size, publicDomains.length);
  assert.ok(mappedDomains.every((domain) => publicDomains.includes(domain)));

  for (const expectedDomain of [
    "Generic QA",
    "Automation QA",
    "SQL & Databases",
    "Web & API",
    "Mobile",
    "Embedded & IoT",
    "AI & LLM QA",
  ]) {
    assert.ok(publicDomains.includes(expectedDomain), `${expectedDomain} must remain a public interview domain.`);
  }

  assert.equal(domains.categoryToDomain["Databases, SQL and BI"], "SQL & Databases");
  assert.equal(domains.categoryToDomain["Embedded and IoT"], "Embedded & IoT");
  assert.equal(domains.categoryToDomain["AI, ML and LLM"], "AI & LLM QA");
  assert.equal(domains.categoryToDomain["Automation and CI"], "Automation QA");
  assert.equal(domains.categoryToDomain.Fundamentals, "Generic QA");
});

test("audits every current QA question into a valid logical subtopic", async () => {
  const [domains, subtopics, questions] = await Promise.all([
    readJson("content/interview/domains.json"),
    readJson("content/interview/subtopics.json"),
    readQuestionJsonFiles("content/interview"),
  ]);

  const expectedMinimumUsedSubtopics = {
    "Generic QA": 6,
    "Automation QA": 3,
    "SQL & Databases": 4,
    "Web & API": 3,
    Mobile: 3,
    "Embedded & IoT": 4,
    "AI & LLM QA": 3,
  };

  for (const [domain, minimum] of Object.entries(expectedMinimumUsedSubtopics)) {
    const config = subtopics.domains[domain];
    assert.ok(config, `${domain} must have a second-level taxonomy.`);
    assert.ok(config.taxonomy.length > 1, `${domain} must not collapse to a single repeated topic.`);

    const domainQuestions = questions.filter((question) => domains.categoryToDomain[question.category] === domain);
    assert.ok(domainQuestions.length > 0, `${domain} must contain questions.`);

    const validCategories = new Set(config.taxonomy.map((item) => item.category));
    const usedCategories = new Set();
    for (const question of domainQuestions) {
      const category = classifySubtopic(question, config);
      assert.ok(validCategories.has(category), `${question.id} maps to unknown ${domain} subtopic: ${category}`);
      usedCategories.add(category);
    }
    assert.ok(usedCategories.size >= minimum, `${domain} should use at least ${minimum} logical subtopics; got ${[...usedCategories].join(", ")}`);
  }

  const sqlLabels = subtopics.domains["SQL & Databases"].taxonomy.map((item) => item.label);
  assert.ok(sqlLabels.includes("SQL fundamentals & CRUD"));
  assert.ok(sqlLabels.includes("ETL, warehouse & BI"));
  assert.ok(sqlLabels.includes("Practical SQL"));
  assert.ok(!sqlLabels.includes("Databases, SQL & BI"));
});

test("keeps Python language topics and splits the broad Python AQA bucket", async () => {
  const [subtopics, overrides, rawQuestions] = await Promise.all([
    readJson("content/interview/subtopics.json"),
    readJson("content/python-interview/topic-overrides.json"),
    readQuestionJsonFiles("content/python-interview"),
  ]);
  const overrideById = new Map(overrides.map((item) => [item.id, item.category]));
  const config = subtopics.domains.Python;
  const validCategories = new Set(config.taxonomy.map((item) => item.category));
  const usedCategories = new Set();

  for (const rawQuestion of rawQuestions) {
    const question = overrideById.has(rawQuestion.id)
      ? { ...rawQuestion, category: overrideById.get(rawQuestion.id) }
      : rawQuestion;
    const category = classifySubtopic(question, config);
    assert.ok(validCategories.has(category), `${question.id} maps to unknown Python subtopic: ${category}`);
    usedCategories.add(category);
  }

  for (const category of [
    "Pytest & fixtures",
    "Mocking & test isolation",
    "Python browser automation",
    "Python API & service automation",
    "Python AQA reliability",
    "Python AQA framework & CI",
  ]) {
    assert.ok(usedCategories.has(category), `${category} must be populated by the current Python question set.`);
  }
});

test("renders content-width domain buttons and logical topics underneath", async () => {
  const [overlay, catalog, pythonCatalog, qaPage, pythonPage] = await Promise.all([
    readText("app/interview-domain-switcher-overlay.tsx"),
    readText("content/interview/catalog.ts"),
    readText("content/python-interview/catalog.ts"),
    readText("app/interview/page.tsx"),
    readText("app/interview/python/page.tsx"),
  ]);

  for (const label of ["Generic QA", "Python", "Automation", "SQL / DB", "Web / API", "Mobile", "Embedded", "AI / LLM"]) {
    assert.match(overlay, new RegExp(label.replace("/", "\\/")));
  }

  assert.match(overlay, /\.kb-subnav-switch/);
  assert.match(overlay, /display: flex;/);
  assert.match(overlay, /flex-wrap: wrap;/);
  assert.match(overlay, /flex: 0 0 auto;/);
  assert.match(overlay, /width: auto;/);
  assert.doesNotMatch(overlay, /grid-template-columns/);
  assert.match(qaPage, /<InterviewDomainSwitcherOverlay\/>/);
  assert.match(pythonPage, /<InterviewDomainSwitcherOverlay\/>/);

  assert.match(catalog, /import subtopics from "\.\/subtopics\.json"/);
  assert.match(catalog, /classifySubtopic\(question, selectedDomainCategory\)/);
  assert.match(catalog, /selectedSubtopics\?\.taxonomy/);
  assert.match(pythonCatalog, /interviewSubtopics\.domains/);
  assert.match(pythonCatalog, /classifyPythonSubtopic\(enhanced\)/);
});
