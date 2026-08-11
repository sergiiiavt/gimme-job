import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("keeps the interview catalog additive, explicit, and prevalence-complete", async () => {
  const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, testingFoundations, embedded, expanded, sources, taxonomy] = await Promise.all([
    readFile(projectFile("content/interview/common-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/canonical-baseline.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/database-sql-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/observability-production-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/restored-coverage-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/testing-foundations-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/embedded-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/expanded-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/sources.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/taxonomy.json"), "utf8").then(JSON.parse),
  ]);
  const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...testingFoundations.questions, ...embedded.questions, ...expanded.questions];

  assert.ok(questions.length >= 601);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.equal(taxonomy.filter((item) => item.category).length, 19);
  assert.equal(sources.length, 50);
  assert.equal(canonical.questions.length, 30);
  assert.equal(databaseSql.questions.length, 25);
  assert.equal(observabilityProduction.questions.length, 25);
  assert.equal(restoredCoverage.questions.length, 21);
  assert.equal(testingFoundations.questions.length, 6);
  assert.equal(embedded.questions.length, 29);
  assert.equal(new Set(canonical.questions.map((question) => question.category)).size, 18);
  assert.equal(new Set([...canonical.questions, ...embedded.questions].map((question) => question.category)).size, 19);
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
    "testing-principle-defect-clustering",
    "test-design-technique-and-oracle",
    "embedded-layered-test-strategy",
    "embedded-power-loss-atomicity",
    "embedded-firmware-update-interruption",
    "iot-device-identity-provisioning",
  ]) {
    const question = questions.find((item) => item.id === id);
    assert.ok(question, `${id} must be present as an explicit foundational question.`);
  }

  assert.ok(questions.filter((question) => question.category === "Databases, SQL and BI").length >= 35);
  assert.ok(questions.filter((question) => /\b(sql|database|databases)\b/i.test(`${question.question} ${question.tags?.join(" ") ?? ""}`)).length >= 25);
  assert.ok(questions.filter((question) => question.category === "Observability and production").length >= 54);
  assert.ok(questions.filter((question) => /\b(observability|telemetry|monitoring|alert|alerts|alerting|slo|logs|metrics|traces)\b/i.test(`${question.question} ${question.tags?.join(" ") ?? ""}`)).length >= 25);
  assert.equal(questions.filter((question) => question.category === "Embedded and IoT").length, 29);
  assert.ok(questions.filter((question) => /\b(embedded|firmware|iot|hardware)\b/i.test(`${question.question} ${question.tags?.join(" ") ?? ""}`)).length >= 29);

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
  assert.match(generatorSource, /readJson\("content\/interview\/testing-foundations-qa\.json"\)/);
  assert.match(generatorSource, /readJson\("content\/interview\/embedded-qa\.json"\)/);
  assert.match(generatorSource, /const MINIMUM_QUESTION_COUNT = 601;/);
  assert.match(generatorSource, /baseQuestions\.length \+ generated\.length >= MINIMUM_QUESTION_COUNT/);
  assert.doesNotMatch(generatorSource, /contain exactly 520 questions/);
});

