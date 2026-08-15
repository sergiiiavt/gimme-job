export type AboutIcon =
  | "search"
  | "code"
  | "ai"
  | "book"
  | "github"
  | "actions"
  | "cloudflare"
  | "worker"
  | "asset"
  | "database"
  | "jobs"
  | "analysis"
  | "settings"
  | "observability"
  | "document"
  | "openai"
  | "recognition"
  | "draft"
  | "fallback"
  | "grafana"
  | "dashboard"
  | "alert"
  | "export";

export type AboutAccent = "green" | "blue" | "purple" | "orange" | "neutral";

export interface AboutLink {
  label: string;
  href?: string;
  external?: boolean;
}

export interface PurposeCard {
  number: string;
  title: string;
  description: string;
  icon: AboutIcon;
  accent: "green" | "blue" | "purple" | "orange";
  link?: AboutLink;
  linkKey?: "interview";
}

export interface SectionTile {
  title: string;
  description: string;
  icon: AboutIcon;
}

export const PROJECT_URL = "https://gimme-job.com";
export const REPO_URL = "https://github.com/sergiiiavt/gimme-job";
export const ACTIONS_URL = `${REPO_URL}/actions`;
export const CI_WORKFLOW_URL = `${REPO_URL}/blob/main/.github/workflows/ci.yml`;
export const DB_SCHEMA_URL = `${REPO_URL}/blob/main/db/schema.ts`;
export const MIGRATIONS_URL = `${REPO_URL}/tree/main/drizzle`;
export const JOBPILOT_URL = `${REPO_URL}/blob/main/app/api/_jobpilot.ts`;
export const ANALYST_URL = `${REPO_URL}/blob/main/agent/src/analyst.ts`;
export const WORKER_SOURCE_URL = `${REPO_URL}/blob/main/worker/index.ts`;
export const GRAFANA_DASHBOARD_URL = "https://gentlecabbage323.grafana.net/public-dashboards/8c022097cb6544f2a5f9dff1cfab4e7b";
export const CLOUDFLARE_WORKERS_LOGS_URL = "https://dash.cloudflare.com/4f8e29835b9bb4e2330170ca94ac8f2b/workers/services/view/gimmejob/production/observability/events";

export const GRAFANA_DASHBOARD_LINK: AboutLink = {
  label: "Grafana dashboard",
  href: GRAFANA_DASHBOARD_URL,
};

export const ABOUT_OVERVIEW = {
  eyebrow: "OVERVIEW",
  title: "Why I created this site",
  subtitle:
    "Four practical goals: job search, technology experiments, AI-assisted development, and QA learning.",
};

export const PURPOSE_CARDS: PurposeCard[] = [
  {
    number: "01",
    title: "Find a job",
    description: "Aggregates vacancies from four data sources into one place for review and analysis.",
    icon: "search",
    accent: "green",
    link: { label: "Production site", href: PROJECT_URL, external: true },
  },
  {
    number: "02",
    title: "Create a technology playground",
    description: "A real production project for trying, integrating, and learning new technologies in practice.",
    icon: "code",
    accent: "blue",
    link: { label: "GitHub repo", href: REPO_URL, external: true },
  },
  {
    number: "03",
    title: "Use an AI-assisted development workflow",
    description: "The project is developed with Codex and Claude Code throughout the development workflow.",
    icon: "ai",
    accent: "purple",
    link: { label: "Source repository", href: REPO_URL, external: true },
  },
  {
    number: "04",
    title: "Build a QA knowledge base",
    description: "A structured knowledge base covering interview questions, learning paths, and different QA-related areas.",
    icon: "book",
    accent: "orange",
    link: { label: "Interview catalog", external: false },
    linkKey: "interview",
  },
];

