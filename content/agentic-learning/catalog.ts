import sourcesData from "./sources.json";
import howAgentsWork from "./01-how-agents-work.md?raw";
import howAgentsWorkUk from "./01-how-agents-work.uk.md?raw";
import toolDesign from "./02-tool-design.md?raw";
import toolDesignUk from "./02-tool-design.uk.md?raw";
import modelContextProtocol from "./03-model-context-protocol.md?raw";
import modelContextProtocolUk from "./03-model-context-protocol.uk.md?raw";

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

/** A reserved chapter: listed in navigation, never retrieved or indexed until it is written. */
const planned = (fields: TopicFields): AgenticTopic => ({
  ...fields,
  status: "under-construction",
  markdown: `## Under construction\n\n${fields.description}`,
  markdownUk: `## У розробці\n\n${fields.descriptionUk}`,
  sourceIds: [],
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
  planned({
    id: "state-memory-rag",
    label: "State, memory and RAG",
    labelUk: "Стан, пам'ять і RAG",
    description: "Context windows, session state, durable memory, retrieval and the boundary between user data and agent data, with the GimmeJob Learning Path Advisor as a case study.",
    descriptionUk: "Контекстне вікно, стан сесії, довга пам'ять, retrieval і межа між даними користувача та агента на прикладі Learning Path Advisor у GimmeJob.",
  }),
  planned({
    id: "human-approval",
    label: "Human approval and action boundaries",
    labelUk: "Підтвердження людиною й межі дій",
    description: "Approval gates before consequential actions, least privilege, dry runs, audit trails and prompt injection through tool data.",
    descriptionUk: "Підтвердження перед важливими діями, мінімальні права, dry-run, журнал дій і prompt injection через дані інструментів.",
  }),
  planned({
    id: "coding-agents-for-qa",
    label: "AI coding agents in QA work",
    labelUk: "AI coding agents у роботі QA",
    description: "Writing and reviewing tests with a coding agent, triaging flaky tests, giving the agent project context and checking its result.",
    descriptionUk: "Як писати й перевіряти тести з coding agent, розбирати нестабільні тести, давати агенту контекст проєкту й перевіряти результат.",
  }),
  planned({
    id: "agent-observability",
    label: "Evaluating and observing agents",
    labelUk: "Оцінювання та спостережуваність агентів",
    description: "Traces, cost and latency per task, and where to go next for outcome, trajectory and reliability testing.",
    descriptionUk: "Трасування, вартість і затримка задачі та куди йти далі по тестування результату, траєкторії й надійності.",
  }),
  planned({
    id: "agent-projects-lab",
    label: "Projects and MCP lab",
    labelUk: "Проєкти й лабораторія MCP",
    description: "Narrow, testable pet-project agents and a runnable lab that builds and tests a small MCP server.",
    descriptionUk: "Невеликі агенти, які легко перевірити, і практична лабораторна: написати й протестувати маленький MCP-сервер.",
  }),
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
