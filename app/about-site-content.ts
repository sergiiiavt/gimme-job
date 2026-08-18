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
  | "export"
  | "n8n"
  | "gmail"
  | "hetzner"
  | "docker"
  | "sonarqube";

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
export const SONARQUBE_CONFIG_URL = `${REPO_URL}/blob/main/sonar-project.properties`;
export const SONARQUBE_PROJECT_URL = "https://sonarcloud.io/summary/overall?id=sergiiiavt_gimme-job&branch=main";
export const GRAFANA_DASHBOARD_URL = "https://gentlecabbage323.grafana.net/public-dashboards/8c022097cb6544f2a5f9dff1cfab4e7b";
export const CLOUDFLARE_WORKERS_LOGS_URL = "https://dash.cloudflare.com/4f8e29835b9bb4e2330170ca94ac8f2b/workers/services/view/gimmejob/production/observability/events";
export const N8N_URL = "https://n8n.gimme-job.com";
export const N8N_DOC_URL = `${REPO_URL}/blob/main/docs/n8n-gmail-integration.md`;
export const N8N_WORKFLOW_URL = `${REPO_URL}/blob/main/ops/n8n/workflows/gimmejob-forwarded-email-classifier.json`;
export const N8N_DAILY_REPORT_WORKFLOW_URL = `${REPO_URL}/blob/main/ops/n8n/workflows/gimmejob-daily-email-report.json`;
export const N8N_EMAIL_STATS_URL = `${REPO_URL}/blob/main/app/internal/n8n/email-stats/route.ts`;
export const HETZNER_INFRA_URL = `${REPO_URL}/tree/main/ops/hetzner`;
export const HETZNER_PROVISION_URL = `${REPO_URL}/blob/main/ops/hetzner/provision.mjs`;
export const HETZNER_BOOTSTRAP_URL = `${REPO_URL}/blob/main/ops/hetzner/bootstrap.sh`;
export const HETZNER_COMPOSE_URL = `${REPO_URL}/blob/main/ops/hetzner/docker-compose.yml`;
export const HETZNER_WORKFLOW_URL = `${REPO_URL}/blob/main/.github/workflows/hetzner-n8n.yml`;

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
    description: "Supports vacancy collection from five job boards in one review and analysis workflow.",
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
    icon: "cloudflare" as const,
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

export const N8N = {
  title: "n8n email automation",
  description:
    "Two production n8n workflows process forwarded job-email events and send a daily operational report while GimmeJob keeps D1 as the source of truth.",
  gmail: {
    title: "Gmail forwarding",
    description: "User filters forward selected job emails to a per-user GimmeJob token address",
    icon: "gmail" as const,
    accent: "neutral" as const,
  },
  routing: {
    title: "Cloudflare Email Routing",
    description: "Routes the forwarded message to the GimmeJob Worker email handler",
    icon: "cloudflare" as const,
    accent: "orange" as const,
  },
  eventStore: {
    title: "Worker + email events",
    description: "Resolves the tenant and stores structured metadata in D1",
    icon: "worker" as const,
    accent: "blue" as const,
  },
  orchestrator: {
    title: "n8n · 2 production workflows",
    description:
      "Workflow 1 runs every minute: classify pending mail with deterministic rules first and OpenAI only when needed. Workflow 2 runs daily at 08:00 Kyiv: read D1 statistics, format the previous day's report, and send it by SMTP.",
    icon: "n8n" as const,
    accent: "purple" as const,
    links: [
      { label: "n8n", href: N8N_URL, external: true },
      { label: "Classifier", href: N8N_WORKFLOW_URL, external: true },
      { label: "Daily report", href: N8N_DAILY_REPORT_WORKFLOW_URL, external: true },
      { label: "Stats API", href: N8N_EMAIL_STATS_URL, external: true },
      { label: "Integration docs", href: N8N_DOC_URL, external: true },
    ],
  },
  outputs: [
    {
      title: "Classification",
      description: "Lifecycle, job alert, service, non-job, or review classification persisted in D1",
      icon: "analysis" as const,
    },
    {
      title: "Daily statistics",
      description: "Received, processed, pending, job-relevant, rule-vs-AI, token, held, and failure metrics",
      icon: "dashboard" as const,
    },
    {
      title: "Daily SMTP report",
      description: "Previous complete Kyiv day is formatted as HTML and emailed at 08:00",
      icon: "gmail" as const,
    },
    {
      title: "D1 state",
      description: "GimmeJob remains the system of record; n8n orchestrates but does not own application state",
      icon: "cloudflare" as const,
    },
  ] satisfies SectionTile[],
};

