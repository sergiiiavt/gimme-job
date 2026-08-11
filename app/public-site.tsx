"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import AboutSite from "./about-site";
import ResumePage from "./resume-page";
import { navigationItems, SiteSidebar, type SiteSection, type SubnavItem } from "./site-navigation";

const RewildGame = lazy(() => import("./rewild-game"));

type PublicSection = SiteSection;
type SiteMode = "public" | "personal";
type QuestionProgressStatus = "PLANNED" | "LEARNING" | "LEARNED";

interface QuestionProgressEntry {
  questionId: string;
  status: QuestionProgressStatus;
  updatedAt: string;
}

interface PublicJob {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  applyUrl: string;
  description: string;
  salaryText: string | null;
  postedAt: string | null;
  discoveredAt: string;
}

type InterviewLevel = "Junior" | "Middle" | "Senior" | "Lead";
type InterviewPrevalence = "Very common" | "Common" | "Occasional" | "Specialist";
type InterviewSort = "prevalence" | "learning" | "level" | "alphabetical";

interface InterviewQuestion {
  id: string;
  level: InterviewLevel;
  prevalence: InterviewPrevalence;
  category: string;
  kind?: string;
  question: string;
  shortAnswer: string;
  strongAnswerSignals: string[];
  sourceIds: string[];
  tags?: string[];
  media?: Array<{ src: string; alt: string; caption: string; credit: string }>;
}

interface InterviewSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: string;
  role: string;
}

interface InterviewTaxonomyItem {
  id: string;
  label: string;
  category?: string;
  description: string;
}

interface InterviewCatalog {
  title: string;
  description: string;
  methodology: {
    coverage: string;
    answers: string;
    publishing: string;
    prevalence: string;
    media: string;
  };
  questions: InterviewQuestion[];
  sources: InterviewSource[];
  taxonomy: InterviewTaxonomyItem[];
}

const INTERVIEW_PAGE_SIZE = 60;
const interviewLevels: InterviewLevel[] = ["Junior", "Middle", "Senior", "Lead"];
const interviewPrevalence: InterviewPrevalence[] = ["Very common", "Common", "Occasional", "Specialist"];
const prevalenceOrder: Record<InterviewPrevalence, number> = { "Very common": 0, Common: 1, Occasional: 2, Specialist: 3 };
const levelOrder: Record<InterviewLevel, number> = { Junior: 0, Middle: 1, Senior: 2, Lead: 3 };
const progressOptions: Array<{ value: QuestionProgressStatus; label: string }> = [
  { value: "PLANNED", label: "Planned" },
  { value: "LEARNING", label: "Learning" },
  { value: "LEARNED", label: "Learned" },
];
const interviewSortOptions: Array<{ value: InterviewSort; label: string }> = [
  { value: "prevalence", label: "Most common first" },
  { value: "learning", label: "Learning path" },
  { value: "level", label: "Junior → Lead" },
  { value: "alphabetical", label: "Question A–Z" },
];

const fallbackTags: Record<string, string[]> = {
  Fundamentals: ["testing-theory", "core"],
  "Test design": ["test-design", "coverage"],
  "Documentation and defects": ["documentation", "defects"],
  "Web, API and data": ["web", "api", "data"],
  Mobile: ["mobile", "devices"],
  "Embedded and IoT": ["embedded", "firmware", "iot", "hardware"],
  "Automation and CI": ["automation", "ci"],
  Programming: ["programming", "test-code"],
  Infrastructure: ["infrastructure", "devops"],
  "Performance and resilience": ["performance", "resilience"],
  "Security and accessibility": ["security", "accessibility"],
  "Agile and delivery": ["agile", "delivery"],
  "Strategy and risk": ["strategy", "risk"],
  Leadership: ["leadership", "people"],
  "Practical tasks": ["practical", "scenario"],
  "AI, ML and LLM": ["ai", "ml", "llm"],
  "Databases, SQL and BI": ["database", "sql", "data", "bi", "analytics"],
  "Observability and production": ["observability", "production", "sre"],
  "Regulated domains": ["regulated", "compliance", "safety"],
};

function tagsFor(question: InterviewQuestion) {
  return question.tags?.length ? question.tags : fallbackTags[question.category] ?? ["qa"];
}

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesAllSearchTerms(query: string, values: string[]) {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  const searchable = normalizeSearch(values.join(" "));
  return terms.every((term) => searchable.includes(term));
}

function InterviewFilter<T extends string>({ emptyLabel, helpText, label, onChange, onOpenChange, open, options, searchable = false, selected, selectionMode = "multiple" }: {
  emptyLabel: string;
  helpText: string;
  label: string;
  onChange: (selected: T[]) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  options: Array<{ label: string; value: T }>;
  searchable?: boolean;
  selected: T[];
  selectionMode?: "multiple" | "single";
}) {
  const [optionQuery, setOptionQuery] = useState("");
  const needle = normalizeSearch(optionQuery);
  const visibleOptions = needle ? options.filter((option) => normalizeSearch(option.label).includes(needle)) : options;
  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const selectedLabel = selectedOptions.length === 0
    ? emptyLabel
    : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} selected`;
  const inputName = `iq-filter-${normalizeSearch(label).replace(/\s+/g, "-")}`;

  const select = (option: T) => {
    if (selectionMode === "single") {
      onChange([option]);
      onOpenChange(false);
      return;
    }
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  };

  return (
    <div className={`iq-filter-control${searchable ? " iq-filter-control-wide" : ""}`}>
      <details open={open} onToggle={(event) => {
        if (!event.currentTarget.open) setOptionQuery("");
        onOpenChange(event.currentTarget.open);
      }}>
        <summary aria-label={`${label}: ${selectedLabel}`}>
          <span className="iq-filter-summary-copy">
            <small>{label}</small>
            <strong>{selectedLabel}</strong>
          </span>
          <i className="iq-filter-chevron" aria-hidden="true">⌄</i>
        </summary>
        <div className="iq-filter-menu">
        {searchable && (
          <label className="iq-option-search">
            <span>⌕</span>
            <input value={optionQuery} onChange={(event) => setOptionQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`}/>
          </label>
        )}
        {selectionMode === "multiple" && (
          <label className={`iq-filter-option iq-filter-option-all${selected.length === 0 ? " active" : ""}`}>
            <input className="iq-filter-option-input" type="checkbox" checked={selected.length === 0} onChange={() => onChange([])}/>
            <i className="iq-filter-option-mark" aria-hidden="true">{selected.length === 0 ? "✓" : ""}</i>
            <span>{emptyLabel}</span>
          </label>
        )}
        <div className="iq-filter-options" role={selectionMode === "single" ? "radiogroup" : undefined} aria-label={selectionMode === "single" ? label : undefined}>
          {visibleOptions.map((option) => (
            <label className={`iq-filter-option${selectionMode === "single" ? " iq-filter-option-radio" : ""}${selected.includes(option.value) ? " active" : ""}`} key={option.value}>
              <input className="iq-filter-option-input" type={selectionMode === "single" ? "radio" : "checkbox"} name={selectionMode === "single" ? inputName : undefined} checked={selected.includes(option.value)} onChange={() => select(option.value)}/>
              <i className="iq-filter-option-mark" aria-hidden="true">{selected.includes(option.value) ? "✓" : ""}</i>
              <span>{option.label}</span>
            </label>
          ))}
          {visibleOptions.length === 0 && <span className="iq-option-empty">No matching options</span>}
        </div>
        <small>{helpText}</small>
        </div>
      </details>
    </div>
  );
}

