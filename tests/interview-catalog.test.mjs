import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("keeps the interview catalog additive, explicit, and prevalence-complete", async () => {
  const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, testingFoundations, embedded, modernSdet, coreFoundations, expanded, sources, taxonomy] = await Promise.all([
    readFile(projectFile("content/interview/common-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/canonical-baseline.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/database-sql-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/observability-production-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/restored-coverage-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/testing-foundations-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/embedded-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/modern-sdet-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/core-foundations-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/expanded-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/sources.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/taxonomy.json"), "utf8").then(JSON.parse),
  ]);
  const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...testingFoundations.questions, ...embedded.questions, ...modernSdet.questions, ...coreFoundations.questions, ...expanded.questions];

  assert.ok(questions.length >= 672);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.equal(taxonomy.filter((item) => item.category).length, 20);
  assert.ok(sources.length >= 67);
  assert.equal(canonical.questions.length, 31);
  assert.equal(databaseSql.questions.length, 25);
  assert.equal(observabilityProduction.questions.length, 25);
  assert.equal(restoredCoverage.questions.length, 21);
  assert.equal(testingFoundations.questions.length, 7);
  assert.equal(embedded.questions.length, 29);
  assert.equal(modernSdet.questions.length, 52);
  assert.equal(coreFoundations.questions.length, 18);
  assert.equal(new Set(canonical.questions.map((question) => question.category)).size, 19);
  assert.equal(new Set([...canonical.questions, ...embedded.questions].map((question) => question.category)).size, 20);
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
    "test-design-techniques-inventory",
    "test-design-technique-and-oracle",
    "embedded-layered-test-strategy",
    "embedded-power-loss-atomicity",
    "embedded-firmware-update-interruption",
    "iot-device-identity-provisioning",
    "test-doubles-taxonomy",
    "property-based-testing",
    "mutation-testing-suite-strength",
    "visual-regression-purpose",
    "cross-browser-risk-matrix",
    "big-o-test-automation",
    "i18n-l10n-difference",
    "unicode-normalization-graphemes",
    "ai-generated-test-review",
    "mcp-testing-workflows",
    "oauth-oidc-difference",
    "event-driven-contract-testing",
    "core-web-vitals-test-strategy",
    "software-supply-chain-provenance",
    "acceptance-testing-uat-alpha-beta",
    "integration-test-approaches",
    "static-review-analysis-techniques",
    "cause-effect-graph-testing",
    "condition-decision-mcdc-coverage",
    "experience-based-techniques-comparison",
    "test-plan-essential-contents",
    "good-test-case-characteristics",
    "testing-work-products-map",
    "good-requirement-quality-characteristics",
    "requirement-acceptance-criteria-business-rule",
    "requirements-review-techniques",
    "requirement-verification-methods",
    "test-estimation-technique-families",
    "three-point-test-estimation",
    "test-effort-versus-duration",
    "test-estimation-work-breakdown-hidden-work",
    "test-reestimation-actuals-feedback",
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

  const testingTypes = questions.find((question) => question.id === "testing-types");
  assert.match(testingTypes.question, /What test types do you know/i);
  for (const type of ["performance", "load and stress", "security", "usability and accessibility", "compatibility", "reliability and recovery", "maintainability", "portability", "safety"]) {
    assert.match(testingTypes.shortAnswer, new RegExp(type, "i"));
  }
  assert.match(testingTypes.shortAnswer, /component, integration, system and acceptance are test levels/i);

  const techniqueInventory = questions.find((question) => question.id === "test-design-techniques-inventory");
  assert.match(techniqueInventory.question, /What test-design techniques do you know/i);
  for (const technique of ["equivalence partitioning", "boundary-value analysis", "decision-table testing", "state-transition testing", "pairwise", "statement", "branch", "exploratory testing", "error guessing", "checklist-based testing"]) {
    assert.match(techniqueInventory.shortAnswer, new RegExp(technique, "i"));
  }

  const matchesAllWords = (question, query) => {
    const searchable = `${question.question} ${question.shortAnswer} ${question.tags.join(" ")}`.toLowerCase();
    return query.toLowerCase().trim().split(/\s+/).every((term) => searchable.includes(term));
  };
  assert.ok(matchesAllWords(testingTypes, "test types"));
  assert.ok(matchesAllWords(techniqueInventory, "test design techniques"));
  assert.ok(matchesAllWords(techniqueInventory, "what all techniques do you know"));

  for (const id of ["pairwise-combinatorial-testing", "use-case-test-design", "classification-tree-testing", "cause-effect-graph-testing", "condition-decision-mcdc-coverage"]) {
    const question = questions.find((item) => item.id === id);
    assert.ok(question.sourceIds.includes("istqb-glossary"));
    assert.ok(!question.sourceIds.includes("istqb-ctfl-v4"), `${id} must not attribute a technique outside the Foundation syllabus to CTFL v4.`);
  }
});

