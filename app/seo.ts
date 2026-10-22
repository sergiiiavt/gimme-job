import type { Metadata } from "next";
import { INTERVIEW_DOMAIN_ROUTES, canonicalInterviewDomainPath } from "../content/interview/domain-routes.ts";

export const SITE_NAME = "GimmeJob";
export const SITE_ORIGIN = "https://gimme-job.com";
export const DEFAULT_DESCRIPTION =
  "Practical QA interview questions, testing and automation learning materials, references, and career tools for quality engineers.";
export const HOME_TITLE = `${SITE_NAME} | QA Interview Questions, Learning & Career Tools`;
export const DEFAULT_OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "GimmeJob — QA interview questions, learning paths, and career tools",
} as const;

export type SeoPage = Readonly<{
  title: string;
  description: string;
  /** Canonical path. Duplicate surfaces point this at the page that should rank. */
  path: string;
  /** Replaces the default "<title> | GimmeJob" format. */
  absoluteTitle?: string;
  /** Placeholder pages stay crawlable for links but are kept out of the index and sitemap. */
  maturity?: "under-construction";
}>;

export type SeoLanguageAlternates = Readonly<Record<"en" | "uk" | "x-default", string>>;

export const SITE_PAGE_SEO = {
  home: {
    title: "QA Interview Questions, Learning & Career Tools",
    absoluteTitle: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
  },
  // `/about` and `/learn` render the same introduction as the home page.
  about: {
    title: "About",
    description: "About GimmeJob: a practical QA engineering knowledge base and career toolkit covering interview preparation, learning paths, automation, AI, and software quality.",
    path: "/",
  },
  vacancies: {
    title: "QA Vacancies & Job Search",
    description: "QA and test automation vacancies with practical filtering and job-search tooling for quality engineers.",
    path: "/vacancies",
  },
  resume: {
    title: "QA Engineer Resume",
    description: "QA engineering resume covering test leadership, automation, Python, Playwright, API testing, AI and LLM testing, and quality engineering experience.",
    path: "/resume",
  },
  trends: {
    title: "QA Engineering Trends",
    description: "QA engineering trends across testing, automation, AI, tools, skills, and the software quality job market.",
    path: "/trends",
    maturity: "under-construction",
  },
  news: {
    title: "QA & Software Testing News",
    description: "Curated QA, software testing, automation, AI, tooling, and quality engineering news and updates.",
    path: "/news",
    maturity: "under-construction",
  },
  databasePlayground: {
    title: "Online SQL & NoSQL Database Playground",
    description: "Run SQL and NoSQL queries in the browser against MySQL 8, PostgreSQL 16, and MongoDB 8 sample databases to practise database testing and data validation.",
    path: "/playgrounds/databases",
  },
  websocketPlayground: {
    title: "WebSocket Testing Playground",
    description: "A live WebSocket chat for practising WebSocket testing: connections, frames, reconnects, broadcasts, boundaries, and DevTools inspection.",
    path: "/playgrounds/websocket",
  },
  games: {
    title: "Games",
    description: "Small browser games built as a GimmeJob technology playground, with generated platform battlefields and selectable difficulty.",
    path: "/games",
  },
} as const satisfies Readonly<Record<string, SeoPage>>;