function StructuredAnswer({ value }: { value: string }) {
  const paragraphs = value.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const sentences = paragraphs.length > 1
    ? paragraphs
    : Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(value), ({ segment }) => segment.trim()).filter(Boolean);

  if (sentences.length < 3) {
    return <div className="iq-answer-copy">{sentences.map((sentence) => <p key={sentence}>{sentence}</p>)}</div>;
  }

  return (
    <div className="iq-answer-copy">
      <p className="iq-answer-lead">{sentences[0]}</p>
      <ul className="iq-answer-points">{sentences.slice(1).map((sentence) => <li key={sentence}>{sentence}</li>)}</ul>
    </div>
  );
}

const knowledge: Record<Exclude<PublicSection, "about" | "jobs" | "resume" | "rewild">, {
  title: string;
  description: string;
  items: Array<{ title: string; copy: string; tags: string[] }>;
}> = {
  interview: {
    title: "Interview questions",
    description: "Structured preparation notes for technical, leadership, and behavioural interviews.",
    items: [
      { title: "QA leadership", copy: "Team coordination, mentoring, quality ownership, conflict handling, and stakeholder communication.", tags: ["Lead", "People"] },
      { title: "Test strategy", copy: "Risk-based testing, coverage, release criteria, metrics, and practical quality planning.", tags: ["Strategy", "Risk"] },
      { title: "Automation", copy: "Framework design, Playwright, Selenium, Pytest, maintainability, and CI execution.", tags: ["TypeScript", "Python"] },
      { title: "API and databases", copy: "HTTP, contracts, authentication, integration testing, SQL, and data validation.", tags: ["API", "SQL"] },
      { title: "System design", copy: "Testability, distributed systems, queues, caching, observability, and failure modes.", tags: ["Architecture"] },
      { title: "Behavioural questions", copy: "Project examples, difficult decisions, failures, improvements, and measurable outcomes.", tags: ["STAR", "Communication"] },
    ],
  },
  certifications: {
    title: "Certifications",
    description: "A practical map of certifications worth evaluating for QA leadership, cloud, security, and AI work.",
    items: [
      { title: "ISTQB", copy: "Testing foundations, advanced test management, automation, and specialist tracks.", tags: ["QA"] },
      { title: "Cloud", copy: "Azure and AWS fundamentals before role-specific engineering certifications.", tags: ["Azure", "AWS"] },
      { title: "Security", copy: "Application security, cloud security, and security-testing foundations.", tags: ["Security"] },
      { title: "AI engineering", copy: "Model, data, evaluation, and responsible-AI certification paths.", tags: ["AI", "LLM"] },
    ],
  },
  strategy: {
    title: "Quality strategy & leadership",
    description: "Move from executing tests to shaping risk, testability, delivery decisions, and team capability.",
    items: [
      { title: "Risk-based strategy", copy: "Connect product risks, architecture, users, and business impact to an intentional coverage model.", tags: ["Risk", "Strategy"] },
      { title: "Testability", copy: "Influence interfaces, diagnostics, environments, data controls, and design before testing becomes expensive.", tags: ["Design", "Quality"] },
      { title: "Release decisions", copy: "Communicate evidence, uncertainty, residual risk, ownership, and rollback options without false confidence.", tags: ["Release", "Evidence"] },
      { title: "Useful metrics", copy: "Measure feedback speed, escaped risk, reliability, and outcomes while avoiding activity-count targets.", tags: ["Metrics"] },
      { title: "Coaching and leadership", copy: "Grow judgement, ownership, collaboration, and technical depth across a quality-focused team.", tags: ["People", "Lead"] },
    ],
  },
  programming: {
    title: "Programming for QA",
    description: "The coding and debugging foundation needed for maintainable automation and deeper technical investigation.",
    items: [
      { title: "Code reading", copy: "Follow control flow, data flow, error paths, and dependencies well enough to identify meaningful checks.", tags: ["Code"] },
      { title: "Data structures", copy: "Choose and manipulate collections, maps, queues, trees, and structured data safely in test code.", tags: ["CS"] },
      { title: "Asynchronous systems", copy: "Reason about promises, threads, race conditions, retries, timeouts, and eventual completion.", tags: ["Async"] },
      { title: "Debugging", copy: "Reduce failures with logs, breakpoints, stack traces, minimal reproductions, and hypothesis-driven diagnosis.", tags: ["Debug"] },
      { title: "Git and review", copy: "Work with branches, focused commits, pull requests, conflict resolution, and constructive code review.", tags: ["Git"] },
    ],
  },
  automation: {
    title: "Test automation",
    description: "Design fast, reliable feedback systems across code, services, interfaces, and delivery pipelines.",
    items: [
      { title: "Automation strategy", copy: "Select checks by feedback value, repeatability, risk, execution layer, and maintenance cost.", tags: ["Strategy"] },
      { title: "Framework architecture", copy: "Build clear fixtures, drivers, assertions, reporting, configuration, and ownership boundaries.", tags: ["Architecture"] },
      { title: "Service and contract tests", copy: "Validate APIs, schemas, compatibility, side effects, and integration assumptions below the UI.", tags: ["API", "Contracts"] },
      { title: "Browser and mobile", copy: "Use stable locators, controlled state, deterministic waits, device coverage, and useful diagnostics.", tags: ["UI", "Mobile"] },
      { title: "CI reliability", copy: "Parallelize safely, investigate flakiness, manage quarantine, and keep failures actionable.", tags: ["CI", "Flakiness"] },
    ],
  },
  api: {
    title: "API & integration testing",
    description: "Understand protocols, contracts, trust boundaries, distributed state, and failure handling between systems.",
    items: [
      { title: "HTTP foundations", copy: "Methods, status codes, headers, caching, cookies, content negotiation, and idempotency.", tags: ["HTTP"] },
      { title: "Contracts and schemas", copy: "OpenAPI, GraphQL, compatibility, consumer expectations, and schema-based validation.", tags: ["Contracts"] },
      { title: "Identity and authorization", copy: "Authentication, sessions, scopes, roles, tenants, and server-side object access.", tags: ["Auth"] },
      { title: "Messaging and events", copy: "Queues, delivery semantics, ordering, duplication, retries, and eventual consistency.", tags: ["Events"] },
      { title: "Failure behaviour", copy: "Timeouts, partial responses, dependency degradation, rate limits, and safe recovery.", tags: ["Resilience"] },
    ],
  },
  data: {
    title: "Databases, SQL & BI testing",
    description: "Investigate relational data with SQL and validate integrity, transactions, pipelines, analytical meaning, governance, and decision-facing outputs.",
    items: [
      { title: "SQL foundations", copy: "Query, filter, join, aggregate, use subqueries and windows, and reason correctly about NULL and duplicates.", tags: ["SQL"] },
      { title: "Database integrity", copy: "Validate keys, constraints, normalization, transactions, isolation, locking, migrations, and recovery.", tags: ["Database"] },
      { title: "ETL and ELT", copy: "Test extraction, transformation rules, loading, incremental runs, backfills, and restart safety.", tags: ["Pipelines"] },
      { title: "Data quality", copy: "Measure completeness, validity, consistency, uniqueness, timeliness, and referential integrity.", tags: ["Quality"] },
      { title: "BI semantics and lineage", copy: "Verify measures, dimensions, filters, time zones, drill-downs, dashboard reconciliation, masking, and provenance.", tags: ["BI", "Governance"] },
    ],
  },
  mobile: {
    title: "Mobile & accessibility",
    description: "Cover device behaviour, platform lifecycle, constrained networks, assistive technology, and inclusive interaction.",
    items: [
      { title: "Device strategy", copy: "Build a risk-based matrix across hardware, operating systems, screens, locales, and user populations.", tags: ["Devices"] },
      { title: "Lifecycle and interruptions", copy: "Test backgrounding, process death, permissions, calls, notifications, battery, and storage pressure.", tags: ["Lifecycle"] },
      { title: "Network transitions", copy: "Exercise offline use, weak connections, Wi-Fi/cellular changes, retries, and synchronization conflicts.", tags: ["Network"] },
      { title: "Accessibility", copy: "Use WCAG criteria, keyboard and switch access, screen readers, focus, names, contrast, and status messages.", tags: ["WCAG"] },
      { title: "Release and upgrades", copy: "Validate store packaging, signing, installation, migration, deep links, and backward compatibility.", tags: ["Release"] },
    ],
  },
  embedded: {
    title: "Embedded & IoT QA",
    description: "Test firmware and connected devices where software, electronics, timing, power, networks, and physical behaviour meet.",
    items: [
      { title: "Layered test strategy", copy: "Balance fast host tests, native simulation, emulation, hardware-in-the-loop, and representative real-device evidence.", tags: ["Firmware", "HIL"] },
      { title: "Hardware interfaces", copy: "Validate GPIO, UART, I²C, SPI, CAN, sensors, actuators, electrical limits, timing, and protocol error handling.", tags: ["Hardware", "Protocols"] },
      { title: "Real-time behaviour", copy: "Measure deadlines, jitter, interrupt latency, scheduling, concurrency, watchdog recovery, and sustained resource pressure.", tags: ["RTOS", "Timing"] },
      { title: "Power and persistence", copy: "Interrupt boot, writes, updates, and shutdown at controlled points; verify atomicity, recovery, wear, and safe defaults.", tags: ["Power loss", "Flash"] },
      { title: "Firmware lifecycle", copy: "Test signed images, compatibility, migration, OTA interruption, rollback, downgrade protection, and fleet observability.", tags: ["OTA", "Bootloader"] },
      { title: "IoT security", copy: "Verify identity, configuration, interface access, data protection, secure updates, security state, and long-term support behaviour.", tags: ["IoT", "Security"] },
    ],
  },
  performance: {
    title: "Performance & reliability",
    description: "Model realistic workload, measure user outcomes, find constraints, and verify graceful degradation and recovery.",
    items: [
      { title: "Workload modelling", copy: "Translate traffic, user journeys, data volumes, arrival rates, and concurrency into realistic tests.", tags: ["Workload"] },
      { title: "Load test types", copy: "Use baseline, load, stress, spike, soak, volume, and scalability tests for distinct questions.", tags: ["Load"] },
      { title: "Service objectives", copy: "Connect latency, throughput, error rate, saturation, SLIs, SLOs, and business expectations.", tags: ["SLO"] },
      { title: "Bottleneck analysis", copy: "Correlate response time with CPU, memory, I/O, queues, databases, dependencies, and traces.", tags: ["Diagnosis"] },
      { title: "Resilience and recovery", copy: "Test overload controls, retries, circuit breakers, failover, restoration, and data correctness.", tags: ["Reliability"] },
    ],
  },
  trends: {
    title: "QA & market trends",
    description: "Patterns collected from vacancies, requirements, tools, and role descriptions.",
    items: [
      { title: "Role demand", copy: "Track recurring QA Lead, Test Automation Lead, Senior QA, and Quality Engineering roles.", tags: ["Roles"] },
      { title: "Skills and tools", copy: "Compare automation stacks, cloud platforms, AI expectations, and leadership requirements.", tags: ["Skills"] },
      { title: "Salary signals", copy: "Measure salary disclosure, location differences, and seniority signals when data is available.", tags: ["Salary"] },
      { title: "Resume signals", copy: "Connect common requirements to verified experience and identify useful learning gaps.", tags: ["Resume"] },
    ],
  },
  agentic: {
    title: "AI agents & MCP",
    description: "Notes and small projects for building agents that act through tools with explicit approval gates.",
    items: [
      { title: "Tools and actions", copy: "Typed tools, validation, permissions, retries, and safe external actions.", tags: ["Tools"] },
      { title: "State and memory", copy: "Session state, durable memory, retrieval, and boundaries between user and agent data.", tags: ["State"] },
      { title: "Approval workflows", copy: "Human confirmation before applications, messages, or any consequential action.", tags: ["Safety"] },
      { title: "Agent evaluation", copy: "Task success, trajectory checks, tool correctness, regression suites, and observability.", tags: ["Evals"] },
      { title: "MCP experiments", copy: "Small integrations for job sources, Gmail, GitHub, and structured knowledge.", tags: ["MCP"] },
      { title: "Pet projects", copy: "A portfolio backlog of narrow, testable agents instead of one uncontrolled system.", tags: ["Projects"] },
    ],
  },
  llm: {
    title: "Generative AI & LLM testing",
    description: "A testing and engineering knowledge base for products built around language models.",
    items: [
      { title: "LLM testing", copy: "Functional behaviour, robustness, safety, consistency, and model-change regression.", tags: ["Testing"] },
      { title: "Evaluations", copy: "Datasets, rubrics, model graders, human review, thresholds, and experiment tracking.", tags: ["Evals"] },
      { title: "RAG", copy: "Retrieval quality, grounding, citations, chunking, permissions, and freshness.", tags: ["RAG"] },
      { title: "Prompt security", copy: "Prompt injection, data leakage, tool misuse, and layered mitigations.", tags: ["Security"] },
      { title: "Observability", copy: "Traces, token usage, latency, failures, feedback, and production diagnostics.", tags: ["Ops"] },
      { title: "Pet projects", copy: "Practical QA copilots, test generators, review tools, and evaluation harnesses.", tags: ["Projects"] },
    ],
  },
  security: {
    title: "Security testing",
    description: "Practical application-security notes and controlled exercises for quality engineers.",
    items: [
      { title: "OWASP", copy: "Web, API, and LLM application risks with testing ideas and mitigations.", tags: ["OWASP"] },
      { title: "Threat modelling", copy: "Assets, trust boundaries, abuse cases, controls, and residual risk.", tags: ["Risk"] },
      { title: "Authentication", copy: "Sessions, OAuth, access control, identity boundaries, and negative testing.", tags: ["Auth"] },
      { title: "Secrets and data", copy: "Credential handling, sensitive data, logging, retention, and least privilege.", tags: ["Data"] },
    ],
  },
  devops: {
    title: "Cloud & DevOps",
    description: "Reference notes and projects for delivery pipelines, cloud systems, and reliability.",
    items: [
      { title: "CI/CD", copy: "Build gates, test stages, artifacts, deployments, rollbacks, and branch controls.", tags: ["Pipelines"] },
      { title: "Containers", copy: "Docker images, compose environments, dependencies, and test execution.", tags: ["Docker"] },
      { title: "Cloud", copy: "Workers, serverless services, storage, networking, and environment configuration.", tags: ["Cloud"] },
      { title: "Observability", copy: "Logs, metrics, traces, alerts, dashboards, and actionable diagnostics.", tags: ["Monitoring"] },
      { title: "Infrastructure as code", copy: "Repeatable environments, reviewable changes, drift, and secret separation.", tags: ["IaC"] },
      { title: "Resilience", copy: "Failure injection, dependency degradation, recovery, and reliability checks.", tags: ["Resilience"] },
    ],
  },
  observability: {
    title: "Observability & SRE",
    description: "Use production signals and reliability practices to test what users experience and shorten diagnosis.",
    items: [
      { title: "Logs, metrics and traces", copy: "Understand what each signal explains and correlate them with shared context across a request path.", tags: ["Telemetry"] },
      { title: "SLIs, SLOs and error budgets", copy: "Turn user-visible reliability into measurable indicators, targets, and explicit trade-offs.", tags: ["SRE"] },
      { title: "Distributed tracing", copy: "Follow spans, dependencies, latency, errors, retries, and context propagation across services.", tags: ["Tracing"] },
      { title: "Alert quality", copy: "Prefer actionable symptoms, meaningful thresholds, ownership, and runbooks over noisy infrastructure alarms.", tags: ["Alerts"] },
      { title: "Production verification", copy: "Use canaries, synthetic checks, feature flags, safe probes, and incident learning without exposing users.", tags: ["Production"] },
    ],
  },
  networking: {
    title: "Networking fundamentals",
    description: "Build the protocol knowledge needed to diagnose failures that application-only testing cannot explain.",
    items: [
      { title: "TCP/IP", copy: "Addresses, ports, packets, connections, retransmission, latency, loss, routing, and common failure patterns.", tags: ["TCP/IP"] },
      { title: "DNS", copy: "Resolution, record types, caching, TTLs, propagation, split-horizon behaviour, and diagnostic tools.", tags: ["DNS"] },
      { title: "TLS", copy: "Certificates, trust chains, hostnames, expiry, protocol negotiation, and secure connection failures.", tags: ["TLS"] },
      { title: "HTTP path", copy: "Clients, proxies, CDNs, load balancers, gateways, services, caching, and request correlation.", tags: ["HTTP"] },
      { title: "Troubleshooting", copy: "Use curl, dig, traceroute, packet capture, connection statistics, and controlled comparisons.", tags: ["Tools"] },
    ],
  },
  linux: {
    title: "Linux & shell",
    description: "Operate and troubleshoot the environments where test systems, services, containers, and CI jobs actually run.",
    items: [
      { title: "Filesystem and permissions", copy: "Navigate paths, inspect ownership, manage permissions, find files, and understand mounts and storage.", tags: ["Filesystem"] },
      { title: "Processes and services", copy: "Inspect processes, signals, resource use, environment variables, startup, and service health.", tags: ["Processes"] },
      { title: "Logs and text tools", copy: "Search and transform evidence with journal tools, grep, sed, awk, sort, diff, and structured output.", tags: ["CLI"] },
      { title: "Network tools", copy: "Inspect sockets, DNS, routes, HTTP, certificates, and connectivity from the host running the software.", tags: ["Network"] },
      { title: "Shell automation", copy: "Write safe, composable scripts with quoting, exit handling, pipes, parameters, and deterministic output.", tags: ["Bash"] },
    ],
  },
  standards: {
    title: "Standards & compliance",
    description: "A working index of standards relevant to software quality, security, and regulated products.",
    items: [
      { title: "ISO/IEC 25010", copy: "Software product quality model and quality characteristics.", tags: ["Quality"] },
      { title: "ISO/IEC/IEEE 29119", copy: "Software-testing processes, documentation, and techniques.", tags: ["Testing"] },
      { title: "ISO/IEC 27001", copy: "Information-security management systems and risk-based controls.", tags: ["Security"] },
      { title: "IEC 62304", copy: "Medical-device software lifecycle processes and safety classification.", tags: ["Medical"] },
      { title: "IEC 60601", copy: "Safety and essential performance requirements for medical electrical equipment.", tags: ["Medical"] },
      { title: "ISO 9001", copy: "Quality-management principles, processes, evidence, and improvement.", tags: ["QMS"] },
    ],
  },
  news: {
    title: "Industry news",
    description: "Links and notes about QA, AI agents, LLM engineering, security, and delivery tooling.",
    items: [
      { title: "QA and test automation", copy: "Framework releases, quality-engineering practices, and useful case studies.", tags: ["QA"] },
      { title: "Agents and LLMs", copy: "Agent platforms, model releases, evaluation research, and applied engineering.", tags: ["AI"] },
      { title: "Security", copy: "Important vulnerabilities, guidance, and defensive engineering updates.", tags: ["Security"] },
      { title: "Cloud and DevOps", copy: "Platform changes, CI/CD tooling, reliability, and observability updates.", tags: ["DevOps"] },
    ],
  },
};

