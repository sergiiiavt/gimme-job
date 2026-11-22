import sourcesData from "./sources.json";
import howAgentsWork from "./01-how-agents-work.md?raw";
import howAgentsWorkUk from "./01-how-agents-work.uk.md?raw";
import toolDesign from "./02-tool-design.md?raw";
import toolDesignUk from "./02-tool-design.uk.md?raw";
import modelContextProtocol from "./03-model-context-protocol.md?raw";
import modelContextProtocolUk from "./03-model-context-protocol.uk.md?raw";
import stateMemoryRag from "./04-state-memory-rag.md?raw";
import stateMemoryRagUk from "./04-state-memory-rag.uk.md?raw";
import humanApproval from "./05-human-approval.md?raw";
import humanApprovalUk from "./05-human-approval.uk.md?raw";
import codingAgentsForQa from "./06-coding-agents-for-qa.md?raw";
import codingAgentsForQaUk from "./06-coding-agents-for-qa.uk.md?raw";
import agentObservability from "./07-agent-observability.md?raw";
import agentObservabilityUk from "./07-agent-observability.uk.md?raw";
import agentProjectsLab from "./08-agent-projects-lab.md?raw";
import agentProjectsLabUk from "./08-agent-projects-lab.uk.md?raw";

export type AgenticTopicStatus = "published" | "under-construction";

export interface AgenticSource {
  id: string;
  title: string;
  publisher: string;
  kind: string;
  url: string;
  role: string;
  checkedAt: string;
}

export interface AgenticTopic {
  id: string;
  label: string;
  labelUk: string;
  description: string;
  descriptionUk: string;
  status: AgenticTopicStatus;
  markdown: string;
  markdownUk: string;
  sourceIds: string[];
}

type TopicFields = Pick<AgenticTopic, "id" | "label" | "labelUk" | "description" | "descriptionUk">;

const chapter = (fields: TopicFields, markdown: string, markdownUk: string, sourceIds: string[]): AgenticTopic => ({
  ...fields,
  status: "published",
  markdown,
  markdownUk,
  sourceIds,
});

