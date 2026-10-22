import { INTERVIEW_DOMAIN_ROUTES } from "./domain-routes.ts";

export const UK_INTERVIEW_INDEX = {
  englishPath: "/interview",
  path: "/uk/interview",
  title: "Питання для QA-співбесіди українською",
  description: "Практичні питання та відповіді для QA-співбесід українською: основи тестування, тест-дизайн, API, бази даних, автоматизація, стратегія, метрики та реальні інженерні сценарії.",
  label: "Загальні питання QA",
  domainId: "generic-qa",
} as const;

export const UK_PYTHON_INTERVIEW = {
  englishPath: "/interview/python",
  path: "/uk/interview/python",
  title: "Python: питання для співбесіди з автоматизації тестування",
  description: "Практичні питання та відповіді з Python для фахівців з автоматизації тестування: основи мови, структури даних, ООП, pytest, автоматизація вебзастосунків і API, приклади коду та практичні завдання.",
  label: "Python",
} as const;

const UK_DOMAIN_COPY = {
  "generic-qa": {
    label: "Загальні питання QA",
    title: "Загальні питання QA для співбесіди",
    description: "Практичні загальні QA-питання та відповіді українською: основи тестування, test design, дефекти, постачання ПЗ, метрики, стратегія, лідерство, надійність та інженерія якості.",
  },
  "os-command-line": {
    label: "ОС і командний рядок",
    title: "Windows, Linux і командний рядок: питання для співбесіди",
    description: "Практичні питання для QA/SDET про Windows Command Prompt, PowerShell, команди Linux, файли, журнали, права доступу, процеси, служби, мережі, ресурси та діагностику проблем.",
  },
  automation: {
    label: "Автоматизація тестування",
    title: "Автоматизація тестування: питання для співбесіди",
    description: "Практичні питання з автоматизації тестування українською: проєктування фреймворків, супровід тестового коду, CI, основи програмування, стратегія автоматизації та архітектура тестів.",
  },
  sql: {
    label: "SQL та бази даних",
    title: "SQL і бази даних: питання для QA-співбесіди",
    description: "Практичні питання про SQL і бази даних для QA та інженерів з автоматизації: запити, об’єднання таблиць, агрегування, транзакції, цілісність даних, перевірка BI та тестові сценарії.",
  },
  "web-api": {
    label: "Web та API",
    title: "Тестування вебзастосунків і API: питання для співбесіди",
    description: "Практичні питання з тестування вебзастосунків і API: HTTP, REST, контракти, автентифікація, інтеграції, поведінка браузера, збої сервісів і потоки даних.",
  },
  performance: {
    label: "Тестування продуктивності",
    title: "Тестування продуктивності: питання для співбесіди",
    description: "Практичні питання з тестування продуктивності: моделювання навантаження, навантажувальні та стресові тести, процентилі, пропускна здатність, JMeter, k6, розподілена генерація навантаження, вузькі місця, тривалі й пікові навантаження та перевірки продуктивності в CI.",
  },
  mobile: {
    label: "Мобільне тестування",
    title: "Мобільне тестування: питання для співбесіди",
    description: "Практичні питання з мобільного тестування: Android та iOS, пристрої, життєвий цикл застосунку, дозволи, мережеві обмеження, релізи, діагностика й автоматизація.",
  },
  "embedded-iot": {
    label: "Вбудовані системи та IoT",
    title: "Вбудовані системи та IoT: питання для співбесіди",
    description: "Практичні питання з тестування вбудованих систем та IoT: прошивки, апаратні інтерфейси, робота в реальному часі, живлення, OTA-оновлення, обмежені ресурси пристроїв, діагностика та безпека.",
  },
  "ai-llm": {
    label: "AI та LLM QA",
    title: "Тестування AI та LLM: питання для співбесіди",
    description: "Практичні питання з тестування AI та LLM: якість моделей і наборів даних, оцінювання LLM, RAG, безпека промптів, агенти, недетермінованість, надійність та інженерія якості.",
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
