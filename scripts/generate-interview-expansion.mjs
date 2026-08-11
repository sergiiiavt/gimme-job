import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`);

const addedSources = [
  { id: "katalon-qa-interviews", title: "QA Interview Questions: 60+ With Model Answers", url: "https://katalon.com/resources-center/blog/qa-interview-questions", publisher: "Katalon", kind: "Community question bank", role: "Prevalence signal for current QA, automation, leadership and scenario questions" },
  { id: "indeed-qa-interviews", title: "35 QA Interview Questions", url: "https://www.indeed.com/career-advice/interviewing/qa-interview-questions", publisher: "Indeed", kind: "Career question bank", role: "Prevalence signal for foundational, experience and practical interview prompts" },
  { id: "gfg-testing-interviews", title: "Software Testing Interview Questions and Answers", url: "https://www.geeksforgeeks.org/software-testing/software-testing-interview-questions/", publisher: "GeeksforGeeks", kind: "Community question bank", role: "Prevalence signal across manual, automation and technical testing topics" },
  { id: "istqb-ai-testing", title: "Certified Tester AI Testing (CT-AI)", url: "https://www.istqb.org/certifications/certified-tester-ai-testing-ct-ai/", publisher: "ISTQB", kind: "Official syllabus", role: "AI-system quality characteristics, ML testing and use of AI in testing" },
  { id: "openai-evals", title: "Evaluation best practices", url: "https://developers.openai.com/api/docs/guides/evaluation-best-practices", publisher: "OpenAI", kind: "Official documentation", role: "LLM evaluation design, datasets, graders, continuous evaluation and human calibration" },
  { id: "nist-genai-profile", title: "AI RMF Generative AI Profile", url: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence", publisher: "NIST", kind: "Risk framework", role: "Generative-AI trustworthiness, risk identification, measurement and governance" },
  { id: "owasp-llm-top10", title: "OWASP Top 10 for LLM Applications", url: "https://genai.owasp.org/llm-top-10/", publisher: "OWASP", kind: "Security reference", role: "Prompt injection, data disclosure, excessive agency and other LLM-specific risks" },
  { id: "sklearn-model-evaluation", title: "Model selection and evaluation", url: "https://scikit-learn.org/stable/model_selection.html", publisher: "scikit-learn", kind: "Official documentation", role: "Cross-validation, metrics, threshold selection and model-evaluation pitfalls" },
  { id: "powerbi-star-schema", title: "Understand star schema and its importance for Power BI", url: "https://learn.microsoft.com/en-us/power-bi/guidance/star-schema", publisher: "Microsoft", kind: "Official guidance", role: "Facts, dimensions, grain, relationships and semantic-model quality" },
  { id: "dbt-data-tests", title: "Add data tests to your DAG", url: "https://docs.getdbt.com/docs/build/data-tests", publisher: "dbt Labs", kind: "Official documentation", role: "Reusable assertions for analytics transformations and data contracts" },
  { id: "google-dataflow-testing", title: "Develop and test Dataflow pipelines", url: "https://cloud.google.com/dataflow/docs/guides/develop-and-test-pipelines", publisher: "Google Cloud", kind: "Official documentation", role: "Unit, integration and end-to-end testing for batch and streaming pipelines" },
  { id: "great-expectations", title: "Great Expectations Core", url: "https://docs.greatexpectations.io/docs/core/introduction/try_gx/", publisher: "Great Expectations", kind: "Official documentation", role: "Data-quality expectations, validation definitions and evidence" },
  { id: "opentelemetry-concepts", title: "OpenTelemetry concepts", url: "https://opentelemetry.io/docs/concepts/", publisher: "OpenTelemetry", kind: "Official documentation", role: "Traces, metrics, logs, context propagation and instrumentation" },
  { id: "prometheus-alerting", title: "Prometheus alerting practices", url: "https://prometheus.io/docs/practices/alerting/", publisher: "Prometheus", kind: "Official documentation", role: "Symptom-based actionable alerts, metamonitoring and noise reduction" },
  { id: "kubernetes-probes", title: "Configure liveness, readiness and startup probes", url: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/", publisher: "Kubernetes", kind: "Official documentation", role: "Service health, traffic readiness, recovery and probe failure modes" },
  { id: "grafana-loki", title: "Grafana Loki documentation", url: "https://grafana.com/docs/loki/latest/", publisher: "Grafana Labs", kind: "Official documentation", role: "Production log collection, queries, correlation and alerting" },
  { id: "fda-csa", title: "Computer Software Assurance for Production and Quality Management System Software", url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/computer-software-assurance-production-and-quality-management-system-software", publisher: "US FDA", kind: "Regulatory guidance", role: "Risk-based assurance and objective evidence for quality-system software" },
  { id: "fda-iec-62304", title: "FDA recognition of IEC 62304", url: "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfStandards/detail.cfm?standard__identification_no=38829", publisher: "US FDA", kind: "Recognized standard", role: "Medical-device software lifecycle processes, safety classification and maintenance" },
  { id: "ecfr-part-11", title: "21 CFR Part 11 — Electronic Records; Electronic Signatures", url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11", publisher: "US eCFR", kind: "Regulation", role: "Electronic records, signatures, access, audit trails and system controls" },
  { id: "eu-gmp-annex-11", title: "EudraLex Volume 4, Annex 11 — Computerised Systems", url: "https://health.ec.europa.eu/medicinal-products/eudralex/eudralex-volume-4_en", publisher: "European Commission", kind: "Regulatory guidance", role: "GMP computerized-system validation, data integrity, change and continuity controls" },
  { id: "iso-26262", title: "ISO 26262 — Road vehicles functional safety", url: "https://www.iso.org/standard/68383.html", publisher: "ISO", kind: "International standard", role: "Automotive functional-safety lifecycle, risk classification and verification" },
  { id: "pci-dss", title: "Payment Card Industry Data Security Standard", url: "https://www.pcisecuritystandards.org/standards/pci-dss/", publisher: "PCI Security Standards Council", kind: "Industry standard", role: "Payment-data security controls, testing evidence and continuous compliance" },
  { id: "owasp-asvs", title: "OWASP Application Security Verification Standard", url: "https://owasp.org/www-project-application-security-verification-standard/", publisher: "OWASP", kind: "Verification standard", role: "Testable application-security requirements and assurance levels" },
  { id: "fda-samd", title: "Software as a Medical Device (SaMD)", url: "https://www.fda.gov/medical-devices/digital-health-center-excellence/software-medical-device-samd", publisher: "US FDA", kind: "Regulatory guidance", role: "Risk categorization, clinical evaluation and quality expectations for medical software" },
];

const topics = [
  {
    id: "fundamentals", label: "Fundamentals", category: "Fundamentals", target: 29,
    description: "Testing purpose, principles, levels, types and terminology.",
    concepts: ["testing objectives", "verification and validation", "test levels", "functional and non-functional quality", "static and dynamic testing", "regression and confirmation testing", "test independence"],
    scenarios: ["on a fast-moving product with incomplete requirements", "when the team has one day before release", "for a feature shared by several services", "after a high-impact production defect", "when stakeholders disagree about acceptable quality"],
    sources: ["istqb-ctfl-v4", "katalon-qa-interviews", "indeed-qa-interviews", "gfg-testing-interviews"], tags: ["fundamentals", "testing-theory"],
    start: "clarifying the user goal, product context and decision the test evidence must support", oracle: "observable requirements, user outcomes and credible comparison sources", coverage: "positive, negative, boundary and change-related risks", evidence: "the residual risk is explicit and the agreed acceptance criteria have objective evidence", signals: ["distinguishes evidence from proof", "connects terminology to a practical decision"],
  },
  {
    id: "test-design", label: "Test design", category: "Test design", target: 29,
    description: "Black-box, white-box and experience-based techniques.",
    concepts: ["equivalence partitions", "boundary values", "decision tables", "state transitions", "pairwise combinations", "branch coverage", "exploratory charters"],
    scenarios: ["for a rule-heavy pricing flow", "with many interacting inputs", "where historical defects cluster", "under a strict execution budget", "when requirements contain examples but no formal rules"],
    sources: ["istqb-ctfl-v4", "dou-qa-2022", "katalon-qa-interviews"], tags: ["test-design", "coverage"],
    start: "modelling the behavior and choosing techniques that expose distinct defect classes", oracle: "explicit rules, state models and independently calculated expected outcomes", coverage: "representative partitions, edges, combinations and error paths without redundant cases", evidence: "coverage is traceable to the model and important residual gaps are documented", signals: ["selects techniques for a reason", "reduces cases without hiding risk"],
  },
  {
    id: "documentation-defects", label: "Documentation & defects", category: "Documentation and defects", target: 29,
    description: "Test artifacts, defect lifecycle, reviews and traceability.",
    concepts: ["test plans", "test cases and checklists", "requirements traceability", "defect reports", "defect triage", "review findings", "test summaries"],
    scenarios: ["across several teams and releases", "when evidence must survive an audit", "for a defect that cannot be reproduced reliably", "when requirements change during execution", "with remote stakeholders who need concise decisions"],
    sources: ["istqb-ctfl-v4", "istqb-glossary", "dora"], tags: ["documentation", "defects"],
    start: "identifying who will use the artifact and which decision or handoff it must enable", oracle: "versioned requirements, reproducible observations and agreed workflow states", coverage: "ownership, traceability, evidence, exceptions and closure criteria", evidence: "another person can reproduce the result and understand the remaining risk without private context", signals: ["keeps documentation decision-focused", "preserves traceability and reproducibility"],
  },
  {
    id: "web-api-data", label: "Web, API & data", category: "Web, API and data", target: 29,
    description: "HTTP, browsers, services, integrations, databases and SQL.",
    concepts: ["HTTP caching and conditional requests", "REST resource contracts", "GraphQL schemas and resolvers", "authentication and sessions", "database transactions", "eventual consistency", "browser storage and cookies"],
    scenarios: ["behind retries and a CDN", "with backward-compatible clients", "during concurrent updates", "when a downstream dependency degrades", "with tenant-scoped sensitive data"],
    sources: ["mdn-http", "openapi-31", "graphql-spec", "postgres-docs", "owasp-api-2023"], tags: ["web", "api", "data"],
    start: "mapping the request, state changes, dependencies and trust boundaries end to end", oracle: "protocol semantics, the published contract and authoritative persisted state", coverage: "status codes, schemas, idempotency, concurrency, authorization and failure recovery", evidence: "client-visible behavior and stored data remain consistent across retries and partial failures", signals: ["checks both contract and side effects", "includes concurrency and authorization"],
  },
  {
    id: "mobile", label: "Mobile", category: "Mobile", target: 29,
    description: "Android, iOS, devices, lifecycle, networks and releases.",
    concepts: ["application lifecycle transitions", "device and OS fragmentation", "permissions and privacy", "offline synchronization", "push notifications", "deep links", "store release upgrades"],
    scenarios: ["while the network switches between Wi-Fi and cellular", "under low memory and low battery", "after the app is killed in the background", "across an old and a current OS version", "with interrupted installation or migration"],
    sources: ["android-test", "appium-docs", "fda-samd"], tags: ["mobile", "devices"],
    start: "selecting a risk-based device matrix and controlling lifecycle, network and account state", oracle: "platform guidance, synchronized server state and visible user feedback", coverage: "interruptions, permissions, resource pressure, upgrades and recovery", evidence: "critical flows preserve data and give correct feedback on representative real devices", signals: ["uses a justified device matrix", "tests interruptions and recovery"],
  },
  {
    id: "automation-ci", label: "Automation & CI", category: "Automation and CI", target: 29,
    description: "Automation strategy, frameworks, UI tools and pipelines.",
    concepts: ["automation scope", "stable locators", "test isolation", "wait strategies", "parallel execution", "flaky-test management", "pipeline quality gates"],
    scenarios: ["for a rapidly changing user interface", "across pull requests and nightly suites", "when third-party services are unreliable", "with a ten-minute feedback target", "while migrating between test frameworks"],
    sources: ["playwright-best-practices", "selenium-docs", "dora", "katalon-qa-interviews"], tags: ["automation", "ci"],
    start: "choosing checks by feedback value, repeatability and maintenance cost rather than automation percentage", oracle: "deterministic assertions at the lowest useful layer", coverage: "isolation, synchronization, diagnostics, parallel safety and quarantine rules", evidence: "the suite gives fast reproducible failures and its ownership cost stays visible", signals: ["optimizes the feedback loop", "treats flakiness as a defect"],
  },
  {
    id: "programming", label: "Programming", category: "Programming", target: 29,
    description: "Code design, OOP, patterns, concurrency and maintainability.",
    concepts: ["functions and side effects", "object composition", "error handling", "asynchronous code", "data structures", "dependency injection", "code review for testability"],
    scenarios: ["inside a shared test library", "when operations can fail or time out", "under parallel execution", "with inputs from an untrusted API", "while refactoring without changing behavior"],
    sources: ["git-docs", "playwright-best-practices", "selenium-docs"], tags: ["programming", "test-code"],
    start: "making inputs, outputs, ownership and failure behavior explicit before choosing an implementation", oracle: "small deterministic units plus integration behavior at real boundaries", coverage: "normal flow, invalid inputs, exceptions, concurrency and resource cleanup", evidence: "tests fail for one understandable reason and the code remains easy to change", signals: ["controls side effects and dependencies", "designs for deterministic tests"],
  },
  {
    id: "infrastructure", label: "Infrastructure", category: "Infrastructure", target: 29,
    description: "Git, containers, cloud, Linux, networking and environments.",
    concepts: ["container images", "service discovery and DNS", "environment configuration", "secrets and identity", "infrastructure changes", "network policies", "resource limits"],
    scenarios: ["across development, staging and production", "during a rolling deployment", "when a dependency is reachable only intermittently", "under constrained CPU and memory", "after configuration drift is discovered"],
    sources: ["docker-docs", "git-docs", "kubernetes-probes", "google-sre"], tags: ["infrastructure", "devops"],
    start: "treating configuration and infrastructure as versioned product behavior with observable dependencies", oracle: "declared configuration, health signals and known-good environment baselines", coverage: "startup, connectivity, permissions, capacity, rollout and rollback", evidence: "the environment is reproducible and failure behavior is diagnosable before user impact", signals: ["checks configuration as code", "covers rollout and rollback"],
  },
  {
    id: "performance-resilience", label: "Performance & resilience", category: "Performance and resilience", target: 29,
    description: "Load models, bottlenecks, reliability and recovery.",
    concepts: ["load models", "latency percentiles", "capacity limits", "timeouts and retries", "circuit breakers", "failover", "recovery objectives"],
    scenarios: ["at normal and peak traffic", "during a downstream slowdown", "with bursty arrivals", "after a regional or instance failure", "while a backlog grows faster than it drains"],
    sources: ["k6-docs", "google-sre", "prometheus-alerting", "opentelemetry-concepts"], tags: ["performance", "resilience"],
    start: "turning business demand and reliability expectations into a representative workload and measurable hypothesis", oracle: "service-level objectives, resource telemetry and correctness under load", coverage: "steady, spike, stress, soak, degradation and recovery behavior", evidence: "thresholds are met without hidden errors, data loss or unsafe retry amplification", signals: ["models realistic workload", "correlates latency with resources and correctness"],
  },
  {
    id: "security-accessibility", label: "Security & accessibility", category: "Security and accessibility", target: 29,
    description: "Application security, authorization, privacy and WCAG.",
    concepts: ["object-level authorization", "session management", "input handling", "sensitive-data exposure", "keyboard navigation", "focus management", "accessible names and status messages"],
    scenarios: ["across user roles and tenants", "after authentication state changes", "with malicious and malformed input", "using only a keyboard and screen reader", "when an error occurs in a dynamic form"],
    sources: ["owasp-wstg", "owasp-api-2023", "owasp-asvs", "wcag-22"], tags: ["security", "accessibility"],
    start: "mapping assets, actors, trust boundaries and assistive-technology interactions", oracle: "explicit authorization rules, secure defaults and WCAG success criteria", coverage: "misuse, privilege changes, data leakage, keyboard flow and perceivable feedback", evidence: "unauthorized actions fail safely and critical tasks remain operable without a mouse or visual cues", signals: ["tests server-side authorization", "uses accessibility criteria rather than visual opinion"],
  },
  {
    id: "agile-delivery", label: "Agile & delivery", category: "Agile and delivery", target: 29,
    description: "Scrum, Kanban, shift-left and continuous delivery.",
    concepts: ["refinement", "definition of done", "small-batch delivery", "work-in-progress limits", "release trains", "feature flags", "continuous testing"],
    scenarios: ["when scope changes mid-iteration", "with several teams sharing one service", "under pressure to shorten lead time", "when unfinished work spans releases", "after escaped defects increase"],
    sources: ["scrum-guide", "dora", "istqb-ctfl-v4"], tags: ["agile", "delivery"],
    start: "making quality work visible in the delivery flow and moving feedback to the earliest useful point", oracle: "shared acceptance criteria, done policies and production outcomes", coverage: "discovery, implementation, integration, deployment and learning loops", evidence: "the team shortens feedback without transferring unowned risk downstream", signals: ["quality remains a team responsibility", "connects process changes to outcomes"],
  },
  {
    id: "strategy-risk", label: "Strategy & risk", category: "Strategy and risk", target: 29,
    description: "Quality strategy, estimation, metrics and release risk.",
    concepts: ["product quality risks", "test estimation", "coverage strategy", "release criteria", "quality metrics", "test environment strategy", "technical-debt reduction"],
    scenarios: ["for a new product with little historical data", "when time is cut in half", "across a portfolio of services", "before a high-visibility launch", "when stakeholders request a single quality score"],
    sources: ["istqb-ctfl-v4", "dora", "google-sre", "katalon-qa-interviews"], tags: ["strategy", "risk"],
    start: "ranking product risks by impact and likelihood, then allocating feedback mechanisms to the biggest uncertainties", oracle: "business outcomes, architecture, incident history and measurable acceptance criteria", coverage: "people, process, product, environments and operational controls", evidence: "decision makers can see tested risk, residual risk, confidence and ownership", signals: ["prioritizes risk over test count", "uses metrics with context and guardrails"],
  },
  {
    id: "leadership", label: "Leadership", category: "Leadership", target: 29,
    description: "People, stakeholders, conflict, coaching and change.",
    concepts: ["quality ownership", "coaching", "stakeholder alignment", "conflict resolution", "hiring and onboarding", "capability planning", "leading an incident review"],
    scenarios: ["when delivery and quality goals appear to conflict", "with a distributed cross-functional team", "after trust has been damaged", "while introducing a major practice change", "when evidence is incomplete but a decision is due"],
    sources: ["google-structured-interviews", "dora", "scrum-guide"], tags: ["leadership", "people"],
    start: "framing the shared outcome, listening for constraints and making the decision process transparent", oracle: "observable team and product outcomes rather than activity or personal preference", coverage: "alignment, ownership, capability, feedback and follow-through", evidence: "people understand the decision, risks, next actions and how success will be measured", signals: ["uses a concrete evidence-based example", "balances empathy, clarity and accountability"],
  },
  {
    id: "practical", label: "Practical tasks", category: "Practical tasks", target: 29,
    description: "Scenario analysis and hands-on interview exercises.",
    concepts: ["a login form", "an elevator", "a payment checkout", "a file upload", "a search box", "a notification service", "a data import"],
    scenarios: ["with no written requirements", "during a thirty-minute interview exercise", "after one vague customer complaint", "with only production-like black-box access", "when only the highest risks can be demonstrated"],
    sources: ["dou-qa-2022", "katalon-qa-interviews", "indeed-qa-interviews", "gfg-testing-interviews"], tags: ["practical", "scenario"],
    start: "asking a few high-value questions, stating assumptions and building a compact risk model aloud", oracle: "user goals, invariants, comparable behavior and observable state changes", coverage: "happy paths, boundaries, misuse, dependencies and non-functional risks", evidence: "the interviewer can follow the prioritization and see how new information changes the plan", signals: ["states assumptions and questions", "prioritizes before listing cases"],
  },
  {
    id: "ai-ml-llm", label: "AI, ML & LLM", category: "AI, ML and LLM", target: 29,
    description: "Datasets, model metrics, generative evaluations, safety and AI-system operations.",
    concepts: ["training and evaluation data", "classification thresholds", "model drift", "LLM answer quality", "retrieval-augmented generation", "prompt injection defenses", "agent tool use"],
    scenarios: ["with imbalanced or sparse examples", "after a model or prompt change", "for a high-stakes user decision", "when outputs are non-deterministic", "with untrusted retrieved content and external tools"],
    sources: ["istqb-ai-testing", "openai-evals", "nist-genai-profile", "owasp-llm-top10", "sklearn-model-evaluation"], tags: ["ai", "ml", "llm"],
    start: "defining the intended behavior, affected groups, unacceptable harms and a representative frozen evaluation set", oracle: "task-specific rubrics, calibrated human judgment, reference data and invariant safety rules", coverage: "quality, robustness, bias, privacy, security, latency, cost and change regression", evidence: "segmented metrics and reviewed failures meet thresholds with monitoring for new production distributions", signals: ["uses representative evals instead of demos", "separates model, data and system failures"],
  },
  {
    id: "data-bi", label: "Data & BI", category: "Data and BI", target: 29,
    description: "Pipelines, warehouses, transformations, semantic models and analytical reports.",
    concepts: ["source-to-target mappings", "batch and streaming pipelines", "data quality rules", "slowly changing dimensions", "fact-table grain", "semantic-model measures", "dashboard filters and exports"],
    scenarios: ["with late, duplicate and out-of-order records", "after an upstream schema change", "across time zones and fiscal calendars", "when totals differ between reports", "with personally identifiable information in test data"],
    sources: ["postgres-docs", "powerbi-star-schema", "dbt-data-tests", "google-dataflow-testing", "great-expectations"], tags: ["data", "bi", "analytics"],
    start: "tracing lineage from source contracts through transformations to the business decision made from the output", oracle: "reconciled control totals, business definitions and versioned data contracts", coverage: "completeness, validity, uniqueness, freshness, referential integrity and aggregation grain", evidence: "results reconcile at each boundary and anomalies are observable without exposing sensitive records", signals: ["tests lineage and business semantics", "covers late and duplicate data"],
  },
  {
    id: "observability-production", label: "Observability & production", category: "Observability and production", target: 28,
    description: "Telemetry, health checks, deployment verification, incidents and operational learning.",
    concepts: ["structured logs", "service metrics", "distributed traces", "health probes", "alerts and dashboards", "deployment verification", "incident response"],
    scenarios: ["across a distributed request path", "during a canary rollout", "when failures are intermittent", "under a partial dependency outage", "after telemetry volume or cardinality suddenly grows"],
    sources: ["opentelemetry-concepts", "prometheus-alerting", "kubernetes-probes", "grafana-loki", "google-sre"], tags: ["observability", "production", "sre"],
    start: "starting from a user-visible symptom and ensuring telemetry can connect it to the responsible change and dependency", oracle: "service-level objectives, known test events and correlated logs, metrics and traces", coverage: "signal correctness, context propagation, sampling, alert routing, rollout and recovery", evidence: "a responder can detect, scope and diagnose the failure within the agreed operational target", signals: ["tests telemetry as product behavior", "prefers actionable symptom-based alerts"],
  },
  {
    id: "regulated-domains", label: "Regulated domains", category: "Regulated domains", target: 28,
    description: "Risk-based assurance, traceability, data integrity and safety-critical change control.",
    concepts: ["risk classification", "requirements traceability", "electronic records and signatures", "audit trails", "software lifecycle evidence", "change control", "supplier and third-party software"],
    scenarios: ["for medical or safety-related software", "when migrating validated data", "after a safety-impacting defect", "with an AI-enabled or configurable component", "during an inspection or independent assessment"],
    sources: ["fda-csa", "fda-iec-62304", "ecfr-part-11", "eu-gmp-annex-11", "iso-26262", "pci-dss", "fda-samd"], tags: ["regulated", "compliance", "safety"],
    start: "identifying intended use, applicable rules, hazards and the assurance rigor required by risk", oracle: "approved requirements, controlled records and independently reviewable objective evidence", coverage: "traceability, data integrity, access, auditability, change impact, anomalies and recovery", evidence: "each claim and control has attributable, legible, contemporaneous and reviewable evidence", signals: ["tailors rigor to documented risk", "protects traceability and data integrity"],
  },
];

const prevalenceByPosition = (position) => {
  if (position < 8) return "Very common";
  if (position < 17) return "Common";
  if (position < 24) return "Occasional";
  return "Specialist";
};

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const levelSequence = ["Junior", "Middle", "Middle", "Senior", "Senior", "Lead"];
const kinds = ["Scenario", "Risk analysis", "Test design", "Troubleshooting", "Automation", "Release decision"];
const questionTemplates = [
  (concept, scenario) => `How would you test ${concept} ${scenario}?`,
  (concept, scenario) => `Which risks and test oracles matter most when validating ${concept} ${scenario}?`,
  (concept, scenario) => `How would you design an efficient test strategy for ${concept} ${scenario}?`,
  (concept, scenario) => `What failure modes would you investigate first for ${concept} ${scenario}?`,
  (concept, scenario) => `How would you automate trustworthy checks for ${concept} ${scenario}?`,
  (concept, scenario) => `What evidence would you require before releasing ${concept} ${scenario}?`,
];

function generatedAnswer(topic, concept, scenario, index) {
  const openings = [
    `Start by ${topic.start}.`,
    `Prioritize the risks that could invalidate the user or business outcome, then ${topic.start}.`,
    `Build the smallest useful model of the behavior by ${topic.start}.`,
    `Reproduce the relevant state and dependencies, then ${topic.start}.`,
    `Automate only stable, repeatable observations after ${topic.start}.`,
    `Define the release decision first by ${topic.start}.`,
  ];
  return `${openings[index % openings.length]} For ${concept} ${scenario}, use ${topic.oracle} as the oracle and cover ${topic.coverage}. Keep data and dependencies controlled enough to reproduce failures. Release only when ${topic.evidence}.`;
}

const [common, expanded, currentSources] = await Promise.all([
  readJson("content/interview/common-qa.json"),
  readJson("content/interview/expanded-qa.json"),
  readJson("content/interview/sources.json"),
]);

const authoredExpandedQuestions = expanded.questions.filter((question) => !question.id.startsWith("expanded-"));
const baseQuestions = [...common.questions, ...authoredExpandedQuestions].map((question) => {
  const questionWithoutPrevalence = { ...question };
  delete questionWithoutPrevalence.prevalence;
  return questionWithoutPrevalence;
});
const byCategory = new Map(topics.map((topic) => [topic.category, []]));
for (const question of baseQuestions) {
  assert.ok(byCategory.has(question.category), `Unknown existing category: ${question.category}`);
  byCategory.get(question.category).push(question);
}

const generated = [];
for (const topic of topics) {
  const existingCount = byCategory.get(topic.category).length;
  const needed = topic.target - existingCount;
  assert.ok(needed >= 0, `${topic.category} already exceeds its target`);
  const combinations = topic.concepts.flatMap((concept) => topic.scenarios.map((scenario) => ({ concept, scenario })));
  assert.ok(combinations.length >= needed, `Not enough combinations for ${topic.category}`);

  for (let index = 0; index < needed; index += 1) {
    const { concept, scenario } = combinations[index];
    const templateIndex = index % questionTemplates.length;
    generated.push({
      id: `expanded-${topic.id}-${slug(concept)}-${slug(scenario)}`,
      level: levelSequence[(existingCount + index) % levelSequence.length],
      category: topic.category,
      kind: kinds[templateIndex],
      question: questionTemplates[templateIndex](concept, scenario),
      shortAnswer: generatedAnswer(topic, concept, scenario, index),
      strongAnswerSignals: [
        `explicit risk and test oracle for ${concept}`,
        ...topic.signals,
        "measurable evidence and residual-risk statement",
      ],
      tags: [...topic.tags, slug(concept)].slice(0, 4),
      sourceIds: topic.sources.slice(0, index % 4 === 0 ? 3 : 2),
    });
  }
}

assert.equal(generated.length, 400, "The expansion must add exactly 400 questions to the 120-question base.");

const generatedByCategory = new Map(topics.map((topic) => [topic.category, []]));
for (const question of generated) generatedByCategory.get(question.category).push(question);

function addPrevalence(questions) {
  const positions = new Map();
  return questions.map((question) => {
    const position = positions.get(question.category) ?? 0;
    positions.set(question.category, position + 1);
    return { ...question, prevalence: prevalenceByPosition(position) };
  });
}

const combinedEditorialOrder = [];
for (const topic of topics) {
  combinedEditorialOrder.push(...byCategory.get(topic.category), ...generatedByCategory.get(topic.category));
}
const enrichedById = new Map(addPrevalence(combinedEditorialOrder).map((question) => [question.id, question]));

common.questions = common.questions.map((question) => enrichedById.get(question.id));
expanded.questions = [
  ...authoredExpandedQuestions.map((question) => enrichedById.get(question.id)),
  ...generated.map((question) => enrichedById.get(question.id)),
];

const addedSourceIds = new Set(addedSources.map((source) => source.id));
const originalSources = currentSources.filter((source) => !addedSourceIds.has(source.id));
assert.equal(originalSources.length, 22, "The generator expects the researched 22-source base from PR #2.");
const sources = [...originalSources, ...addedSources];
assert.equal(sources.length, 46, "The catalog must contain exactly 46 sources.");

const taxonomy = [
  { id: "all", label: "All questions", description: "The complete canonical interview collection." },
  ...topics.map(({ id, label, category, description }) => ({ id, label, category, description })),
  { id: "methodology", label: "Sources & methodology", description: "Source analysis, prevalence model, editorial approach and maintenance rules." },
];

await Promise.all([
  writeJson("content/interview/common-qa.json", common),
  writeJson("content/interview/expanded-qa.json", expanded),
  writeJson("content/interview/sources.json", sources),
  writeJson("content/interview/taxonomy.json", taxonomy),
]);

console.log(`Generated ${common.questions.length + expanded.questions.length} questions across ${topics.length} topics with ${sources.length} sources.`);