function dateLabel(value: string | null) {
  if (!value) return "Recently found";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently found";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function displayText(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function shortText(value: string) {
  const cleaned = displayText(value).replace(/\s+/g, " ").trim();
  return cleaned.length > 210 ? `${cleaned.slice(0, 207)}…` : cleaned;
}

function currentSectionFromLocation(mode: SiteMode): PublicSection {
  if (typeof window === "undefined") return mode === "personal" ? "interview" : "about";
  const candidate = (mode === "personal"
    ? new URLSearchParams(window.location.search).get("section")
    : window.location.hash.replace("#", "")) as PublicSection | null;
  return candidate && navigationItems.some((item) => item.id === candidate) ? candidate : mode === "personal" ? "interview" : "about";
}

function topicId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function secondaryNavigation(section: PublicSection, jobs: PublicJob[], interviewCatalog: InterviewCatalog | null): SubnavItem[] {
  if (section === "about" || section === "resume") return [];

  if (section === "rewild") {
    return [
      { id: "all", label: "Fight AI slop" },
      { id: "guide", label: "Field guide" },
    ];
  }

  if (section === "interview") {
    if (!interviewCatalog) return [{ id: "all", label: "Loading catalog…" }];
    return interviewCatalog.taxonomy.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.category ? interviewCatalog.questions.filter((question) => question.category === item.category).length : item.id === "all" ? interviewCatalog.questions.length : undefined,
    }));
  }

  if (section === "jobs") {
    const sources = Array.from(new Set(jobs.map((job) => job.source))).sort();
    return [
      { id: "all", label: "All vacancies", count: jobs.length },
      { id: "remote", label: "Remote", count: jobs.filter((job) => job.remote).length },
      ...sources.map((source) => ({ id: `source:${source}`, label: source.replace(/^\w+:/, ""), count: jobs.filter((job) => job.source === source).length })),
    ];
  }

  const items = knowledge[section].items;
  return [
    { id: "all", label: "All topics", count: items.length },
    ...items.map((item) => ({ id: topicId(item.title), label: item.title })),
  ];
}

