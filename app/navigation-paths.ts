export type NavigationMode = "public" | "personal";

const canonicalSectionPaths: Record<string, string> = {
  about: "/about",
  jobs: "/vacancies",
  resume: "/resume",
  interview: "/interview",
  "python-interview": "/interview/python",
  trends: "/trends",
  certifications: "/learn/certifications",
  strategy: "/learn/strategy",
  "qa-fundamentals": "/reference/qa-fundamentals",
  programming: "/reference/programming",
  automation: "/learn/automation",
  api: "/learn/api",
  data: "/learn/data",
  mobile: "/learn/mobile",
  embedded: "/learn/embedded",
  performance: "/learn/performance",
  security: "/learn/security",
  devops: "/learn/cloud-devops",
  observability: "/learn/observability",
  networking: "/learn/networking",
  linux: "/learn/linux",
  llm: "/learn/llm",
  agentic: "/learn/agentic",
  standards: "/learn/standards",
  news: "/news",
};

const publishedQuickReferenceSections = new Set(["qa-fundamentals", "programming", "data"]);
const publishedInterviewDomainSlugs = new Set(["generic-qa", "automation", "sql", "web-api", "mobile", "embedded-iot", "ai-llm"]);

/**
 * Public and signed-in users share one canonical URL for each content surface.
 * Authentication changes available actions/private data, never the content URL.
 * `mode` is retained for caller compatibility while old personal routes are removed.
 */
export function sectionNavigationHref(section: string, _mode: NavigationMode): string {
  return canonicalSectionPaths[section] ?? `/learn/${section}`;
}

export function sectionFromPathname(pathname: string): string | null {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  const topLevel: Record<string, string> = {
    "/about": "about",
    "/vacancies": "jobs",
    "/resume": "resume",
    "/interview": "interview",
    "/interview/python": "python-interview",
    "/trends": "trends",
    "/news": "news",
  };
  if (topLevel[normalized]) return topLevel[normalized];
  if (normalized.startsWith("/interview/")) {
    const slug = normalized.slice("/interview/".length);
    if (publishedInterviewDomainSlugs.has(slug)) return "interview";
  }
  if (normalized.startsWith("/reference/")) {
    const slug = normalized.slice("/reference/".length).split("/")[0];
    return publishedQuickReferenceSections.has(slug) ? slug : null;
  }
  if (!normalized.startsWith("/learn/")) return null;
  const slug = normalized.slice("/learn/".length).split("/")[0];
  if (slug === "cloud-devops") return "devops";
  return slug || null;
}