test("every question has a Ukrainian translation and a practical example", async () => {
  const [common, canonical, databaseSql, observabilityProduction, restoredCoverage, testingFoundations, embedded, modernSdet, coreFoundations, expanded] = await Promise.all([
    readFile(projectFile("content/interview/common-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/canonical-baseline.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/database-sql-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/observability-production-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/restored-coverage-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/testing-foundations-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/embedded-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/modern-sdet-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/core-foundations-qa.json"), "utf8").then(JSON.parse),
    readFile(projectFile("content/interview/expanded-qa.json"), "utf8").then(JSON.parse),
  ]);
  const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...observabilityProduction.questions, ...restoredCoverage.questions, ...testingFoundations.questions, ...embedded.questions, ...modernSdet.questions, ...coreFoundations.questions, ...expanded.questions];

  for (const question of questions) {
    assert.ok(question.questionUk?.trim(), `${question.id} is missing questionUk`);
    assert.ok(question.shortAnswerUk?.trim(), `${question.id} is missing shortAnswerUk`);
    assert.ok(question.shortAnswerUk.trim().length >= 100, `${question.id} has a too-short shortAnswerUk`);
    assert.equal(question.strongAnswerSignalsUk?.length, question.strongAnswerSignals.length, `${question.id} strongAnswerSignalsUk must match strongAnswerSignals length`);
    assert.ok(question.example?.trim(), `${question.id} is missing example`);
    assert.ok(question.exampleUk?.trim(), `${question.id} is missing exampleUk`);
  }
});

test("preserves existing generated questions when authored coverage grows", async () => {
  const generatorSource = await readFile(projectFile("scripts/generate-interview-expansion.mjs"), "utf8");

  assert.match(generatorSource, /const preservedGeneratedQuestions = expanded\.questions\.filter/);
  assert.match(generatorSource, /const needed = Math\.max\(0, topic\.target - existingCount\);/);
  assert.match(generatorSource, /readJson\("content\/interview\/observability-production-qa\.json"\)/);
  assert.match(generatorSource, /readJson\("content\/interview\/testing-foundations-qa\.json"\)/);
  assert.match(generatorSource, /readJson\("content\/interview\/embedded-qa\.json"\)/);
  assert.match(generatorSource, /readJson\("content\/interview\/modern-sdet-qa\.json"\)/);
  assert.match(generatorSource, /readJson\("content\/interview\/core-foundations-qa\.json"\)/);
  assert.match(generatorSource, /practicalFocusByConcept/);
  assert.match(generatorSource, /const MINIMUM_QUESTION_COUNT = 672;/);
  assert.match(generatorSource, /baseQuestions\.length \+ generated\.length >= MINIMUM_QUESTION_COUNT/);
  assert.match(generatorSource, /reviewInterviewPrevalence/);
  assert.match(generatorSource, /modernSdet\.questions = modernSdet\.questions\.map/);
  assert.match(generatorSource, /coreFoundations\.questions = coreFoundations\.questions\.map/);
  assert.doesNotMatch(generatorSource, /prevalenceByPosition/);
  assert.doesNotMatch(generatorSource, /contain exactly 520 questions/);
});

