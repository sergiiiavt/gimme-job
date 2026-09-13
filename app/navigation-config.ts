export type SiteSection = "about" | "jobs" | "resume" | "interview" | "python-interview" | "certifications" | "strategy" | "programming" | "automation" | "api" | "data" | "mobile" | "embedded" | "performance" | "security" | "devops" | "observability" | "networking" | "linux" | "llm" | "agentic" | "standards" | "trends" | "news";
export type ExternalNavigationId = "ai-assistant" | "qa-fundamentals" | "testing-tools" | "metrics-estimation" | "websocket-playground" | "database-playground" | "games";
export type NavigationGroupId = "career" | "learning" | "playgrounds" | "misc";

export interface SectionNavigationItem {
  id: SiteSection;
  label: string;
  external?: false;
  publicHref?: string;
  personalHref?: string;
}

export interface ExternalNavigationItem {
  id: ExternalNavigationId;
  label: string;
  external: true;
  publicHref: string;
  personalHref: string;
}

export type NavigationItem = SectionNavigationItem | ExternalNavigationItem;
export interface NavigationGroup {
  id: NavigationGroupId;
  label: string;
  items: NavigationItem[];
}

export const navigationIntroItem: SectionNavigationItem = {
  id: "about",
  label: "About this site",
  publicHref: "/about",
  personalHref: "/about",
};

/** Valid deep-link sections that are reachable in-page rather than through their own nav button. */
export const hiddenDeepLinkSections: SiteSection[] = ["python-interview"];

export const navigationGroups: NavigationGroup[] = [
  {
    id: "career",
    label: "Career",
    items: [
      { id: "jobs", label: "Vacancies" },
      { id: "resume", label: "My Resume" },
      { id: "interview", label: "Interview questions" },
      { id: "trends", label: "Trends" },
    ],
  },
  {
    id: "playgrounds",
    label: "Playgrounds",
    items: [
      {
        id: "ai-assistant",
        label: "AI Assistant",
        external: true,
        publicHref: "/ai-assistant",
        personalHref: "/ai-assistant",
      },
      {
        id: "websocket-playground",
        label: "WebSocket",
        external: true,
        publicHref: "/playgrounds/websocket",
        personalHref: "/playgrounds/websocket",
      },
      {
        id: "database-playground",
        label: "Database",
        external: true,
        publicHref: "/playgrounds/databases",
        personalHref: "/playgrounds/databases",
      },
    ],
  },
  {
    id: "learning",
    label: "Learning path",
    items: [
      {
        id: "qa-fundamentals",
        label: "QA fundamentals",
        external: true,
        publicHref: "/reference/qa-fundamentals",
        personalHref: "/workspace/learn/qa-fundamentals",
      },
      { id: "certifications", label: "Certs & Trainings" },
      { id: "llm", label: "Generative AI & LLM" },
      { id: "agentic", label: "AI agents & MCP" },
      { id: "programming", label: "Programming", publicHref: "/learn/programming", personalHref: "/workspace/learn/programming" },
      { id: "automation", label: "Test automation", publicHref: "/learn/automation", personalHref: "/workspace/learn/automation" },
      {
        id: "testing-tools",
        label: "Testing tools",
        external: true,
        publicHref: "/learn/testing-tools",
        personalHref: "/workspace/learn/testing-tools",
      },
      { id: "api", label: "API & integration" },
      { id: "data", label: "Databases, SQL & BI" },
      { id: "mobile", label: "Mobile & accessibility" },
      { id: "embedded", label: "Embedded & IoT QA" },
      { id: "performance", label: "Performance & reliability" },
      { id: "security", label: "Security testing" },
      { id: "devops", label: "Cloud & DevOps", publicHref: "/learn/cloud-devops", personalHref: "/workspace/learn/cloud-devops" },
      { id: "observability", label: "Observability & SRE" },
      { id: "networking", label: "Networking" },
      { id: "linux", label: "Linux & shell" },
      { id: "standards", label: "Standards & compliance" },
      {
        id: "metrics-estimation",
        label: "QA metrics & estimation",
        external: true,
        publicHref: "/learn/metrics-estimation",
        personalHref: "/workspace/learn/metrics-estimation",
      },
      { id: "strategy", label: "Strategy & leadership" },
    ],
  },
  {
    id: "misc",
    label: "Misc",
    items: [
      { id: "news", label: "News" },
      {
        id: "games",
        label: "Games",
        external: true,
        publicHref: "/games",
        personalHref: "/games",
      },
    ],
  },
];

function isSectionNavigationItem(item: NavigationItem): item is SectionNavigationItem {
  return item.external !== true;
}

export const navigationItems: SectionNavigationItem[] = [
  navigationIntroItem,
  ...navigationGroups.flatMap((group) => group.items.filter(isSectionNavigationItem)),
];
