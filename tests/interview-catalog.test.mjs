import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("keeps the interview catalog additive, explicit, and prevalence-complete", async () => {
  const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, expanded, sources, taxonomy] = await Promise.all([
    readFile(projectFile("content/interview/common-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/canonical-baseline.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/database-sql-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/observability-production-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/restored-coverage-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/expanded-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/sources.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/taxonomy.json"), "utf8").then(JSON.parse),
  ]);
  const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...expanded.questions];

  assert.ok(questions.length >= 566);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.equal(taxonomy.filter((item) => item.category).length, 18);
  assert.equal(sources.length, 46);
  assert.equal(canonical.questions.length, 30);
  assert.equal(databaseSql.questions.length, 25);
  assert.equal(observabilityProduction.questions.length, 25);
  assert.equal(restoredCoverage.questions.length, 21);
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
    "database-keys-and-constraints",
    "sql-null-semantics",
    "database-transactions-acid",
    "transaction-isolation-anomalies",
    "database-indexes",
    "sql-explain-query-plan",
    "database-schema-migrations",
    "sql-injection-parameterized-queries",
    "star-schema-facts-dimensions-grain",
    "bi-dashboard-reconciliation",
    "data-source-target-lineage",
    "data-batch-streaming-late-events",
    "data-upstream-schema-drift",
    "data-slowly-changing-dimensions",
    "data-sensitive-test-data",
    "bi-semantic-measures-calendars",
    "test-levels-stakeholder-disagreement",
    "testing-incomplete-requirements-time-pressure",
    "state-transitions-interacting-inputs",
    "defect-triage-audit-evidence",
    "defect-cannot-reproduce",
    "mobile-push-after-termination",
    "automation-waits-ci-nightly",
    "automation-unreliable-third-party",
    "parallel-tests-shared-data",
    "release-criteria-under-pressure",
    "leadership-rebuild-quality-trust",
    "llm-prompt-injection-high-stakes",
    "production-canary-verification",
    "regulated-change-control-migration",
    "grey-box-testing",
    "monitoring-versus-observability",
    "four-golden-signals",
    "structured-production-logging",
    "liveness-readiness-startup-probes",
    "post-deployment-production-smoke-tests",
    "telemetry-pipeline-validation",
    "error-budget-release-decisions",
    "blameless-postmortem-actions",
  ]) {
    const question = questions.find((item) => item.id === id);
    assert.ok(question, `${id} must be present as an explicit foundational question.`);
  }

  assert.ok(questions.filter((question) => question.category === "Databases, SQL and BI").length >= 35);
  assert.ok(questions.filter((question) => /\b(sql|database|databases)\b/i.test(`${question.question} ${question.tags?.join(" ") ?? ""}`)).length >= 25);
  assert.ok(questions.filter((question) => question.category === "Observability and production").length >= 54);
  assert.ok(questions.filter((question) => /\b(observability|telemetry|monitoring|alert|alerts|alerting|slo|logs|metrics|traces)\b/i.test(`${question.question} ${question.tags?.join(" ") ?? ""}`)).length >= 25);

  for (const id of ["test-levels", "testing-types"]) {
    const question = questions.find((item) => item.id === id);
    assert.equal(question.category, "Fundamentals");
    assert.equal(question.level, "Junior");
    assert.equal(question.prevalence, "Very common");
  }
});

test("preserves existing generated questions when authored coverage grows", async () => {
  const generatorSource = await readFile(projectFile("scripts/generate-interview-expansion.mjs"), "utf8");

  assert.match(generatorSource, /const preservedGeneratedQuestions = expanded\.questions\.filter/);
  assert.match(generatorSource, /const needed = Math\.max\(0, topic\.target - existingCount\);/);
  assert.match(generatorSource, /readJson\("content\/interview\/observability-production-qa\.json"\)/);
  assert.match(generatorSource, /baseQuestions\.length \+ generated\.length >= MINIMUM_QUESTION_COUNT/);
  assert.doesNotMatch(generatorSource, /contain exactly 520 questions/);
});