export const INFRASTRUCTURE = {
  title: "Infrastructure as Code",
  description:
    "The production n8n environment is provisioned and configured from repository code on Hetzner Cloud.",
  actions: {
    title: "GitHub Actions",
    description: "Runs the production provisioning workflow on infrastructure changes or manual dispatch",
    icon: "actions" as const,
    accent: "blue" as const,
    links: [{ label: "Provision workflow", href: HETZNER_WORKFLOW_URL, external: true }],
  },
  provisioner: {
    title: "IaC provisioner",
    description: "Creates or reuses the server and firewall, applies cloud-init, and configures Cloudflare DNS",
    icon: "code" as const,
    accent: "green" as const,
    links: [
      { label: "Infrastructure code", href: HETZNER_INFRA_URL, external: true },
      { label: "Provisioner", href: HETZNER_PROVISION_URL, external: true },
    ],
  },
  runtime: {
    title: "Hetzner CX23",
    description: "Ubuntu 24.04 production VM created reproducibly from code",
    icon: "hetzner" as const,
    accent: "orange" as const,
    links: [
      { label: "Bootstrap", href: HETZNER_BOOTSTRAP_URL, external: true },
      { label: "Docker Compose", href: HETZNER_COMPOSE_URL, external: true },
    ],
    tiles: [
      {
        title: "Docker runtime",
        description: "n8n + PostgreSQL + Caddy",
        icon: "docker" as const,
      },
      {
        title: "Persistent data",
        description: "PostgreSQL, n8n, and Caddy volumes",
        icon: "database" as const,
      },
      {
        title: "Hetzner firewall",
        description: "Public 22/80/443; application and database ports stay internal",
        icon: "hetzner" as const,
      },
      {
        title: "Cloudflare DNS",
        description: "n8n.gimme-job.com points to the provisioned production VM",
        icon: "cloudflare" as const,
      },
    ] satisfies SectionTile[],
  },
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
    icon: "worker" as const,
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
    icon: "cloudflare" as const,
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

export const CODE_QUALITY = {
  title: "Code quality & security",
  description: "CI generates test coverage and sends static-analysis results to SonarQube Cloud before deployment.",
  ci: {
    title: "GitHub Actions",
    description: "Tests, LCOV coverage, and Sonar scan",
    icon: "actions" as const,
    accent: "blue" as const,
    links: [
      { label: "Actions", href: ACTIONS_URL, external: true },
      { label: "Workflow", href: CI_WORKFLOW_URL, external: true },
    ],
  },
  sonar: {
    title: "SonarQube Cloud",
    description: "Static analysis, quality gate, and code-quality history",
    icon: "sonarqube" as const,
    accent: "purple" as const,
    links: [
      { label: "Live analysis", href: SONARQUBE_PROJECT_URL, external: true },
      { label: "Sonar config", href: SONARQUBE_CONFIG_URL, external: true },
    ],
  },
  outputs: [
    { title: "Security & reliability", description: "Security and bug findings", icon: "alert" as const },
    { title: "Maintainability", description: "Code smells and technical debt", icon: "code" as const },
    { title: "Coverage & duplication", description: "LCOV coverage and duplicated code", icon: "dashboard" as const },
  ] satisfies SectionTile[],
};