import sourcesData from "./sources.json";
import observabilityForQa from "./01-observability-for-qa.md?raw";
import observabilityForQaUk from "./01-observability-for-qa.uk.md?raw";
import structuredLogs from "./02-structured-logs.md?raw";
import structuredLogsUk from "./02-structured-logs.uk.md?raw";
import metrics from "./03-metrics.md?raw";
import metricsUk from "./03-metrics.uk.md?raw";

export type ObservabilityTopicStatus = "published" | "under-construction";

export interface ObservabilitySource {
  id: string;
  title: string;
  publisher: string;
  kind: string;
  url: string;
  role: string;
  checkedAt: string;
}

export interface ObservabilityTopic {
  id: string;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  status: ObservabilityTopicStatus;
  markdown: string;
  markdownUk: string;
  sourceIds: string[];
}

type TopicFields = Pick<ObservabilityTopic, "id" | "label" | "labelUk" | "description" | "descriptionUk">;

const chapter = (fields: TopicFields, markdown: string, markdownUk: string, sourceIds: string[]): ObservabilityTopic => ({
  ...fields,
  status: "published",
  markdown,
  markdownUk,
  sourceIds,
});

/** A reserved chapter: listed in navigation, never retrieved or indexed until it is written. */
const planned = (fields: TopicFields): ObservabilityTopic => ({
  ...fields,
  status: "under-construction",
  markdown: `## Under construction\n\n${fields.description}`,
  markdownUk: `## У розробці\n\n${fields.descriptionUk}`,
  sourceIds: [],
});

const topics: ObservabilityTopic[] = [
  chapter({
    id: "observability-for-qa",
    label: "Observability for QA engineers",
    labelUk: "Спостережуваність для QA-інженерів",
    description: "Monitoring versus observability, logs, metrics and traces, symptoms versus causes, how QA uses telemetry, making tests observable, and a real incident that monitoring missed.",
    descriptionUk: "Моніторинг проти спостережуваності, логи, метрики й трасування, симптоми проти причин, як QA використовує телеметрію, як зробити тести спостережуваними, і реальний інцидент, який моніторинг пропустив.",
  }, observabilityForQa, observabilityForQaUk, ["honeycomb-observability", "otel-signals", "otel-logs", "google-sre-monitoring", "twelve-factor-logs"]),
  chapter({
    id: "structured-logs",
    label: "Logs that answer questions",
    labelUk: "Логи, що відповідають на питання",
    description: "Structured events with a stable schema, the fields every event needs, levels, what never to log, querying, sampling and retention, logs in tests, and GimmeJob's two logging layers.",
    descriptionUk: "Структуровані події зі стабільною схемою, поля, потрібні кожній події, рівні, що ніколи не логувати, запити, вибірка й строк зберігання, логи в тестах і два рівні логування GimmeJob.",
  }, structuredLogs, structuredLogsUk, ["twelve-factor-logs", "otel-logs", "owasp-logging", "cloudflare-workers-logs", "otel-signals"]),
  chapter({
    id: "metrics",
    label: "Metrics, golden signals and percentiles",
    labelUk: "Метрики, золоті сигнали й перцентилі",
    description: "Counters, gauges and histograms, the golden signals, RED and USE, why averages hide the tail, percentiles you can and cannot combine, cardinality, naming, and metrics in QA work.",
    descriptionUk: "Лічильники, gauge і гістограми, золоті сигнали, RED і USE, чому середні ховають хвіст, які перцентилі можна поєднувати, а які ні, кардинальність, іменування й метрики в роботі QA.",
  }, metrics, metricsUk, ["prometheus-metric-types", "prometheus-histograms", "prometheus-naming", "otel-metrics", "google-sre-monitoring", "usemethod", "red-method"]),
  planned({
    id: "distributed-tracing",
    label: "Distributed tracing",
    labelUk: "Розподілене трасування",
    description: "Spans and traces, context propagation across services, OpenTelemetry, sampling, and using traces to debug flaky end-to-end tests.",
    descriptionUk: "Span і трасування, передавання контексту між сервісами, OpenTelemetry, вибірка й використання трасування для налагодження нестабільних end-to-end тестів.",
  }),
  planned({
    id: "slo-error-budgets",
    label: "SLIs, SLOs and error budgets",
    labelUk: "SLI, SLO та error budget",
    description: "Choosing service level indicators, setting objectives, error budget policies, burn-rate alerts and release decisions based on reliability.",
    descriptionUk: "Вибір показників рівня сервісу, цілі, політики error budget, алерти за швидкістю витрачання бюджету й рішення про реліз на основі надійності.",
  }),
  planned({
    id: "alerting-incidents",
    label: "Alerting and incident response",
    labelUk: "Алерти й реагування на інциденти",
    description: "Symptom-based alerts, runbooks, on-call, blameless postmortems and the role of QA during and after incidents.",
    descriptionUk: "Алерти за симптомами, runbook, чергування, постмортеми без пошуку винних і роль QA під час інцидентів і після них.",
  }),
  planned({
    id: "testing-in-production",
    label: "Testing in production",
    labelUk: "Тестування в продакшні",
    description: "Synthetic monitoring, canary releases, feature flags, dark launches and controlled chaos experiments, done safely.",
    descriptionUk: "Синтетичний моніторинг, canary-релізи, feature flags, приховані запуски й контрольовані хаос-експерименти без шкоди користувачам.",
  }),
  planned({
    id: "observability-lab",
    label: "Observability lab",
    labelUk: "Лабораторна зі спостережуваності",
    description: "A runnable lab: instrument a small service with logs, metrics and traces, define an SLO and test against it.",
    descriptionUk: "Практична лабораторна: додати логи, метрики й трасування до невеликого сервісу, визначити SLO і тестувати відносно нього.",
  }),
];

export const observabilityCatalog = {
  title: "Observability & SRE",
  titleUk: "Спостережуваність і SRE",
  description: "Logs, metrics, traces, SLOs, alerting, incidents and testing in production, from the point of view of a QA engineer.",
  descriptionUk: "Логи, метрики, трасування, SLO, алерти, інциденти й тестування в продакшні з погляду QA-інженера.",
  sources: sourcesData as ObservabilitySource[],
  topics,
};

export default observabilityCatalog;
