import type { Metadata } from "next";

export const SITE_NAME = "GimmeJob";
export const SITE_ORIGIN = "https://gimme-job.com";
export const DEFAULT_DESCRIPTION =
  "Practical QA interview questions, testing and automation learning materials, references, and career tools for quality engineers.";

type SeoPage = Readonly<{
  title: string;
  description: string;
  path: string;
}>;

export const LEARNING_SEO: Readonly<Record<string, SeoPage>> = {
  certifications: {
    title: "QA Certifications",
    description: "QA certification learning materials, exam-oriented references, and practical study guidance for quality engineers.",
    path: "/learn/certifications",
  },
  strategy: {
    title: "QA Strategy & Risk",
    description: "Practical QA strategy, risk-based testing, estimation, planning, and quality leadership learning materials.",
    path: "/learn/strategy",
  },
  automation: {
    title: "Test Automation Learning",
    description: "Practical test automation learning materials covering frameworks, maintainability, UI and API automation, and CI workflows.",
    path: "/learn/automation",
  },
  api: {
    title: "API Testing Learning",
    description: "Practical API testing learning materials covering HTTP, REST, contracts, authentication, negative testing, and automation examples.",
    path: "/learn/api",
  },
  mobile: {
    title: "Mobile Testing Learning",
    description: "Practical mobile testing materials for Android and iOS, including device tooling, logs, debugging, and automation concepts.",
    path: "/learn/mobile",
  },
  embedded: {
    title: "Embedded & IoT Testing Learning",
    description: "Embedded and IoT testing materials covering devices, protocols, hardware-aware testing, diagnostics, and automation approaches.",
    path: "/learn/embedded",
  },
  performance: {
    title: "Performance Testing Learning",
    description: "Performance testing learning materials covering workload design, metrics, bottleneck analysis, tooling, and practical test scenarios.",
    path: "/learn/performance",
  },
  security: {
    title: "Security Testing Learning",
    description: "Security testing learning materials for QA engineers, including web risks, practical checks, tooling, and secure testing habits.",
    path: "/learn/security",
  },
  "cloud-devops": {
    title: "Cloud & DevOps for QA",
    description: "Cloud and DevOps learning materials for QA engineers covering CI/CD, containers, infrastructure, delivery pipelines, and testing in production-like environments.",
    path: "/learn/cloud-devops",
  },
  observability: {
    title: "Observability for QA",
    description: "Observability learning materials for QA engineers covering logs, metrics, traces, monitoring, diagnostics, and production feedback loops.",
    path: "/learn/observability",
  },
  networking: {
    title: "Networking for QA Engineers",
    description: "Networking learning materials for QA engineers covering TCP/IP, DNS, HTTP, proxies, packet inspection, and troubleshooting.",
    path: "/learn/networking",
  },
  linux: {
    title: "Linux for QA Engineers",
    description: "Practical Linux learning materials for QA engineers covering shell usage, processes, files, networking, logs, and test automation workflows.",
    path: "/learn/linux",
  },
  llm: {
    title: "LLM Testing & AI Learning",
    description: "Practical LLM and AI testing materials covering evaluation, prompt behavior, RAG, reliability, safety, and quality engineering approaches.",
    path: "/learn/llm",
  },
  agentic: {
    title: "AI Agents & MCP Learning",
    description: "Practical agentic AI learning materials covering AI agents, MCP, tool use, workflows, and modern agent engineering concepts.",
    path: "/learn/agentic",
  },
  standards: {
    title: "QA Standards Learning",
    description: "Software quality and testing standards learning materials with practical context for QA engineers and regulated development environments.",
    path: "/learn/standards",
  },
  "testing-tools": {
    title: "Software Testing Tools",
    description: "Practical testing-tools learning materials covering API clients, browser DevTools, proxies, database tools, network inspection, and mobile diagnostics.",
    path: "/learn/testing-tools",
  },
  "metrics-estimation": {
    title: "QA Metrics & Estimation",
    description: "Practical QA metrics and estimation learning materials covering quality KPIs, forecasting, risk, flow, automation health, and measurement techniques.",
    path: "/learn/metrics-estimation",
  },
};

export const REFERENCE_SEO: Readonly<Record<string, SeoPage>> = {
  "qa-fundamentals": {
    title: "QA Fundamentals Reference",
    description: "A practical QA fundamentals reference covering testing concepts, test design, defects, risk, quality processes, and interview preparation.",
    path: "/reference/qa-fundamentals",
  },
  programming: {
    title: "Programming Reference for QA",
    description: "A practical programming reference for QA and automation engineers covering core coding concepts, examples, and interview-oriented explanations.",
    path: "/reference/programming",
  },
  data: {
    title: "Data & SQL Reference for QA",
    description: "A practical data and SQL reference for QA engineers covering queries, joins, aggregation, database testing, and interview examples.",
    path: "/reference/data",
  },
};

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/about",
  "/vacancies",
  "/resume",
  "/interview",
  "/interview/python",
  "/interview/generic-qa",
  "/interview/automation",
  "/interview/sql",
  "/interview/web-api",
  "/interview/mobile",
  "/interview/embedded-iot",
  "/interview/ai-llm",
  "/trends",
  "/news",
  "/fight-ai-slop",
  ...Object.values(LEARNING_SEO).map((page) => page.path),
  ...Object.values(REFERENCE_SEO).map((page) => page.path),
] as const;

export function createPageMetadata(page: SeoPage): Metadata {
  const fullTitle = `${page.title} | ${SITE_NAME}`;
  return {
    title: fullTitle,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description: page.description,
      url: page.path,
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description: page.description,
    },
  };
}

export function learningSectionMetadata(section: string): Metadata {
  const page = LEARNING_SEO[section];
  if (page) return createPageMetadata(page);

  const title = `${humanizeSlug(section)} Learning`;
  return createPageMetadata({
    title,
    description: `Practical ${humanizeSlug(section).toLowerCase()} learning materials for QA and quality engineering.`,
    path: `/learn/${section}`,
  });
}

export function referenceSectionMetadata(section: string): Metadata {
  const page = REFERENCE_SEO[section];
  if (page) return createPageMetadata(page);

  const title = `${humanizeSlug(section)} Reference`;
  return createPageMetadata({
    title,
    description: `A practical ${humanizeSlug(section).toLowerCase()} reference for QA and quality engineering.`,
    path: `/reference/${section}`,
  });
}

export function legacyReferenceMetadata(section: keyof typeof REFERENCE_SEO): Metadata {
  return createPageMetadata(REFERENCE_SEO[section]);
}

export function noIndexMetadata(title: string, description: string): Metadata {
  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    robots: { index: false, follow: false, nocache: true },
  };
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