test("lazy-loads the catalog, unifies filters, and caps each rendered page at 60", async () => {
  const [uiSource, stylesSource, navigationSource, routeSource, schemaSource, resumeSource, aboutSource, aboutContentSource, gameSource, privateJobsSource] = await Promise.all([
    readFile(projectFile("app/public-site.tsx"), "utf8"),
    readFile(projectFile("app/globals.css"), "utf8"),
    readFile(projectFile("app/site-navigation.tsx"), "utf8"),
    readFile(projectFile("app/api/[...route]/route.ts"), "utf8"),
    readFile(projectFile("db/schema.ts"), "utf8"),
    readFile(projectFile("app/resume-page.tsx"), "utf8"),
    readFile(projectFile("app/about-site.tsx"), "utf8"),
    readFile(projectFile("app/about-site-content.ts"), "utf8"),
    readFile(projectFile("app/rewild-game.tsx"), "utf8"),
    readFile(projectFile("app/page.tsx"), "utf8"),
  ]);
  assert.doesNotMatch(uiSource, /^import interviewCatalog/m);
  assert.match(uiSource, /import\("@\/content\/interview\/catalog"\)/);
  assert.match(uiSource, /const INTERVIEW_PAGE_SIZE = 60;/);
  assert.match(uiSource, /function matchesAllSearchTerms/);
  assert.match(uiSource, /terms\.every\(\(term\) => searchable\.includes\(term\)\)/);
  assert.match(uiSource, /topicSearchLabels\.get\(item\.category\)/);
  assert.match(uiSource, /placeholder="Search all words across questions, answers, tags, or skills"/);
  assert.match(uiSource, /matchingQuestions\.slice\(pageStart, pageStart \+ INTERVIEW_PAGE_SIZE\)/);
  assert.match(uiSource, /type InterviewPrevalenceFilter = InterviewPrevalence;/);
  assert.doesNotMatch(uiSource, /editorialStar/);
  assert.doesNotMatch(uiSource, /Starred fundamental/);
  assert.match(stylesSource, /\.iq-star-icon \{/);
  assert.match(stylesSource, /\.iq-star-filter \{/);
  assert.match(stylesSource, /\.iq-filter-grid-personal \{[^}]*grid-template-columns: 132px repeat\(4, minmax\(0, 1fr\)\) auto/);
  assert.ok(uiSource.indexOf("iq-star-filter${starredOnly") < uiSource.indexOf("emptyLabel=\"Most common first\""));
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
  assert.match(uiSource, /const \[prevalences, setPrevalences\] = useState<InterviewPrevalenceFilter\[]>\(\[\]\)/);
  assert.match(uiSource, /const \[starredOnly, setStarredOnly\] = useState\(false\)/);
  assert.match(uiSource, /const isStarred = Boolean\(stars\[item\.id\]\);/);
  assert.match(uiSource, /const matchesPrevalence = prevalences\.length === 0 \|\| prevalences\.includes\(item\.prevalence\);/);
  assert.match(uiSource, /const matchesStarred = !starredOnly \|\| \(mode === "personal" && isStarred\);/);
  assert.match(uiSource, /iq-star-filter/);
  assert.match(uiSource, />Starred only</);
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
  const filterGrid = uiSource.slice(uiSource.indexOf('iq-filter-grid${mode === "personal"'), uiSource.indexOf('<div className="iq-list">'));
  assert.ok(filterGrid.indexOf('label="Sort"') < filterGrid.indexOf('label="Prevalence"'), "Sort must appear before Prevalence.");
  assert.doesNotMatch(filterGrid.match(/label="Prevalence"[^\n]+/)?.[0] ?? "", /selectionMode="single"/);
  assert.match(uiSource, /Personal progress/);
  assert.match(routeSource, /interview-progress/);
  assert.match(schemaSource, /sqliteTable\("interview_progress"/);
  assert.doesNotMatch(uiSource, /Manage statuses & feedback/);
  assert.match(uiSource, /aria-label=\{stars\[item\.id\] \? "Remove your star" : "Star this question"\}/);
  assert.doesNotMatch(uiSource, /Personal star</);
  assert.match(routeSource, /interview-stars/);
  assert.match(stylesSource, /\.iq-star-icon\.active \{/);

  for (const label of ["About this site", "Vacancies", "My Resume", "Interview questions", "AI Assistant", "Trends", "Performance & reliability", "Observability & SRE", "Networking", "Linux & shell", "Generative AI & LLM", "Embedded & IoT QA", "News", "Fight AI slop"]) {
    assert.match(navigationSource, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(navigationSource, /id: "career",[\s\S]*?label: "Career",[\s\S]*?id: "jobs"[\s\S]*?id: "resume"[\s\S]*?id: "interview"[\s\S]*?id: "ai-assistant"[\s\S]*?id: "trends"/);
  assert.match(navigationSource, /id: "learning",[\s\S]*?label: "Learning path"/);
  assert.match(navigationSource, /id: "misc",[\s\S]*?label: "Misc",[\s\S]*?id: "news"[\s\S]*?id: "rewild"/);
  assert.match(stylesSource, /\.kb-area-group-career/);
  assert.match(stylesSource, /\.kb-area-group-learning/);
  assert.match(stylesSource, /\.kb-area-group-misc/);
  assert.match(stylesSource, /\.kb-nav-intro/);
  assert.match(stylesSource, /\.kb-navigation \.kb-nav-list \.kb-nav-link \{[^}]*font-size: 12px/);
  assert.match(stylesSource, /\.about-tech-purpose-card p \{[^}]*font-size: 11px/);
  assert.match(stylesSource, /\.rw-controls p \{[^}]*font-size: 12px/);
  assert.match(stylesSource, /\.rw-guide-grid p \{[^}]*font-size: 12px/);
  assert.match(stylesSource, /\.rw-guide-list p \{[^}]*font-size: 11px/);
  assert.doesNotMatch(privateJobsSource, /company-mark/);
  assert.doesNotMatch(uiSource, /kb-company-mark/);
  assert.doesNotMatch(stylesSource, /\.job-card\s*\{[^}]*grid-template-columns:\s*\d+px/);
  assert.doesNotMatch(stylesSource, /\.detail-head\s*\{[^}]*grid-template-columns:\s*\d+px/);
  assert.doesNotMatch(stylesSource, /\.kb-job-row\s*\{[^}]*grid-template-columns:\s*\d+px/);
  assert.match(stylesSource, /\.kb-job-action-stack > a \{/);
  assert.match(privateJobsSource, /createLocalAgentApiResolver/);
  assert.match(privateJobsSource, /const base = await apiBase\(\)/);
  assert.match(privateJobsSource, /fetch\(`\$\{base\}\$\{path\}`/);
  assert.match(privateJobsSource, /import\.meta\.env\.VITE_JOB_AGENT_PORT/);
  assert.match(privateJobsSource, /import\.meta\.env\.VITE_JOB_AGENT_INSTANCE_ID/);
  assert.match(privateJobsSource, /className="job-card"\s*\n\s*role="button"/);
  assert.match(privateJobsSource, /className="back-link" onClick=\{\(\) => setSelectedId\(null\)\}/);
  assert.match(privateJobsSource, /id="selected-vacancy-detail" role="region"/);
  assert.match(privateJobsSource, /aria-label="Search vacancies"/);
  assert.match(privateJobsSource, /className="toast" role="status" aria-live="polite"/);
  assert.match(uiSource, /window\.location\.assign\(sectionNavigationHref\(next, effectiveMode\)\)/);
  assert.ok(navigationSource.indexOf('id: "about"') < navigationSource.indexOf('id: "career"'), "About this site must be the first navigation item.");
  assert.ok(navigationSource.indexOf('id: "trends"') < navigationSource.indexOf('id: "certifications"'), "The Career group must come before the Learning path.");
  assert.ok(navigationSource.indexOf('id: "interview"') < navigationSource.indexOf('id: "ai-assistant"'), "AI Assistant must follow Interview questions.");
  assert.ok(navigationSource.indexOf('id: "ai-assistant"') < navigationSource.indexOf('id: "trends"'), "AI Assistant must remain inside the Career group.");
  assert.ok(navigationSource.indexOf('id: "interview"') < navigationSource.indexOf('id: "certifications"'), "Learning path must follow Interview questions.");
  assert.ok(navigationSource.indexOf('id: "certifications"') < navigationSource.indexOf('id: "llm"'), "Certs & Trainings must lead the Learning path.");
  assert.ok(navigationSource.indexOf('id: "llm"') < navigationSource.indexOf('id: "agentic"'), "AI agents must follow Generative AI.");
  assert.ok(navigationSource.indexOf('id: "standards"') < navigationSource.indexOf('id: "strategy"'), "Strategy & leadership must be the final Learning path item.");
  assert.ok(navigationSource.indexOf('id: "news"') < navigationSource.indexOf('id: "rewild"'), "Fight AI slop must be the final section above the view switch.");
  assert.match(uiSource, /if \(section === "about"\) return <AboutSite mode=\{mode\}\/>/);
  assert.match(uiSource, /if \(section === "resume"\) return <ResumePage mode=\{mode\}\/>/);
  assert.match(uiSource, /const hideSecondary = section === "about" \|\| section === "resume" \|\| section === "rewild"/);
  assert.match(uiSource, /const section = useMemo\(\(\) => resolveSection\(pathname, hash\), \[pathname, hash\]\)/);
  assert.match(aboutSource, /View source on GitHub/);
  assert.match(aboutSource, /const interviewHref = sectionNavigationHref\("interview", mode\)/);
  assert.doesNotMatch(aboutSource, /#interview/);
  assert.match(aboutSource, /ABOUT_OVERVIEW\.title/);
  assert.match(aboutSource, /DEPLOYMENT\.title/);
  assert.match(aboutSource, /DATABASE\.title/);
  assert.match(aboutSource, /OPENAI\.title/);
  assert.match(aboutSource, /GRAFANA\.title/);
  assert.match(aboutContentSource, /https:\/\/github\.com\/sergiiiavt\/gimme-job/);
  assert.doesNotMatch(aboutContentSource, /sergiiiavt\/gimmejob/);
  assert.match(aboutSource, /about-tech-purpose-grid/);
  assert.match(aboutSource, /about-tech-overview-heading/);
  assert.match(aboutSource, /FlowArrow/);
  assert.match(aboutSource, /TechNode/);
  assert.doesNotMatch(aboutSource, /about-tech-page-header/);
  assert.doesNotMatch(aboutSource, /production pet project/i);
  assert.doesNotMatch(aboutSource, /skills showcase/i);
  assert.doesNotMatch(aboutSource, /researched QA questions/);
  assert.doesNotMatch(aboutSource, /about-hero/);
  assert.match(gameSource, /How to fight AI slop/);
  assert.doesNotMatch(gameSource, /How to kill AI slop|Kill the feed/);
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
  assert.match(catalogOutput, /test-doubles-taxonomy/);
  assert.match(catalogOutput, /mcp-testing-workflows/);
  assert.match(catalogOutput, /good-requirement-quality-characteristics/);
  assert.match(catalogOutput, /test-estimation-technique-families/);

  const initialOutput = (await Promise.all(scripts.filter((file) => !catalogScripts.includes(file)).map((file) => readFile(new URL(file, assetDirectory), "utf8")))).join("\n");
  assert.doesNotMatch(initialOutput, /testing-purpose-and-limits/);
  assert.doesNotMatch(initialOutput, /data-source-target-lineage/);
  assert.doesNotMatch(initialOutput, /monitoring-versus-observability/);
  assert.doesNotMatch(initialOutput, /embedded-layered-test-strategy/);
  assert.doesNotMatch(initialOutput, /test-doubles-taxonomy/);
  assert.doesNotMatch(initialOutput, /mcp-testing-workflows/);
  assert.doesNotMatch(initialOutput, /good-requirement-quality-characteristics/);
  assert.doesNotMatch(initialOutput, /test-estimation-technique-families/);
});