const topics: AgenticTopic[] = [
  chapter({
    id: "how-agents-work",
    label: "How an AI agent works",
    labelUk: "Як працює AI-агент",
    description: "The agent loop, workflows versus agents, the five workflow patterns, when an agent is the wrong tool, the parts you own, and reading an agent run.",
    descriptionUk: "Цикл агента, workflow проти агента, п'ять шаблонів workflow, коли агент не потрібен, з чого складається агент і як читати його запуск.",
  }, howAgentsWork, howAgentsWorkUk, ["anthropic-building-agents", "yao-react", "anthropic-tool-use", "openai-function-calling", "anthropic-writing-tools"]),
  chapter({
    id: "tool-design",
    label: "Designing tools for agents",
    labelUk: "Проєктування інструментів для агентів",
    description: "Tool names and descriptions, argument schemas, results the model can use, recoverable errors, read and write tools, idempotency, retries, limits and how many tools to expose.",
    descriptionUk: "Назви й описи інструментів, схеми аргументів, корисні результати, помилки, після яких модель може виправитися, читання й запис, ідемпотентність, повтори, ліміти й кількість інструментів.",
  }, toolDesign, toolDesignUk, ["anthropic-writing-tools", "anthropic-tool-use", "openai-function-calling", "json-schema-docs", "mcp-tools", "aws-backoff-jitter", "rfc-9110", "idempotency-key-draft"]),
  chapter({
    id: "model-context-protocol",
    label: "Model Context Protocol (MCP)",
    labelUk: "Model Context Protocol (MCP)",
    description: "Hosts, clients and servers, tools, resources and prompts, JSON-RPC messages, stdio and Streamable HTTP, protocol revisions, authorization and trust, and the GimmeJob MCP endpoint as a case study.",
    descriptionUk: "Host, клієнт і сервер, tools, resources і prompts, повідомлення JSON-RPC, stdio і Streamable HTTP, ревізії протоколу, авторизація й довіра, а також MCP-ендпоінт GimmeJob як приклад.",
  }, modelContextProtocol, modelContextProtocolUk, ["mcp-spec", "mcp-changelog", "mcp-versioning", "mcp-transports", "mcp-tools", "mcp-authorization", "mcp-security", "mcp-inspector", "jsonrpc-spec", "rfc-9728", "rfc-8707", "owasp-llm-top10", "greshake-indirect-injection"]),
  chapter({
    id: "state-memory-rag",
    label: "State, memory and RAG",
    labelUk: "Стан, пам'ять і RAG",
    description: "The context window as the model's only memory, four kinds of state, keeping long sessions in budget, retrieval as memory, long-term memory boundaries and the Learning Path Advisor as a case study.",
    descriptionUk: "Контекстне вікно як єдина пам'ять моделі, чотири види стану, довгі сесії в межах бюджету, пошук як пам'ять, межі довгої пам'яті й Learning Path Advisor як приклад.",
  }, stateMemoryRag, stateMemoryRagUk, ["anthropic-context-engineering", "liu-lost-middle", "lewis-rag", "anthropic-building-agents", "greshake-indirect-injection", "owasp-llm-top10"]),
  chapter({
    id: "human-approval",
    label: "Human approval and action boundaries",
    labelUk: "Підтвердження людиною й межі дій",
    description: "Excessive agency, classifying actions by impact, approval gates bound to exact arguments, least privilege, indirect prompt injection and the lethal trifecta, dry runs and kill switches.",
    descriptionUk: "Надмірна автономність, класифікація дій за наслідками, підтвердження конкретних аргументів, мінімальні права, непряма prompt injection, lethal trifecta, dry-run і аварійні вимикачі.",
  }, humanApproval, humanApprovalUk, ["owasp-excessive-agency", "willison-lethal-trifecta", "debenedetti-camel", "greshake-indirect-injection", "owasp-llm-top10", "mcp-tools"]),
  chapter({
    id: "coding-agents-for-qa",
    label: "AI coding agents in QA work",
    labelUk: "AI coding agents у роботі QA",
    description: "What coding agents are, AGENTS.md and project rules, QA tasks that fit, catching weakened tests in an agent's diff, how this site is built with agents and what productivity studies show.",
    descriptionUk: "Що таке coding agents, AGENTS.md і правила проєкту, які задачі QA їм підходять, як помітити послаблені тести в diff агента, як цей сайт будується з агентами і що кажуть дослідження продуктивності.",
  }, codingAgentsForQa, codingAgentsForQaUk, ["agents-md", "claude-code-memory", "copilot-coding-agent", "metr-2025-study", "metr-2026-update", "jimenez-swe-bench", "anthropic-context-engineering"]),
  chapter({
    id: "agent-observability",
    label: "Evaluating and observing agents",
    labelUk: "Оцінювання та спостережуваність агентів",
    description: "What to record per agent task, task-level metrics such as cost per successful task and budget exhaustion, recording decisions, safe and cheap traces, and turning bad runs into evaluation cases.",
    descriptionUk: "Що записувати для кожної задачі агента, метрики на рівні задачі на кшталт вартості успішної задачі й вичерпаних бюджетів, запис рішень, безпечне й недороге трасування і перетворення поганих запусків на випадки для оцінювання.",
  }, agentObservability, agentObservabilityUk, ["otel-genai-semconv", "langfuse-observability", "google-sre-monitoring", "anthropic-building-agents", "anthropic-context-engineering"]),
  chapter({
    id: "agent-projects-lab",
    label: "Projects and MCP lab",
    labelUk: "Проєкти й лабораторія MCP",
    description: "Choosing narrow agent projects for QA, a definition of done, and a runnable lab: an MCP server, client and triage agent on the 2026-07-28 revision of the protocol.",
    descriptionUk: "Як обрати вузький агентний проєкт для QA, визначення «готово» і практична лабораторна: MCP-сервер, клієнт і агент для розбору збоїв за ревізією протоколу 2026-07-28.",
  }, agentProjectsLab, agentProjectsLabUk, ["mcp-discover", "mcp-stdio", "mcp-versioning", "mcp-tools", "mcp-inspector", "anthropic-building-agents", "anthropic-writing-tools"]),
];

export const agenticCatalog = {
  title: "AI agents & MCP",
  titleUk: "AI-агенти та MCP",
  description: "How AI agents and the Model Context Protocol work and how to build, connect and use them; testing agents is covered by the Generative AI & LLM course.",
  descriptionUk: "Як працюють AI-агенти та Model Context Protocol і як їх будувати, підключати й використовувати; тестування агентів описано в курсі «Генеративний AI та LLM».",
  sources: sourcesData as AgenticSource[],
  topics,
};

export default agenticCatalog;
