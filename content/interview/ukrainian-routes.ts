import { INTERVIEW_DOMAIN_ROUTES } from "./domain-routes.ts";

export const UK_INTERVIEW_INDEX = {
  englishPath: "/interview",
  path: "/uk/interview",
  title: "Питання QA для співбесіди українською",
  description: "Практичні питання та відповіді для QA-співбесід українською: основи тестування, test design, API, бази даних, автоматизація, стратегія, метрики та реальні інженерні сценарії.",
  label: "Generic QA",
  domainId: "generic-qa",
} as const;

export const UK_PYTHON_INTERVIEW = {
  englishPath: "/interview/python",
  path: "/uk/interview/python",
  title: "Питання Python для QA Automation співбесіди",
  description: "Практичні питання та відповіді з Python українською для QA Automation: core language, структури даних, OOP, pytest, web/API automation, code examples і практичні задачі.",
  label: "Python",
} as const;

const UK_DOMAIN_COPY = {
  "generic-qa": {
    label: "Generic QA",
    title: "Загальні питання QA для співбесіди",
    description: "Практичні загальні QA-питання та відповіді українською: основи тестування, test design, дефекти, delivery, метрики, стратегія, leadership, reliability і quality engineering.",
  },
  automation: {
    label: "Automation QA",
    title: "Питання QA Automation для співбесіди",
    description: "Практичні питання з автоматизації тестування українською: framework design, maintainable test code, CI, programming concepts, automation strategy і test architecture.",
  },
  sql: {
    label: "SQL та бази даних",
    title: "SQL і бази даних: питання для QA співбесіди",
    description: "Практичні SQL та database питання українською для QA й automation engineers: queries, joins, aggregation, transactions, data integrity, BI validation і тестові сценарії.",
  },
  "web-api": {
    label: "Web та API",
    title: "Web та API Testing: питання для співбесіди",
    description: "Практичні питання з Web та API testing українською: HTTP, REST, contracts, authentication, integrations, browser behavior, service failures і data flows.",
  },
  performance: {
    label: "Performance Testing",
    title: "Performance Testing: питання для співбесіди",
    description: "Практичні питання з performance testing українською: workload modelling, load і stress testing, percentiles, throughput, JMeter, k6, distributed load generation, bottleneck analysis, endurance, spike testing і CI performance gates.",
  },
  mobile: {
    label: "Mobile",
    title: "Mobile Testing: питання для співбесіди",
    description: "Практичні питання з mobile testing українською: Android та iOS, devices, app lifecycle, permissions, network constraints, releases, diagnostics і automation.",
  },
  "embedded-iot": {
    label: "Embedded та IoT",
    title: "Embedded та IoT Testing: питання для співбесіди",
    description: "Практичні питання з embedded та IoT testing українською: firmware, hardware interfaces, real-time behavior, power, OTA, constrained devices, diagnostics та IoT security.",
  },
  "ai-llm": {
    label: "AI та LLM QA",
    title: "AI та LLM Testing: питання для співбесіди",
    description: "Практичні питання з AI та LLM testing українською: model and dataset quality, LLM evaluation, RAG, prompt security, agents, non-determinism, reliability і quality engineering.",
  },
} as const;

export const UKRAINIAN_INTERVIEW_DOMAIN_ROUTES = INTERVIEW_DOMAIN_ROUTES.map((route) => {
  const copy = UK_DOMAIN_COPY[route.slug];
  return {
    ...route,
    englishPath: route.path,
    path: `/uk${route.path}` as `/uk${string}`,
    ukLabel: copy.label,
    ukTitle: copy.title,
    ukDescription: copy.description,
  };
});

export type UkrainianInterviewDomainRoute = (typeof UKRAINIAN_INTERVIEW_DOMAIN_ROUTES)[number];

export function ukrainianInterviewDomainRouteBySlug(slug: string): UkrainianInterviewDomainRoute | undefined {
  return UKRAINIAN_INTERVIEW_DOMAIN_ROUTES.find((route) => route.slug === slug);
}

export function ukrainianInterviewPath(englishPath: string): string {
  return `/uk${englishPath.startsWith("/") ? englishPath : `/${englishPath}`}`;
}