export const DEPLOYMENT = {
  title: "Deployment",
  description: "Code is stored in GitHub, built in GitHub Actions, and deployed on Cloudflare.",
  github: {
    title: "GitHub",
    description: "Source repository",
    icon: "github" as const,
    accent: "neutral" as const,
    links: [{ label: "Repo", href: REPO_URL, external: true }],
  },
  actions: {
    title: "GitHub Actions",
    description: "Build, checks, and deployment workflow",
    icon: "actions" as const,
    accent: "blue" as const,
    links: [
      { label: "Actions", href: ACTIONS_URL, external: true },
      { label: "Workflow", href: CI_WORKFLOW_URL, external: true },
    ],
  },
  cloudflare: {
    title: "Cloudflare Platform",
    icon: "cloudflare" as const,
    accent: "orange" as const,
    links: [{ label: "Production site", href: PROJECT_URL, external: true }],
    tiles: [
      {
        title: "Workers",
        description: "Edge/runtime execution",
        icon: "worker" as const,
      },
      {
        title: "Static assets",
        description: "Frontend assets served with the deployment",
        icon: "asset" as const,
      },
    ] satisfies SectionTile[],
  },
};

export const DATABASE = {
  title: "Database",
  description: "Application data is stored in Cloudflare D1.",
  worker: {
    title: "Worker app",
    description: "Application reads and writes",
    icon: "worker" as const,
    accent: "green" as const,
  },
  d1: {
    title: "D1 Database",
    description: "Production application storage",
    icon: "database" as const,
    accent: "blue" as const,
    links: [
      { label: "Schema", href: DB_SCHEMA_URL, external: true },
      { label: "Migrations", href: MIGRATIONS_URL, external: true },
    ],
  },
  groups: [
    { title: "Jobs", description: "Stored vacancies", icon: "jobs" as const },
    { title: "Analyses", description: "Analysis results", icon: "analysis" as const },
    { title: "Settings", description: "Application settings", icon: "settings" as const },
    { title: "Observability", description: "Events and snapshots", icon: "observability" as const },
  ] satisfies SectionTile[],
};

export const OPENAI = {
  title: "OpenAI integration",
  description: "OpenAI is used for vacancy recognition, analysis, and drafting support.",
  input: {
    title: "Job text + profile",
    description: "Vacancy text and candidate context",
    icon: "document" as const,
    accent: "neutral" as const,
  },
  api: {
    title: "OpenAI API",
    icon: "openai" as const,
    accent: "green" as const,
    links: [
      { label: "Production code", href: JOBPILOT_URL, external: true },
      { label: "Local analyst", href: ANALYST_URL, external: true },
    ],
  },
  outputs: [
    { title: "Recognition", description: "Extract structured vacancy information", icon: "recognition" as const },
    { title: "Analysis", description: "Score, match, and explain", icon: "analysis" as const },
    { title: "Drafts", description: "Resume and application drafting support", icon: "draft" as const },
  ] satisfies SectionTile[],
  fallback: {
    title: "Fallback",
    description: "Deterministic logic when AI is unavailable.",
    icon: "fallback" as const,
    accent: "neutral" as const,
  },
};

export const GRAFANA = {
  title: "Observability",
  description:
    "Short-term production diagnostics and long-term operational monitoring.",
  workersLogs: {
    title: "Cloudflare Workers Logs",
    description: "Recent runtime diagnostics",
    icon: "document" as const,
    accent: "blue" as const,
    links: [{ label: "Open logs", href: CLOUDFLARE_WORKERS_LOGS_URL, external: true }],
  },
  sourceEvents: {
    title: "App events",
    description: "Selected operational events",
    icon: "observability" as const,
    accent: "green" as const,
  },
  sourceSummary: {
    title: "D1 summary API",
    description: "Aggregated long-term metrics",
    icon: "database" as const,
    accent: "blue" as const,
    links: [{ label: "API implementation", href: WORKER_SOURCE_URL, external: true }],
  },
  grafana: {
    title: "Grafana",
    description: "Dashboards and alerting",
    icon: "grafana" as const,
    accent: "orange" as const,
    links: [
      GRAFANA_DASHBOARD_LINK,
      { label: "Observability API source", href: WORKER_SOURCE_URL, external: true },
    ],
  },
  outputs: [
    { title: "Dashboards", description: "System and usage metrics", icon: "dashboard" as const },
    { title: "Alerts", description: "Thresholds and notifications", icon: "alert" as const },
    { title: "Export", description: "Data used for further analysis", icon: "export" as const },
  ] satisfies SectionTile[],
};