test("lazy-loads the catalog, unifies filters, and caps each rendered page at 60", async () => {
  const [uiSource, stylesSource, navigationSource, routeSource, schemaSource] = await Promise.all([
    readFile(projectFile("app/public-site.tsx"), "utf8"),
    readFile(projectFile("app/globals.css"), "utf8"),
    readFile(projectFile("app/site-navigation.tsx"), "utf8"),
    readFile(projectFile("app/api/[...route]/route.ts"), "utf8"),
    readFile(projectFile("db/schema.ts"), "utf8"),
  ]);
  assert.doesNotMatch(uiSource, /^import interviewCatalog/m);
  assert.match(uiSource, /import\("@\/content\/interview\/catalog"\)/);
  assert.match(uiSource, /const INTERVIEW_PAGE_SIZE = 60;/);
  assert.match(uiSource, /matchingQuestions\.slice\(pageStart, pageStart \+ INTERVIEW_PAGE_SIZE\)/);
  assert.match(uiSource, /function InterviewFilter/);
  assert.doesNotMatch(uiSource, /function MultiSelectFilter/);
  assert.doesNotMatch(uiSource, /<label className="iq-category">/);
  assert.match(uiSource, />Reset filters</);
  assert.match(uiSource, /<section className="iq-toolbar"[\s\S]*?<div className="iq-filter-status"/);
  assert.match(stylesSource, /\.iq-filter-grid/);
  assert.match(stylesSource, /\.iq-filter-control summary/);
  assert.match(stylesSource, /\.iq-filter-option-radio \.iq-filter-option-mark/);
  assert.match(uiSource, /type=\{selectionMode === "single" \? "radio" : "checkbox"\}/);
  assert.match(uiSource, /role=\{selectionMode === "single" \? "radiogroup"/);
  assert.match(uiSource, /const \[prevalences, setPrevalences\] = useState<InterviewPrevalence\[]>\(\[\]\)/);
  assert.match(uiSource, /prevalences\.length === 0 \|\| prevalences\.includes\(item\.prevalence\)/);
  assert.doesNotMatch(uiSource, /<i aria-hidden="true">\+<\/i>/);
  for (const filter of ["prevalence", "sort", "tags", "levels"]) {
    assert.match(uiSource, new RegExp(`openFilter === "${filter}"`));
  }
  assert.match(uiSource, /event\.key === "Escape"/);
  assert.match(uiSource, /closest\("\.iq-filter-control"\)/);
  const filterGrid = uiSource.slice(uiSource.indexOf('<div className="iq-filter-grid">'), uiSource.indexOf('<div className="iq-list">'));
  assert.ok(filterGrid.indexOf('label="Sort"') < filterGrid.indexOf('label="Prevalence"'), "Sort must appear before Prevalence.");
  assert.doesNotMatch(filterGrid.match(/label="Prevalence"[^\n]+/)?.[0] ?? "", /selectionMode="single"/);
  assert.match(uiSource, /Personal progress/);
  assert.match(routeSource, /interview-progress/);
  assert.match(schemaSource, /sqliteTable\("interview_progress"/);
  assert.doesNotMatch(uiSource, /Manage statuses & feedback/);

  for (const label of ["Performance & reliability", "Observability & SRE", "Networking", "Linux & shell", "Generative AI & LLM"]) {
    assert.match(navigationSource, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.ok(navigationSource.indexOf('id: "trends"') < navigationSource.indexOf('id: "news"'), "Trends must be immediately before News in the navigation taxonomy.");

  const assetDirectory = projectFile("dist/client/assets/");
  const scripts = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
  const catalogScripts = scripts.filter((file) => file.startsWith("catalog-"));
  assert.ok(catalogScripts.length >= 1, "The production build must contain a separate catalog chunk.");

  const catalogOutput = (await Promise.all(catalogScripts.map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.match(catalogOutput, /testing-purpose-and-limits/);
  assert.match(catalogOutput, /data-source-target-lineage/);
  assert.match(catalogOutput, /monitoring-versus-observability/);

  const initialOutput = (await Promise.all(scripts.filter((file) => !catalogScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /testing-purpose-and-limits/);
  assert.doesNotMatch(initialOutput, /data-source-target-lineage/);
  assert.doesNotMatch(initialOutput, /monitoring-versus-observability/);
});