test("lazy-loads the catalog, unifies filters, and caps each rendered page at 60", async () => {
  const [uiSource, stylesSource, navigationSource, routeSource, schemaSource, resumeSource, aboutSource] = await Promise.all([
    readFile(projectFile("app/public-site.tsx"), "utf8"),
    readFile(projectFile("app/globals.css"), "utf8"),
    readFile(projectFile("app/site-navigation.tsx"), "utf8"),
    readFile(projectFile("app/api/[...route]/route.ts"), "utf8"),
    readFile(projectFile("db/schema.ts"), "utf8"),
    readFile(projectFile("app/resume-page.tsx"), "utf8"),
    readFile(projectFile("app/about-site.tsx"), "utf8"),
  ]);
  assert.doesNotMatch(uiSource, /^import interviewCatalog/m);
  assert.match(uiSource, /import\("@\/content\/interview\/catalog"\)/);
  assert.match(uiSource, /const INTERVIEW_PAGE_SIZE = 60;/);
  assert.match(uiSource, /function matchesAllSearchTerms/);
  assert.match(uiSource, /terms\.every\(\(term\) => searchable\.includes\(term\)\)/);
  assert.match(uiSource, /topicSearchLabels\.get\(item\.category\)/);
  assert.match(uiSource, /placeholder="Search all words across questions, answers, tags, or skills"/);
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
  assert.match(uiSource, /\{ value: "learning", label: "Learning path" \}/);
  assert.doesNotMatch(uiSource, /Editorial order/);
  assert.match(uiSource, /if \(sort === "learning"\)/);
  assert.match(uiSource, /learningTopicOrder\.get\(left\.category\)/);
  assert.match(uiSource, /levelOrder\[left\.level\] - levelOrder\[right\.level\]/);
  assert.match(uiSource, /prevalenceOrder\[left\.prevalence\] - prevalenceOrder\[right\.prevalence\]/);
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

  for (const label of ["About this site", "Vacancies", "My Resume", "Interview questions", "Trends", "Performance & reliability", "Observability & SRE", "Networking", "Linux & shell", "Generative AI & LLM", "Embedded & IoT QA", "News", "Fight AI slop"]) {
    assert.match(navigationSource, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(navigationSource, /id: "career",[\s\S]*?label: "Career",[\s\S]*?id: "jobs"[\s\S]*?id: "resume"[\s\S]*?id: "interview"[\s\S]*?id: "trends"/);
  assert.match(navigationSource, /id: "learning",[\s\S]*?label: "Learning path"/);
  assert.match(navigationSource, /id: "misc",[\s\S]*?label: "Misc",[\s\S]*?id: "news"[\s\S]*?id: "rewild"/);
  assert.match(stylesSource, /\.kb-area-group-career/);
  assert.match(stylesSource, /\.kb-area-group-learning/);
  assert.match(stylesSource, /\.kb-area-group-misc/);
  assert.match(stylesSource, /\.kb-nav-intro/);
  assert.ok(navigationSource.indexOf('id: "about"') < navigationSource.indexOf('id: "career"'), "About this site must be the first navigation item.");
  assert.ok(navigationSource.indexOf('id: "trends"') < navigationSource.indexOf('id: "llm"'), "The Career group must come before the Learning path.");
  assert.ok(navigationSource.indexOf('id: "interview"') < navigationSource.indexOf('id: "llm"'), "Generative AI must follow Interview questions.");
  assert.ok(navigationSource.indexOf('id: "llm"') < navigationSource.indexOf('id: "agentic"'), "AI agents must follow Generative AI.");
  assert.ok(navigationSource.indexOf('id: "agentic"') < navigationSource.indexOf('id: "certifications"'), "Both AI topics must appear directly after Interview questions.");
  assert.ok(navigationSource.indexOf('id: "news"') < navigationSource.indexOf('id: "rewild"'), "Fight AI slop must be the final section above the view switch.");
  assert.match(uiSource, /if \(section === "about"\) return <AboutSite\/>/);
  assert.match(uiSource, /if \(section === "resume"\) return <ResumePage mode=\{mode\}\/>/);
  assert.match(uiSource, /const hideSecondary = section === "about" \|\| section === "resume" \|\| section === "rewild"/);
  assert.match(uiSource, /mode === "personal" \? "interview" : "about"/);
  assert.match(aboutSource, /PET PROJECT \/ LIVE SYSTEM/);
  assert.match(aboutSource, /GitHub repository/);
  assert.match(aboutSource, /Runtime architecture/);
  assert.match(aboutSource, /Deployment flow/);
  assert.match(aboutSource, /Git catalog \/ D1 private data/);
  assert.match(resumeSource, /fetch\("\/api\/settings"\)/);
  assert.match(resumeSource, /mode === "personal" && contact\?\.phone/);
  assert.match(resumeSource, /mode === "personal" && contact\?\.email/);
  assert.match(resumeSource, /PUBLIC RESUME \/ LINKEDIN ONLY/);
  assert.match(resumeSource, /Lead QA Engineer/);
  assert.match(resumeSource, /TIETO UKRAINE LTD/);
  assert.match(resumeSource, /National Technical University of Ukraine/);
  assert.doesNotMatch(resumeSource, /sergii\.iavt@gmail\.com/i);
  assert.doesNotMatch(resumeSource, /095[^\n]{0,20}574/);
  assert.match(uiSource, /embedded: \{[\s\S]*?title: "Embedded & IoT QA"/);

  const assetDirectory = projectFile("dist/client/assets/");
  const scripts = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
  const catalogScripts = scripts.filter((file) => file.startsWith("catalog-"));
  assert.ok(catalogScripts.length >= 1, "The production build must contain a separate catalog chunk.");

  const catalogOutput = (await Promise.all(catalogScripts.map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.match(catalogOutput, /testing-purpose-and-limits/);
  assert.match(catalogOutput, /data-source-target-lineage/);
  assert.match(catalogOutput, /monitoring-versus-observability/);
  assert.match(catalogOutput, /embedded-layered-test-strategy/);
  assert.match(catalogOutput, /testing-principle-defect-clustering/);

  const initialOutput = (await Promise.all(scripts.filter((file) => !catalogScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /testing-purpose-and-limits/);
  assert.doesNotMatch(initialOutput, /data-source-target-lineage/);
  assert.doesNotMatch(initialOutput, /monitoring-versus-observability/);
  assert.doesNotMatch(initialOutput, /embedded-layered-test-strategy/);
});
