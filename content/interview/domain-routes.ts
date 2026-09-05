export const INTERVIEW_DOMAIN_ROUTES = [
  {
    id: "generic-qa",
    slug: "generic-qa",
    label: "Generic QA",
    switcherLabel: "Generic QA",
    path: "/interview/generic-qa",
    title: "General QA Interview Questions & Answers",
    description: "Practical general QA interview questions and answers covering testing fundamentals, test design, defects, delivery, metrics, strategy, leadership, reliability, and cross-cutting quality engineering.",
    relatedLinks: [
      { label: "QA fundamentals", href: "/reference/qa-fundamentals" },
      { label: "QA strategy & risk", href: "/learn/strategy" },
      { label: "Metrics & estimation", href: "/learn/metrics-estimation" },
    ],
  },
  {
    id: "automation-qa",
    slug: "automation",
    label: "Automation QA",
    switcherLabel: "Automation",
    path: "/interview/automation",
    title: "QA Automation Interview Questions & Answers",
    description: "Practical QA automation interview questions and answers covering framework design, maintainable test code, CI execution, programming concepts, automation strategy, and test architecture.",
    relatedLinks: [
      { label: "Test automation learning", href: "/learn/automation" },
      { label: "Programming reference", href: "/reference/programming" },
      { label: "Cloud & DevOps for QA", href: "/learn/cloud-devops" },
    ],
  },
  {
    id: "sql-databases",
    slug: "sql",
    label: "SQL & Databases",
    switcherLabel: "SQL / DB",
    path: "/interview/sql",
    title: "SQL & Database Interview Questions for QA",
    description: "Practical SQL and database interview questions for QA and automation engineers, including executable queries, joins, aggregation, transactions, data integrity, pipelines, BI validation, and real testing scenarios.",
    relatedLinks: [
      { label: "Data & SQL reference", href: "/reference/data" },
      { label: "Testing tools", href: "/learn/testing-tools" },
      { label: "Automation learning", href: "/learn/automation" },
    ],
  },
  {
    id: "web-api",
    slug: "web-api",
    label: "Web & API",
    switcherLabel: "Web / API",
    path: "/interview/web-api",
    title: "Web & API Testing Interview Questions",
    description: "Practical web and API testing interview questions covering HTTP, REST, contracts, authentication, integrations, browser behaviour, service failures, and web-facing data flows.",
    relatedLinks: [
      { label: "API testing learning", href: "/learn/api" },
      { label: "Security testing", href: "/learn/security" },
      { label: "Networking for QA", href: "/learn/networking" },
    ],
  },
  {
    id: "performance-testing",
    slug: "performance",
    label: "Performance Testing",
    switcherLabel: "Performance",
    path: "/interview/performance",
    title: "Performance Testing Interview Questions & Answers",
    description: "Research-backed performance testing interview questions covering workload modelling, load and stress testing, latency percentiles, throughput, JMeter, k6, distributed load generation, bottleneck analysis, endurance and spike testing, and CI performance gates.",
    relatedLinks: [
      { label: "Performance testing learning", href: "/learn/performance" },
      { label: "Testing tools", href: "/learn/testing-tools" },
      { label: "Observability & SRE", href: "/learn/observability" },
    ],
  },
  {
    id: "mobile",
    slug: "mobile",
    label: "Mobile",
    switcherLabel: "Mobile",
    path: "/interview/mobile",
    title: "Mobile Testing Interview Questions & Answers",
    description: "Practical mobile testing interview questions and answers covering Android and iOS, devices, application lifecycle, permissions, constrained networks, releases, diagnostics, and automation concepts.",
    relatedLinks: [
      { label: "Mobile testing learning", href: "/learn/mobile" },
      { label: "Testing tools", href: "/learn/testing-tools" },
      { label: "Automation learning", href: "/learn/automation" },
    ],
  },
  {
    id: "embedded-iot",
    slug: "embedded-iot",
    label: "Embedded & IoT",
    switcherLabel: "Embedded",
    path: "/interview/embedded-iot",
    title: "Embedded & IoT Testing Interview Questions",
    description: "Practical embedded and IoT testing interview questions covering firmware, hardware interfaces, real-time behaviour, power, OTA updates, constrained devices, diagnostics, and IoT security.",
    relatedLinks: [
      { label: "Embedded & IoT learning", href: "/learn/embedded" },
      { label: "Networking for QA", href: "/learn/networking" },
      { label: "Testing tools", href: "/learn/testing-tools" },
    ],
  },
  {
    id: "ai-llm",
    slug: "ai-llm",
    label: "AI & LLM QA",
    switcherLabel: "AI / LLM",
    path: "/interview/ai-llm",
    title: "AI & LLM Testing Interview Questions",
    description: "Practical AI and LLM testing interview questions covering model and dataset quality, LLM evaluation, RAG, prompt security, agent behaviour, non-determinism, reliability, and quality engineering.",
    relatedLinks: [
      { label: "LLM testing & AI learning", href: "/learn/llm" },
      { label: "AI agents & MCP", href: "/learn/agentic" },
      { label: "Security testing", href: "/learn/security" },
    ],
  },
] as const;

export type InterviewDomainRoute = (typeof INTERVIEW_DOMAIN_ROUTES)[number];

export function interviewDomainRouteBySlug(slug: string): InterviewDomainRoute | undefined {
  return INTERVIEW_DOMAIN_ROUTES.find((route) => route.slug === slug);
}

export function interviewDomainRouteById(id: string): InterviewDomainRoute | undefined {
  return INTERVIEW_DOMAIN_ROUTES.find((route) => route.id === id);
}

export function interviewDomainRouteFromPathname(pathname: string): InterviewDomainRoute | undefined {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return INTERVIEW_DOMAIN_ROUTES.find((route) => route.path === normalized);
}
