import llmFoundations from "./01-llm-foundations.md?raw";
import llmFoundationsUk from "./01-llm-foundations.uk.md?raw";
import applicationAnatomy from "./02-llm-application-anatomy.md?raw";
import applicationAnatomyUk from "./02-llm-application-anatomy.uk.md?raw";
import evaluationFundamentals from "./03-evaluation-fundamentals.md?raw";
import evaluationFundamentalsUk from "./03-evaluation-fundamentals.uk.md?raw";
import modelGradedEvaluation from "./04-model-graded-evaluation.md?raw";
import modelGradedEvaluationUk from "./04-model-graded-evaluation.uk.md?raw";
import ragTesting from "./05-rag-testing.md?raw";
import ragTestingUk from "./05-rag-testing.uk.md?raw";
import agentTesting from "./06-agent-testing.md?raw";
import agentTestingUk from "./06-agent-testing.uk.md?raw";
import securityRedTeaming from "./07-security-red-teaming.md?raw";
import securityRedTeamingUk from "./07-security-red-teaming.uk.md?raw";
import productionQuality from "./08-production-quality.md?raw";
import productionQualityUk from "./08-production-quality.uk.md?raw";
import proPractice from "./09-pro-practice.md?raw";
import proPracticeUk from "./09-pro-practice.uk.md?raw";

export type LlmTestingLevel = "beginner" | "intermediate" | "advanced" | "pro";

export interface LlmTestingTopic {
  id: string;
  label: string;
  labelUk: string;
  level: LlmTestingLevel;
  description: string;
  descriptionUk: string;
  status: "under-construction" | "published";
  markdown: string;
  markdownUk: string;
}

export const llmTestingCatalog = {
  title: "Generative AI & LLM testing",
  titleUk: "Generative AI та LLM testing",
  description: "A zero-to-pro learning path for testing products built on language models: how LLMs fail, evaluation, LLM-as-a-judge, RAG, agents, red teaming, production quality and evaluation leadership.",
  descriptionUk: "Learning path від нуля до pro для тестування продуктів на мовних моделях: як ламаються LLM, evaluation, LLM-as-a-judge, RAG, agents, red teaming, якість у production та лідерство в evaluation.",
  topics: [
    {
      id: "llm-foundations",
      label: "How LLMs work for testers",
      labelUk: "Як працюють LLM для тестувальника",
      level: "beginner",
      description: "Tokens, next-token prediction, attention, sampling, why temperature 0 is not deterministic, training stages, embeddings and a catalogue of LLM failure modes.",
      descriptionUk: "Tokens, next-token prediction, attention, sampling, чому temperature 0 — не детермінізм, етапи training, embeddings і каталог failure modes LLM.",
      status: "published",
      markdown: llmFoundations,
      markdownUk: llmFoundationsUk,
    },
    {
      id: "llm-application-anatomy",
      label: "Anatomy of an LLM application",
      labelUk: "Анатомія LLM application",
      level: "beginner",
      description: "Prompts as code, structured output, tool calling, RAG, agents and MCP, provider reliability and mocking the model, ending with a support bot to test.",
      descriptionUk: "Prompts як code, structured output, tool calling, RAG, agents і MCP, надійність provider і mock моделі; результат — support bot для тестування.",
      status: "published",
      markdown: applicationAnatomy,
      markdownUk: applicationAnatomyUk,
    },
    {
      id: "evaluation-fundamentals",
      label: "Evaluation fundamentals",
      labelUk: "Основи evaluation",
      level: "intermediate",
      description: "The LLM test pyramid, error analysis, golden datasets, deterministic assertions, reference-based metrics, promptfoo and DeepEval, and reading a scorecard.",
      descriptionUk: "Піраміда тестування LLM, error analysis, golden datasets, deterministic assertions, reference-based metrics, promptfoo і DeepEval, читання scorecard.",
      status: "published",
      markdown: evaluationFundamentals,
      markdownUk: evaluationFundamentalsUk,
    },
    {
      id: "model-graded-evaluation",
      label: "LLM-as-a-judge & non-determinism",
      labelUk: "LLM-as-a-judge та non-determinism",
      level: "intermediate",
      description: "Judge patterns, rubric design, judge biases, calibration against human labels, metamorphic testing, pass@k vs pass^k and cost control.",
      descriptionUk: "Patterns judges, дизайн rubrics, bias judges, калібрування проти human labels, metamorphic testing, pass@k vs pass^k і контроль cost.",
      status: "published",
      markdown: modelGradedEvaluation,
      markdownUk: modelGradedEvaluationUk,
    },
    {
      id: "rag-testing",
      label: "RAG testing",
      labelUk: "Тестування RAG",
      level: "intermediate",
      description: "Separating retrieval from generation, recall@k, MRR and nDCG, the RAG triad, Ragas, test-set design, citation checks and a GimmeJob canonical RAG case study.",
      descriptionUk: "Розділення retrieval і generation, recall@k, MRR і nDCG, RAG triad, Ragas, дизайн test set, перевірка citations і case study canonical RAG GimmeJob.",
      status: "published",
      markdown: ragTesting,
      markdownUk: ragTestingUk,
    },
    {
      id: "agent-testing",
      label: "Agent & tool-use testing",
      labelUk: "Тестування agents і tool use",
      level: "advanced",
      description: "Outcome vs trajectory evaluation, tool-call correctness, sandboxed environments, simulated users, pass^k reliability, fault injection and MCP server testing.",
      descriptionUk: "Outcome vs trajectory evaluation, коректність tool calls, sandboxed environments, simulated users, надійність pass^k, fault injection і тестування MCP servers.",
      status: "published",
      markdown: agentTesting,
      markdownUk: agentTestingUk,
    },
    {
      id: "security-red-teaming",
      label: "Security & red teaming",
      labelUk: "Security та red teaming",
      level: "advanced",
      description: "OWASP Top 10 for LLM Applications, direct and indirect prompt injection, the lethal trifecta, jailbreaks, leakage, guardrail testing, MITRE ATLAS and writing findings.",
      descriptionUk: "OWASP Top 10 for LLM Applications, direct та indirect prompt injection, lethal trifecta, jailbreaks, leakage, тестування guardrails, MITRE ATLAS і написання findings.",
      status: "published",
      markdown: securityRedTeaming,
      markdownUk: securityRedTeamingUk,
    },
    {
      id: "production-quality",
      label: "Production quality",
      labelUk: "Якість у production",
      level: "advanced",
      description: "Evals in CI/CD, tracing with OpenTelemetry and Langfuse, online evaluation, feedback loops, latency and cost testing, model migrations and experiments.",
      descriptionUk: "Evals у CI/CD, tracing з OpenTelemetry і Langfuse, online evaluation, feedback loops, тестування latency і cost, міграції моделей та експерименти.",
      status: "published",
      markdown: productionQuality,
      markdownUk: productionQualityUk,
    },
    {
      id: "pro-practice",
      label: "Pro practice & capstone",
      labelUk: "Pro-практика та capstone",
      level: "pro",
      description: "Confidence intervals and paired comparisons, benchmarks and contamination, human evaluation programs, NIST AI RMF and the EU AI Act, eval platforms, capstone and career.",
      descriptionUk: "Confidence intervals і paired порівняння, benchmarks і contamination, програми human evaluation, NIST AI RMF і EU AI Act, eval platforms, capstone і кар'єра.",
      status: "published",
      markdown: proPractice,
      markdownUk: proPracticeUk,
    },
  ] satisfies LlmTestingTopic[],
};

export default llmTestingCatalog;
