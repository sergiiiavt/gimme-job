import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("keeps the interview catalog exact, explicit, and prevalence-complete", async () => {
  const [common, canonical, expanded, sources, taxonomy] = await Promise.all([
    readFile(projectFile("content/interview/common-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/canonical-baseline.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/expanded-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/sources.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/taxonomy.json"), "utf8").then(JSON.parse),
  ]);
  const questions = [...common.questions, ...canonical.questions, ...expanded.questions];

  assert.equal(questions.length, 520);
  assert.equal(new Set(questions.map((question) => question.id)).size, 520);
  assert.equal(taxonomy.filter((item) => item.category).length, 18);
  assert.equal(sources.length, 46);
  assert.equal(canonical.questions.length, 30);
  assert.equal(new Set(canonical.questions.map((question) => question.category)).size, 18);
  assert.deepEqual(
    new Set(questions.map((question) => question.prevalence)),
    new Set(["Very common", "Common", "Occasional", "Specialist"]),
  );

  for (const id of [
    "test-levels",
    "testing-types",
    "qa-testing-debugging",
    "test-process-activities",
    "test-technique-families",
    "entry-versus-exit-criteria",
    "tdd-bdd-atdd",
    "logs-metrics-traces",
  ]) {
    const question = questions.find((item) => item.id === id);
    assert.ok(question, `${id} must be present as an explicit foundational question.`);
  }

  for (const id of ["test-levels", "testing-types"]) {
    const question = questions.find((item) => item.id === id);
    assert.equal(question.category, "Fundamentals");
    assert.equal(question.level, "Junior");
    assert.equal(question.prevalence, "Very common");
  }
});

test("lazy-loads the catalog and caps each rendered page at 60", async () => {
  const uiSource = await readFile(projectFile("app/public-site.tsx"), "utf8");
  assert.doesNotMatch(uiSource, /^import interviewCatalog/m);
  assert.match(uiSource, /import\("@\/content\/interview\/catalog"\)/);
  assert.match(uiSource, /const INTERVIEW_PAGE_SIZE = 60;/);
  assert.match(uiSource, /matchingQuestions\.slice\(pageStart, pageStart \+ INTERVIEW_PAGE_SIZE\)/);
  assert.match(uiSource, /function MultiSelectFilter/);
  assert.match(uiSource, />Clear all</);

  const assetDirectory = projectFile("dist/client/assets/");
  const scripts = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
  const catalogScripts = scripts.filter((file) => file.startsWith("catalog-"));
  assert.ok(catalogScripts.length >= 1, "The production build must contain a separate catalog chunk.");

  const catalogOutput = (await Promise.all(catalogScripts.map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.match(catalogOutput, /testing-purpose-and-limits/);

  const initialOutput = (await Promise.all(scripts.filter((file) => !catalogScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /testing-purpose-and-limits/);
});
