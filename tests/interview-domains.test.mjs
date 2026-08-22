import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

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