export default function PublicSite({ mode = "public" }: { mode?: SiteMode }) {
  const [section, setSection] = useState<PublicSection>(mode === "personal" ? "interview" : "about");
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [subsection, setSubsection] = useState("all");
  const [interviewCatalog, setInterviewCatalog] = useState<InterviewCatalog | null>(null);
  const [interviewCatalogError, setInterviewCatalogError] = useState(false);

  useEffect(() => {
    const onHashChange = () => {
      setSection(currentSectionFromLocation(mode));
      setSubsection("all");
    };
    const frame = window.requestAnimationFrame(onHashChange);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
    };
  }, [mode]);

  useEffect(() => {
    if (section !== "interview" || interviewCatalog) return;
    let active = true;
    import("@/content/interview/catalog")
      .then((module) => {
        if (active) setInterviewCatalog(module.default as unknown as InterviewCatalog);
      })
      .catch(() => {
        if (active) setInterviewCatalogError(true);
      });
    return () => { active = false; };
  }, [interviewCatalog, section]);

  useEffect(() => {
    let active = true;
    fetch("/api/public/jobs")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Public jobs unavailable: ${response.status}`);
        return response.json() as Promise<{ jobs?: PublicJob[] }>;
      })
      .then((result) => {
        if (active) setJobs(Array.isArray(result.jobs) ? result.jobs : []);
      })
      .catch(() => {
        if (active) setJobs([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs
      .filter((job) => !needle || displayText(`${job.title} ${job.company} ${job.location} ${job.source}`).toLowerCase().includes(needle))
      .filter((job) => subsection === "all" || (subsection === "remote" && job.remote) || (subsection.startsWith("source:") && job.source === subsection.slice(7)))
      .sort((a, b) => new Date(b.postedAt ?? b.discoveredAt).getTime() - new Date(a.postedAt ?? a.discoveredAt).getTime())
      .slice(0, 50);
  }, [jobs, query, subsection]);

  const openSection = (next: PublicSection) => {
    if (mode === "personal" && next === "jobs") {
      window.location.assign("/workspace");
      return;
    }
    setSection(next);
    setSubsection("all");
    setMobileNav(false);
    window.history.replaceState(null, "", mode === "personal" ? `/workspace/learn?section=${next}` : next === "about" ? window.location.pathname : `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeLabel = navigationItems.find((item) => item.id === section)?.label ?? "Vacancies";
  const secondaryItems = secondaryNavigation(section, jobs, interviewCatalog);
  const hideSecondary = section === "about" || section === "resume" || section === "rewild";
  const publicHref = section === "about" ? "/" : `/#${section}`;
  const personalHref = section === "jobs" ? "/workspace" : `/workspace/learn?section=${section}`;

  return (
    <main className="kb-shell">
      <SiteSidebar
        activeSection={section}
        activeSubsection={subsection}
        hideSecondary={hideSecondary}
        mobileOpen={mobileNav}
        mode={mode}
        onSelect={openSection}
        onSelectSubsection={(next) => { setSubsection(next); setMobileNav(false); }}
        personalHref={personalHref}
        publicHref={publicHref}
        secondaryItems={secondaryItems}
        secondaryTitle={activeLabel}
      />

      <section className={`kb-main${hideSecondary ? " kb-main-compact-nav" : ""}${section === "rewild" && subsection === "all" ? " kb-main-game" : ""}`}>
        <button className="kb-floating-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Toggle navigation">☰</button>

        {section === "jobs" ? (
          <div className="kb-content">
            <header className="kb-page-head">
              <div><h1>Vacancies</h1></div>
              <div className="kb-page-stats"><div><strong>{jobs.length}</strong><span>Vacancies</span></div><div><strong>Newest</strong><span>First</span></div><div><strong>Read-only</strong><span>Public view</span></div></div>
            </header>

            <section className="kb-jobs-panel">
              <div className="kb-jobs-tools">
                <label><span>⌕</span><input aria-label="Search public vacancies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, company, location, or source"/></label>
              </div>
              <div className="kb-jobs-note"><span>{visibleJobs.length} results</span><p>Switch to Personal in the lower-left corner to track applications.</p></div>
              <div className="kb-job-list">
                {loaded && visibleJobs.map((job) => {
                  const summaryTags = [
                    job.remote ? "Remote" : null,
                    job.salaryText ? "Salary listed" : null,
                    job.location && !job.remote ? displayText(job.location) : null,
                    job.source ? displayText(job.source) : null,
                  ].filter(Boolean).slice(0, 3);

                  return (
                    <article className="kb-job-row" key={job.id}>
                      <div className="kb-job-copy">
                        <div><span>{job.source}</span><time>{dateLabel(job.postedAt ?? job.discoveredAt)}</time></div>
                        <h2>{displayText(job.title)}</h2>
                        <p className="kb-job-company">{displayText(job.company)} · {displayText(job.location)}</p>
                        <p>{shortText(job.description || "Open the original vacancy for full details.")}</p>
                        <div className="kb-job-tags">{job.remote && <span>Remote</span>}{job.salaryText && <span>{job.salaryText}</span>}</div>
                      </div>
                      <div className="kb-job-action-stack">
                        <a href={job.url} target="_blank" rel="noreferrer">Open ↗</a>
                        <div className="kb-job-summary-tags">{summaryTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                      </div>
                    </article>
                  );
                })}
                {!loaded && <div className="kb-empty"><strong>Loading jobs…</strong><span>Reading the public database.</span></div>}
                {loaded && visibleJobs.length === 0 && <div className="kb-empty"><strong>{jobs.length ? "No matching jobs" : "Collecting the first jobs"}</strong><span>{jobs.length ? "Try another search." : "A new database syncs automatically. Reload shortly, or use Sync jobs in the private workspace."}</span></div>}
              </div>
            </section>
          </div>
        ) : (
          <KnowledgeSection
            activeTopic={subsection}
            interviewCatalog={interviewCatalog}
            interviewCatalogError={interviewCatalogError}
            mode={mode}
            onTopicChange={setSubsection}
            section={section}
          />
        )}
      </section>

      {mobileNav && <button className="kb-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    </main>
  );
}

function KnowledgeSection({ activeTopic, interviewCatalog, interviewCatalogError, mode, onTopicChange, section }: {
  activeTopic: string;
  interviewCatalog: InterviewCatalog | null;
  interviewCatalogError: boolean;
  mode: SiteMode;
  onTopicChange: (topic: string) => void;
  section: Exclude<PublicSection, "jobs">;
}) {
  if (section === "about") return <AboutSite mode={mode}/>;
  if (section === "resume") return <ResumePage mode={mode}/>;

  if (section === "interview") {
    if (!interviewCatalog) {
      return (
        <div className="kb-content iq-page">
          <div className="kb-empty iq-catalog-state">
            <strong>{interviewCatalogError ? "Interview catalog unavailable" : "Loading interview catalog…"}</strong>
            <span>{interviewCatalogError ? "Reload the page to try the separate catalog request again." : "The public catalog is loaded only when this section is opened."}</span>
          </div>
        </div>
      );
    }
    return <InterviewKnowledgeBase activeTopic={activeTopic} catalog={interviewCatalog} mode={mode} onTopicChange={onTopicChange}/>;
  }

  if (section === "rewild") {
    return (
      <Suspense fallback={<div className="rw-play-page"><div className="kb-empty rw-loading"><strong>Loading the anti-slop defenses…</strong><span>The game is loaded separately from the rest of the site.</span></div></div>}>
        <RewildGame onViewChange={onTopicChange} view={activeTopic}/>
      </Suspense>
    );
  }

  const content = knowledge[section];
  const visibleItems = activeTopic === "all" ? content.items : content.items.filter((item) => topicId(item.title) === activeTopic);
  return (
    <div className="kb-content">
      <header className="kb-page-head kb-article-head">
        <div><h1>{content.title}</h1></div>
      </header>
      <div className="kb-topic-grid">
        {visibleItems.map((item, index) => (
          <article key={item.title}>
            <div><span>{String(index + 1).padStart(2, "0")}</span><small>Outline</small></div>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
            <footer>{item.tags.map((tag) => <em key={tag}>{tag}</em>)}</footer>
          </article>
        ))}
      </div>
    </div>
  );
}

function InterviewKnowledgeBase({ activeTopic, catalog, mode, onTopicChange }: { activeTopic: string; catalog: InterviewCatalog; mode: SiteMode; onTopicChange: (topic: string) => void }) {
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<InterviewLevel[]>([]);
  const [prevalences, setPrevalences] = useState<InterviewPrevalence[]>([]);
  const [sort, setSort] = useState<InterviewSort>("prevalence");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<"prevalence" | "sort" | "tags" | "levels" | null>(null);
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState<Record<string, QuestionProgressStatus>>({});
  const [progressBusy, setProgressBusy] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(mode === "public");

  const interviewQuestions = catalog.questions;
  const interviewTaxonomy = catalog.taxonomy;
  const interviewSourcesList = catalog.sources;
  const interviewSources = useMemo(() => new Map(interviewSourcesList.map((source) => [source.id, source])), [interviewSourcesList]);
  const interviewTags = useMemo(() => Array.from(new Set(interviewQuestions.flatMap(tagsFor))).sort((a, b) => a.localeCompare(b)), [interviewQuestions]);
  const catalogOrder = useMemo(() => new Map(interviewQuestions.map((question, index) => [question.id, index])), [interviewQuestions]);
  const learningTopicOrder = useMemo(() => new Map(
    interviewTaxonomy.filter((item) => item.category).map((item, index) => [item.category as string, index]),
  ), [interviewTaxonomy]);
  const topicSearchLabels = useMemo(() => new Map(
    interviewTaxonomy.filter((item) => item.category).map((item) => [item.category as string, item.label]),
  ), [interviewTaxonomy]);
  const activeTaxonomy = interviewTaxonomy.find((item) => item.id === activeTopic);
  const activeCategory = activeTaxonomy?.category;

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".iq-filter-control")) setOpenFilter(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilter(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (mode !== "personal") return;
    let active = true;
    fetch("/api/interview-progress")
      .then(async (response) => {
        if (!response.ok) throw new Error("Personal progress is temporarily unavailable.");
        return response.json() as Promise<{ progress?: QuestionProgressEntry[] }>;
      })
      .then((result) => {
        if (!active) return;
        setProgress(Object.fromEntries((result.progress ?? []).map((entry) => [entry.questionId, entry.status])));
        setProgressError(null);
      })
      .catch((error) => {
        if (active) setProgressError(error instanceof Error ? error.message : "Personal progress is temporarily unavailable.");
      })
      .finally(() => {
        if (active) setProgressLoaded(true);
      });
    return () => { active = false; };
  }, [mode]);

  const matchingQuestions = useMemo(() => {
    return interviewQuestions
      .filter((item) => {
        const tags = tagsFor(item);
        const matchesLevel = levels.length === 0 || levels.includes(item.level);
        const matchesPrevalence = prevalences.length === 0 || prevalences.includes(item.prevalence);
        const matchesCategory = !activeCategory || item.category === activeCategory;
        const matchesTag = selectedTags.length === 0 || tags.some((tag) => selectedTags.includes(tag));
        const matchesSearch = matchesAllSearchTerms(query, [item.question, item.shortAnswer, item.category, topicSearchLabels.get(item.category) ?? "", item.kind ?? "", item.prevalence, ...tags, ...item.strongAnswerSignals]);
        return matchesLevel && matchesPrevalence && matchesCategory && matchesTag && matchesSearch;
      })
      .sort((left, right) => {
        const catalogDifference = (catalogOrder.get(left.id) ?? 0) - (catalogOrder.get(right.id) ?? 0);
        if (sort === "learning") {
          return (learningTopicOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER) - (learningTopicOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER)
            || levelOrder[left.level] - levelOrder[right.level]
            || prevalenceOrder[left.prevalence] - prevalenceOrder[right.prevalence]
            || catalogDifference;
        }
        if (sort === "alphabetical") return left.question.localeCompare(right.question) || catalogDifference;
        if (sort === "level") {
          return levelOrder[left.level] - levelOrder[right.level]
            || prevalenceOrder[left.prevalence] - prevalenceOrder[right.prevalence]
            || catalogDifference;
        }
        return prevalenceOrder[left.prevalence] - prevalenceOrder[right.prevalence] || catalogDifference;
      });
  }, [activeCategory, catalogOrder, interviewQuestions, learningTopicOrder, levels, prevalences, query, selectedTags, sort, topicSearchLabels]);

  const pageCount = Math.max(1, Math.ceil(matchingQuestions.length / INTERVIEW_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * INTERVIEW_PAGE_SIZE;
  const visibleQuestions = matchingQuestions.slice(pageStart, pageStart + INTERVIEW_PAGE_SIZE);
  const progressCounts = progressOptions.reduce<Record<QuestionProgressStatus, number>>((counts, option) => {
    counts[option.value] = Object.values(progress).filter((status) => status === option.value).length;
    return counts;
  }, { PLANNED: 0, LEARNING: 0, LEARNED: 0 });

  if (activeTopic === "methodology") return <InterviewMethodology catalog={catalog} onBack={() => onTopicChange("all")}/>;

  const setQuestionTags = (nextTags: string[]) => {
    setSelectedTags(nextTags);
    setPage(0);
  };
  const toggleQuestionTag = (nextTag: string) => setQuestionTags(
    selectedTags.includes(nextTag) ? selectedTags.filter((tag) => tag !== nextTag) : [...selectedTags, nextTag],
  );
  const setQuestionLevels = (nextLevels: InterviewLevel[]) => {
    setLevels(nextLevels);
    setPage(0);
  };
  const setQuestionPrevalences = (nextPrevalences: InterviewPrevalence[]) => {
    setPrevalences(nextPrevalences);
    setPage(0);
  };
  const setFilterOpen = (filter: NonNullable<typeof openFilter>, nextOpen: boolean) => {
    setOpenFilter((current) => nextOpen ? filter : current === filter ? null : current);
  };
  const clearFilters = () => {
    setQuery("");
    setLevels([]);
    setPrevalences([]);
    setSort("prevalence");
    setSelectedTags([]);
    setOpenFilter(null);
    setPage(0);
    onTopicChange("all");
  };
  const hasActiveFilters = Boolean(activeCategory || selectedTags.length || query || levels.length || prevalences.length || sort !== "prevalence");
  const updateProgress = async (questionId: string, status: QuestionProgressStatus | null) => {
    const previous = progress[questionId] ?? null;
    setProgressBusy(questionId);
    setProgress((current) => {
      const next = { ...current };
      if (status) next[questionId] = status;
      else delete next[questionId];
      return next;
    });
    try {
      const response = await fetch(`/api/interview-progress/${encodeURIComponent(questionId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Could not save this learning status.");
      setProgressError(null);
    } catch (error) {
      setProgress((current) => {
        const next = { ...current };
        if (previous) next[questionId] = previous;
        else delete next[questionId];
        return next;
      });
      setProgressError(error instanceof Error ? error.message : "Could not save this learning status.");
    } finally {
      setProgressBusy(null);
    }
  };

  return (
    <div className="kb-content iq-page">
      <header className="kb-page-head iq-head">
        <div>
          <h1>{activeTaxonomy?.category ? activeTaxonomy.label : "QA interview knowledge base"}</h1>
        </div>
        <div className="kb-page-stats">
          <div><strong>{interviewQuestions.length}</strong><span>Questions</span></div>
          <div><strong>{interviewTaxonomy.filter((item) => item.category).length}</strong><span>Topics</span></div>
          <div><strong>{interviewSourcesList.length}</strong><span>Sources</span></div>
        </div>
      </header>

      {mode === "personal" && (
        <section className="iq-progress-summary" aria-live="polite">
          <div><span>Personal learning</span><strong>{progressCounts.LEARNED} learned</strong><strong>{progressCounts.LEARNING} learning</strong><strong>{progressCounts.PLANNED} planned</strong></div>
          <small>{progressError ?? (progressLoaded ? "Saved privately in your Personal view." : "Loading your progress…")}</small>
        </section>
      )}

      <section className="iq-toolbar" aria-label="Interview question filters">
        <div className="iq-toolbar-main">
          <label className="iq-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search all words across questions, answers, tags, or skills"/>
          </label>
          <div className="iq-filter-status" aria-live="polite">
            <span><strong>{matchingQuestions.length}</strong> matches</span>
            <span><strong>{visibleQuestions.length}</strong> rendered</span>
          </div>
        </div>
        <div className="iq-filter-grid">
          <InterviewFilter emptyLabel="Most common first" helpText="Choose the order used for matching questions." label="Sort" onChange={(next) => { setSort(next[0] ?? "prevalence"); setPage(0); }} onOpenChange={(nextOpen) => setFilterOpen("sort", nextOpen)} open={openFilter === "sort"} options={interviewSortOptions} selected={[sort]} selectionMode="single"/>
          <InterviewFilter emptyLabel="All prevalence" helpText="Matches any selected prevalence." label="Prevalence" onChange={setQuestionPrevalences} onOpenChange={(nextOpen) => setFilterOpen("prevalence", nextOpen)} open={openFilter === "prevalence"} options={interviewPrevalence.map((item) => ({ label: item, value: item }))} selected={prevalences}/>
          <InterviewFilter emptyLabel="All tags" helpText="Matches any selected tag." label="Tags" onChange={setQuestionTags} onOpenChange={(nextOpen) => setFilterOpen("tags", nextOpen)} open={openFilter === "tags"} options={interviewTags.map((tag) => ({ label: tag, value: tag }))} searchable selected={selectedTags}/>
          <InterviewFilter emptyLabel="All levels" helpText="Matches any selected seniority level." label="Seniority" onChange={setQuestionLevels} onOpenChange={(nextOpen) => setFilterOpen("levels", nextOpen)} open={openFilter === "levels"} options={interviewLevels.map((level) => ({ label: level, value: level }))} selected={levels}/>
          <button className="iq-clear" disabled={!hasActiveFilters} onClick={clearFilters}>Reset filters</button>
        </div>
      </section>

      <div className="iq-list">
        {visibleQuestions.map((item, index) => {
          const tags = tagsFor(item);
          return (
            <details className="iq-question" key={item.id}>
              <summary>
                <span className={`iq-level iq-level-${item.level.toLowerCase()}`}>{item.level}</span>
                <div>
                  <small>{item.category}{item.kind ? ` · ${item.kind}` : ""} · {String(pageStart + index + 1).padStart(3, "0")}</small>
                  <h2>{item.question}</h2>
                  <span className="iq-question-tags">
                    <em className={`iq-prevalence iq-prevalence-${item.prevalence.toLowerCase().replace(" ", "-")}`}>{item.prevalence}</em>
                    {mode === "personal" && progress[item.id] && <em className={`iq-progress-badge iq-progress-${progress[item.id].toLowerCase()}`}>{progressOptions.find((option) => option.value === progress[item.id])?.label}</em>}
                    {tags.slice(0, 4).map((questionTag) => <em key={questionTag}>{questionTag}</em>)}
                  </span>
                </div>
              </summary>
              <div className="iq-answer">
                <section>
                  <h3>Answer</h3>
                  <StructuredAnswer value={item.shortAnswer}/>
                </section>
                <section>
                  <h3>Strong answer includes</h3>
                  <ul>{item.strongAnswerSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
                  <div className="iq-answer-tags">{tags.map((questionTag) => <button className={selectedTags.includes(questionTag) ? "active" : ""} key={questionTag} onClick={() => toggleQuestionTag(questionTag)}>#{questionTag}</button>)}</div>
                </section>
                {mode === "personal" && (
                  <section className="iq-progress-control">
                    <div><h3>Personal progress</h3><small>Saved privately</small></div>
                    <div>
                      {progressOptions.map((option) => (
                        <button className={progress[item.id] === option.value ? `active iq-progress-${option.value.toLowerCase()}` : ""} disabled={progressBusy === item.id} key={option.value} onClick={() => void updateProgress(item.id, option.value)}>{option.label}</button>
                      ))}
                      {progress[item.id] && <button className="iq-progress-reset" disabled={progressBusy === item.id} onClick={() => void updateProgress(item.id, null)}>Reset</button>}
                    </div>
                  </section>
                )}
                {item.media?.map((media) => (
                  <figure className="iq-media" key={media.src}>
                    <Image src={media.src} alt={media.alt} height={430} loading="lazy" unoptimized width={760}/>
                    <figcaption>{media.caption}<small>{media.credit}</small></figcaption>
                  </figure>
                ))}
                <footer>
                  <span>References</span>
                  {item.sourceIds.map((sourceId) => {
                    const source = interviewSources.get(sourceId);
                    return source ? <a href={source.url} target="_blank" rel="noreferrer" key={sourceId}>{source.publisher}: {source.title} ↗</a> : null;
                  })}
                </footer>
              </div>
            </details>
          );
        })}
        {matchingQuestions.length === 0 && (
          <div className="kb-empty iq-empty"><strong>No matching questions</strong><span>Change the topic, level, prevalence, tag, or search phrase.</span></div>
        )}
      </div>

      {matchingQuestions.length > INTERVIEW_PAGE_SIZE && (
        <nav className="iq-pagination" aria-label="Interview question result pages">
          <button disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>← Previous 60</button>
          <span>Page {safePage + 1} of {pageCount} · results {pageStart + 1}–{pageStart + visibleQuestions.length}</span>
          <button disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>Next 60 →</button>
        </nav>
      )}
    </div>
  );
}

function InterviewMethodology({ catalog, onBack }: { catalog: InterviewCatalog; onBack: () => void }) {
  const method = catalog.methodology;
  const interviewSourcesList = catalog.sources;
  return (
    <div className="kb-content iq-page iq-methodology">
      <header className="kb-page-head iq-head">
        <div><h1>Sources & methodology</h1></div>
        <button className="iq-back" onClick={onBack}>View all questions</button>
      </header>

      <section className="iq-method-grid">
        <article><span>01</span><h2>Coverage</h2><p>{method.coverage}</p></article>
        <article><span>02</span><h2>Answer validation</h2><p>{method.answers}</p></article>
        <article><span>03</span><h2>Publishing</h2><p>{method.publishing}</p></article>
        <article><span>04</span><h2>Prevalence</h2><p>{method.prevalence}</p></article>
        <article><span>05</span><h2>Images and diagrams</h2><p>{method.media}</p></article>
      </section>

      <section className="iq-source-catalog">
        <header><div><span>SOURCE CATALOG</span><h2>{interviewSourcesList.length} research and validation sources</h2></div><p>Community collections show what is asked. Official documentation, specifications and standards are used to validate technical answers.</p></header>
        <div>
          {interviewSourcesList.map((source) => (
            <article key={source.id}>
              <div><span>{source.kind}</span><small>{source.publisher}</small></div>
              <h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3>
              <p>{source.role}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
