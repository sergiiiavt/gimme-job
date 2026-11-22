import sourcesData from "./sources.json";
import observabilityForQa from "./01-observability-for-qa.md?raw";
import observabilityForQaUk from "./01-observability-for-qa.uk.md?raw";
import structuredLogs from "./02-structured-logs.md?raw";
import structuredLogsUk from "./02-structured-logs.uk.md?raw";
import metrics from "./03-metrics.md?raw";
import metricsUk from "./03-metrics.uk.md?raw";
import distributedTracing from "./04-distributed-tracing.md?raw";
import distributedTracingUk from "./04-distributed-tracing.uk.md?raw";
import sloErrorBudgets from "./05-slo-error-budgets.md?raw";
import sloErrorBudgetsUk from "./05-slo-error-budgets.uk.md?raw";
import alertingIncidents from "./06-alerting-incidents.md?raw";
import alertingIncidentsUk from "./06-alerting-incidents.uk.md?raw";

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
  chapter({
    id: "distributed-tracing",
    label: "Distributed tracing",
    labelUk: "Розподілене трасування",
    description: "Traces and spans, W3C traceparent propagation, head and tail sampling, reading a trace, traces in QA work, and operation ids as correlation before tracing.",
    descriptionUk: "Трасування й span, передавання контексту через W3C traceparent, head і tail sampling, як читати трасування, трасування в роботі QA і operation id як кореляція до трасування.",
  }, distributedTracing, distributedTracingUk, ["w3c-trace-context", "otel-traces", "otel-context-propagation", "otel-sampling", "otel-signals"]),
  chapter({
    id: "slo-error-budgets",
    label: "SLIs, SLOs and error budgets",
    labelUk: "SLI, SLO та error budget",
    description: "SLIs, SLOs and SLAs, choosing indicators from user journeys, setting targets, error budgets and policies, burn-rate alerts, SLOs in QA work, and a proposed SLO set for this site.",
    descriptionUk: "SLI, SLO і SLA, вибір показників зі шляхів користувача, постановка цілей, error budget і політики, алерти за burn rate, SLO в роботі QA і запропонований набір SLO для цього сайту.",
  }, sloErrorBudgets, sloErrorBudgetsUk, ["sre-slo", "sre-embracing-risk", "sre-alerting-on-slos", "sre-error-budget-policy", "google-sre-monitoring", "prometheus-histograms"]),
  chapter({
    id: "alerting-incidents",
    label: "Alerting and incident response",
    labelUk: "Алерти й реагування на інциденти",
    description: "Good alerts, page versus ticket, runbooks, incident roles and priorities, QA during and after incidents, blameless postmortems, testing alerts, and a postmortem of a real incident on this site.",
    descriptionUk: "Добрі алерти, page проти ticket, runbook, ролі й пріоритети під час інцидентів, QA під час і після інцидентів, постмортеми без пошуку винних, тестування алертів і постмортем реального інциденту на цьому сайті.",
  }, alertingIncidents, alertingIncidentsUk, ["google-sre-monitoring", "sre-practical-alerting", "sre-alerting-on-slos", "sre-managing-incidents", "sre-postmortem-culture"]),
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