export const LEARNING_SEO: Readonly<Record<string, SeoPage>> = {
  "qa-fundamentals": {
    title: "QA Fundamentals Learning Path",
    description: "A source-backed learning path for software testing and quality fundamentals: test process, test design, defects, risk, reviews, and modern delivery.",
    path: "/learn/qa-fundamentals",
  },
  programming: {
    title: "Python & Programming for QA Automation",
    description: "A structured programming learning path for QA automation engineers, with Python and C# lessons, runnable examples, and interview-oriented explanations.",
    path: "/learn/programming",
  },
  certifications: {
    title: "QA Certifications",
    description: "QA certification learning materials, exam-oriented references, and practical study guidance for quality engineers.",
    path: "/learn/certifications",
  },
  strategy: {
    title: "QA Strategy & Risk",
    description: "Practical QA strategy, risk-based testing, estimation, planning, and quality leadership learning materials.",
    path: "/learn/strategy",
    maturity: "under-construction",
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
  data: {
    title: "SQL Learning Path",
    description: "A complete SQL learning path for QA and quality engineers covering querying, joins, aggregation, CTEs, window functions, transactions, schema design, performance, security, and practical data validation.",
    path: "/learn/data",
  },
  mobile: {
    title: "Mobile Testing Learning",
    description: "Practical mobile testing materials for Android and iOS, including device tooling, logs, debugging, and automation concepts.",
    path: "/learn/mobile",
    maturity: "under-construction",
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
    maturity: "under-construction",
  },
  "cloud-devops": {
    title: "Cloud & DevOps for QA",
    description: "Cloud and DevOps learning materials for QA engineers covering CI/CD, containers, infrastructure, delivery pipelines, and testing in production-like environments.",
    path: "/learn/cloud-devops",
  },
  docker: {
    title: "Docker & Containers Learning Path",
    description: "Learn Docker from first containers to production: Dockerfiles, Compose, networking, storage, security, testing, CI/CD, troubleshooting, and a runnable project.",
    path: "/learn/docker",
  },
  observability: {
    title: "Observability for QA",
    description: "Observability learning materials for QA engineers covering logs, metrics, traces, monitoring, diagnostics, and production feedback loops.",
    path: "/learn/observability",
    maturity: "under-construction",
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
    maturity: "under-construction",
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
    maturity: "under-construction",
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

export function isIndexableSeoPage(page: SeoPage): boolean {
  return page.maturity !== "under-construction";
}

const ENGLISH_INTERVIEW_SITEMAP_PATHS = [
  "/interview",
  "/interview/python",
  ...INTERVIEW_DOMAIN_ROUTES.map(canonicalInterviewDomainPath),
];

export const UKRAINIAN_SITEMAP_PATHS: readonly string[] = [...new Set(ENGLISH_INTERVIEW_SITEMAP_PATHS)].map((path) => `/uk${path}`);

const indexablePaths = (pages: Readonly<Record<string, SeoPage>>) => Object.values(pages).filter(isIndexableSeoPage).map((page) => page.path);

/** Canonical, indexable list and landing pages. Question pages are appended by the sitemap route. */
export const PUBLIC_SITEMAP_PATHS: readonly string[] = [...new Set([
  ...indexablePaths(SITE_PAGE_SEO),
  ...ENGLISH_INTERVIEW_SITEMAP_PATHS,
  ...UKRAINIAN_SITEMAP_PATHS,
  ...indexablePaths(LEARNING_SEO),
  ...indexablePaths(REFERENCE_SEO),
])];

function normalizedPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function bilingualLanguageAlternates(englishPath: string, ukrainianPath?: string): SeoLanguageAlternates {
  const english = normalizedPath(englishPath);
  const ukrainian = ukrainianPath ? normalizedPath(ukrainianPath) : `/uk${english}`;
  return {
    en: english,
    uk: ukrainian,
    "x-default": english,
  };
}

function openGraphLocale(path: string) {
  return path === "/uk" || path.startsWith("/uk/") ? "uk_UA" : "en_US";
}

export function createPageMetadata(page: SeoPage, languages?: SeoLanguageAlternates): Metadata {
  const fullTitle = page.absoluteTitle ?? `${page.title} | ${SITE_NAME}`;
  const locale = openGraphLocale(page.path);
  return {
    title: fullTitle,
    description: page.description,
    alternates: {
      canonical: page.path,
      ...(languages ? { languages } : {}),
    },
    ...(isIndexableSeoPage(page) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description: page.description,
      url: page.path,
      locale,
      ...(languages ? { alternateLocale: locale === "uk_UA" ? "en_US" : "uk_UA" } : {}),
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: page.description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

const SNIPPET_TRAILING_PUNCTUATION = new Set([" ", ",", ".", ";", ":", "—", "–", "-"]);

/** Plain-text meta description that fits search snippets, cut on a word boundary. */
export function metaDescription(text: string, limit = 155): string {
  const normalized = text.replace(/`|\*\*/g, "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const cut = normalized.slice(0, limit - 1);
  const boundary = cut.lastIndexOf(" ");
  const snippet = boundary > limit * 0.6 ? cut.slice(0, boundary) : cut;
  let end = snippet.length;
  while (end > 0 && SNIPPET_TRAILING_PUNCTUATION.has(snippet[end - 1])) end -= 1;
  return `${snippet.slice(0, end)}…`;
}

type BreadcrumbItem = Readonly<{ name: string; path: string }>;

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE_ORIGIN).toString(),
    })),
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
