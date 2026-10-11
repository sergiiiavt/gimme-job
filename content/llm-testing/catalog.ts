import sourcesData from "./sources.json";
import problemSpace from "./01-llm-testing-problem-space.md?raw";
import problemSpaceUk from "./01-llm-testing-problem-space.uk.md?raw";
import llmFoundations from "./02-llm-foundations.md?raw";
import llmFoundationsUk from "./02-llm-foundations.uk.md?raw";
import embeddingsSimilarity from "./03-embeddings-similarity.md?raw";
import embeddingsSimilarityUk from "./03-embeddings-similarity.uk.md?raw";
import applicationAnatomy from "./04-llm-application-anatomy.md?raw";
import applicationAnatomyUk from "./04-llm-application-anatomy.uk.md?raw";
import promptsAsArtifacts from "./05-prompts-as-artifacts.md?raw";
import promptsAsArtifactsUk from "./05-prompts-as-artifacts.uk.md?raw";
import evaluationFundamentals from "./10-evaluation-fundamentals.md?raw";
import evaluationFundamentalsUk from "./10-evaluation-fundamentals.uk.md?raw";
import modelGradedEvaluation from "./13-model-graded-evaluation.md?raw";
import modelGradedEvaluationUk from "./13-model-graded-evaluation.uk.md?raw";
import ragTesting from "./16-rag-testing.md?raw";
import ragTestingUk from "./16-rag-testing.uk.md?raw";
import agentTesting from "./17-agent-testing.md?raw";
import agentTestingUk from "./17-agent-testing.uk.md?raw";
import securityRedTeaming from "./19-security-red-teaming.md?raw";
import securityRedTeamingUk from "./19-security-red-teaming.uk.md?raw";
import productionQuality from "./21-production-quality.md?raw";
import productionQualityUk from "./21-production-quality.uk.md?raw";
import proPractice from "./25-pro-practice.md?raw";
import proPracticeUk from "./25-pro-practice.uk.md?raw";

export type LlmTestingLevel = "beginner" | "intermediate" | "advanced" | "pro";
export type LlmTestingStatus = "under-construction" | "published";

export interface LlmTestingSource {
  id: string;
  title: string;
  publisher: string;
  kind: string;
  status: string;
  url: string;
  role: string;
  checkedAt: string;
}

export interface LlmTestingTopic {
  id: string;
  label: string;
  labelUk: string;
  level: LlmTestingLevel;
  description: string;
  descriptionUk: string;
  status: LlmTestingStatus;
  markdown: string;
  markdownUk: string;
  sourceIds: string[];
}

type TopicFields = Omit<LlmTestingTopic, "status" | "markdown" | "markdownUk" | "sourceIds">;

const published = (
  fields: TopicFields,
  markdown: string,
  markdownUk: string,
  sourceIds: string[] = [],
): LlmTestingTopic => ({ ...fields, status: "published", markdown, markdownUk, sourceIds });

const underConstruction = (fields: TopicFields): LlmTestingTopic => ({
  ...fields,
  status: "under-construction",
  markdown: `## Under construction\n\n${fields.description}`,
  markdownUk: `## У розробці\n\n${fields.descriptionUk}`,
  sourceIds: [],
});

const topics: LlmTestingTopic[] = [
  published({
    id: "llm-testing-problem-space",
    label: "Why LLM testing is different",
    labelUk: "Чим особливе тестування LLM",
    level: "beginner",
    description: "LLM systems vs models, the test oracle problem and oracle types, sources of variability, quality characteristics, turning vague requirements into testable criteria, and the core vocabulary.",
    descriptionUk: "LLM systems vs моделі, проблема test oracle і типи oracles, джерела варіативності, характеристики якості, перетворення розмитих вимог на тестовані критерії та базовий словник.",
  }, problemSpace, problemSpaceUk, ["barr-oracle-problem", "chen-behavior-drift", "iso-25010", "iso-25059", "istqb-ctai", "husain-evals", "ollama"]),
  published({
    id: "llm-foundations",
    label: "How LLMs generate text",
    labelUk: "Як LLM генерують текст",
    level: "beginner",
    description: "Tokenization with byte-pair encoding, the generation loop, softmax, temperature, top-k and top-p, non-determinism at temperature 0, training stages, hallucination, long contexts and reasoning models.",
    descriptionUk: "Tokenization через byte-pair encoding, цикл генерації, softmax, temperature, top-k і top-p, non-determinism при temperature 0, етапи training, hallucination, long contexts і reasoning models.",
  }, llmFoundations, llmFoundationsUk, ["sennrich-bpe", "tiktoken", "vaswani-attention", "alammar-transformer", "karpathy-intro-llms", "holtzman-nucleus", "thinking-machines-nondeterminism", "ouyang-instructgpt", "rafailov-dpo", "sharma-sycophancy", "rottger-xstest", "kalai-why-hallucinate", "maynez-faithfulness", "liu-lost-middle", "hsieh-ruler", "turpin-cot-faithfulness"]),
  published({
    id: "embeddings-similarity",
    label: "Embeddings and similarity",
    labelUk: "Embeddings і semantic similarity",
    level: "beginner",
    description: "Embedding models, cosine similarity and distance, why similarity is not equivalence, calibrating thresholds, exact and approximate vector search, and embeddings as a test-engineering tool.",
    descriptionUk: "Embedding models, cosine similarity і distance, чому similarity — не еквівалентність, калібрування thresholds, exact та approximate vector search і embeddings як інструмент test engineering.",
  }, embeddingsSimilarity, embeddingsSimilarityUk, ["muennighoff-mteb", "mteb-leaderboard", "reimers-sbert", "sbert-docs", "openai-embeddings-guide", "malkov-hnsw", "faiss", "pgvector"]),
  published({
    id: "llm-application-anatomy",
    label: "LLM application anatomy and APIs",
    labelUk: "Анатомія LLM application і APIs",
    level: "beginner",
    description: "Architecture of an LLM application, chat API requests and responses, stop reasons, streaming, errors and retries, token cost per resolved task, and what to record for every model call.",
    descriptionUk: "Архітектура LLM application, requests і responses chat APIs, stop reasons, streaming, помилки й retries, cost tokens на розв'язану задачу і що записувати для кожного виклику моделі.",
  }, applicationAnatomy, applicationAnatomyUk, ["anthropic-messages-api", "anthropic-stop-reasons", "anthropic-errors", "anthropic-streaming", "openai-text-guide", "openai-error-codes", "openai-streaming", "openai-prompt-caching", "aws-backoff-jitter", "litellm", "ollama-openai-compat"]),
  published({
    id: "prompts-as-artifacts",
    label: "Prompts as testable artifacts",
    labelUk: "Prompts як тестовані артефакти",
    level: "beginner",
    description: "Prompt anatomy, techniques and their failure modes, safe templates and fuzz tests, prompt versioning with a CI lock check, reviewing prompt diffs, sensitivity experiments and verifiable instructions.",
    descriptionUk: "Анатомія prompt, техніки та їхні failure modes, безпечні templates і fuzz tests, versioning prompts з lock check у CI, рев'ю prompt diffs, експерименти чутливості та верифіковані інструкції.",
  }, promptsAsArtifacts, promptsAsArtifactsUk, ["sclar-prompt-format", "lu-example-order", "zhao-calibrate", "wei-chain-of-thought", "zhou-ifeval", "anthropic-prompt-engineering", "openai-prompt-engineering", "langfuse-prompt-management", "jinja", "python-string-template"]),
  underConstruction({
    id: "structured-output-validation",
    label: "Structured output and validation",
    labelUk: "Structured output і validation",
    level: "beginner",
    description: "JSON Schema and Pydantic, the parse-validate-repair pipeline, provider-native structured outputs, streaming partial JSON and the test cases every structured output needs.",
    descriptionUk: "JSON Schema і Pydantic, pipeline parse-validate-repair, нативні structured outputs providers, streaming часткового JSON і test cases, потрібні кожному structured output.",
  }),
  underConstruction({
    id: "rag-architecture",
    label: "How RAG systems work",
    labelUk: "Як працюють RAG системи",
    level: "intermediate",
    description: "Ingestion, chunking strategies, dense and sparse retrieval, hybrid search with rank fusion, reranking, prompt assembly with citations, access control and reindexing, built as a runnable pipeline.",
    descriptionUk: "Ingestion, стратегії chunking, dense і sparse retrieval, hybrid search з rank fusion, reranking, збирання prompt з citations, access control і reindexing у вигляді runnable pipeline.",
  }),
  underConstruction({
    id: "tools-agents-mcp",
    label: "Tool calling, agents and MCP",
    labelUk: "Tool calling, agents і MCP",
    level: "intermediate",
    description: "The tool-calling protocol, the agent loop, budgets and stop conditions, state and memory, human approval, and the Model Context Protocol architecture.",
    descriptionUk: "Протокол tool calling, agent loop, budgets і умови зупинки, state і memory, human approval та архітектура Model Context Protocol.",
  }),
  underConstruction({
    id: "testing-without-the-model",
    label: "Testing LLM code without the model",
    labelUk: "Тестування LLM code без моделі",
    level: "intermediate",
    description: "Test doubles for model clients, dependency injection, record and replay, contract fixtures, property-based tests, prompt snapshot tests and splitting offline and live suites.",
    descriptionUk: "Test doubles для model clients, dependency injection, record and replay, contract fixtures, property-based tests, snapshot tests prompts і розділення offline та live suites.",
  }),
  published({
    id: "evaluation-fundamentals",
    label: "Evaluation methodology",
    labelUk: "Методологія evaluation",
    level: "intermediate",
    description: "The LLM test pyramid, error analysis, golden datasets, deterministic assertions, reference-based metrics, promptfoo and DeepEval, and reading a scorecard.",
    descriptionUk: "Піраміда тестування LLM, error analysis, golden datasets, deterministic assertions, reference-based metrics, promptfoo і DeepEval та читання scorecard.",
  }, evaluationFundamentals, evaluationFundamentalsUk),
  underConstruction({
    id: "evaluation-datasets",
    label: "Evaluation datasets",
    labelUk: "Evaluation datasets",
    level: "intermediate",
    description: "Dataset design and slices, sampling from production, synthetic generation with quality control, labelling guidelines, versioning, splits, leakage and maintenance.",
    descriptionUk: "Дизайн datasets і зрізи, вибірка з production, synthetic generation з контролем якості, guidelines для labelling, versioning, splits, leakage і підтримка.",
  }),
  underConstruction({
    id: "code-based-scorers",
    label: "Code-based scorers and metrics",
    labelUk: "Code-based scorers і metrics",
    level: "intermediate",
    description: "Deterministic assertions, answer normalization, exact match and token F1, BLEU and ROUGE computed step by step, embedding scorers and classification metrics, with their failure cases.",
    descriptionUk: "Deterministic assertions, нормалізація відповідей, exact match і token F1, BLEU та ROUGE крок за кроком, embedding scorers і classification metrics разом з їхніми збоями.",
  }),
  published({
    id: "model-graded-evaluation",
    label: "LLM-as-a-judge",
    labelUk: "LLM-as-a-judge",
    level: "intermediate",
    description: "Judge patterns, rubric design, judge biases, calibration against human labels, metamorphic testing, pass@k vs pass^k and cost control.",
    descriptionUk: "Patterns judges, дизайн rubrics, bias judges, калібрування проти human labels, metamorphic testing, pass@k vs pass^k і контроль cost.",
  }, modelGradedEvaluation, modelGradedEvaluationUk),
  underConstruction({
    id: "eval-frameworks",
    label: "Evaluation frameworks in practice",
    labelUk: "Evaluation frameworks на практиці",
    level: "intermediate",
    description: "Complete, runnable evaluation suites in promptfoo, DeepEval and Inspect AI: configuration, assertions, model-graded metrics, reports and how to choose between them.",
    descriptionUk: "Повні робочі evaluation suites у promptfoo, DeepEval та Inspect AI: конфігурація, assertions, model-graded metrics, звіти і як між ними вибирати.",
  }),
  underConstruction({
    id: "eval-statistics",
    label: "Statistics for evaluation",
    labelUk: "Статистика для evaluation",
    level: "advanced",
    description: "Repeated runs, unbiased pass@k and pass^k, Wilson and bootstrap confidence intervals, paired comparisons, McNemar's test, sample sizes and multiple comparisons.",
    descriptionUk: "Повторні runs, незміщені pass@k і pass^k, Wilson та bootstrap confidence intervals, paired порівняння, тест McNemar, розміри вибірок і multiple comparisons.",
  }),
  published({
    id: "rag-testing",
    label: "Evaluating RAG systems",
    labelUk: "Evaluation RAG систем",
    level: "advanced",
    description: "Separating retrieval from generation, recall@k, MRR and nDCG, the RAG triad, Ragas, test-set design, citation checks and a GimmeJob canonical RAG case study.",
    descriptionUk: "Розділення retrieval і generation, recall@k, MRR і nDCG, RAG triad, Ragas, дизайн test set, перевірка citations і case study canonical RAG GimmeJob.",
  }, ragTesting, ragTestingUk),
  published({
    id: "agent-testing",
    label: "Evaluating agents and tool use",
    labelUk: "Evaluation agents і tool use",
    level: "advanced",
    description: "Outcome vs trajectory evaluation, tool-call correctness, sandboxed environments, simulated users, pass^k reliability, fault injection and MCP server testing.",
    descriptionUk: "Outcome vs trajectory evaluation, коректність tool calls, sandboxed environments, simulated users, надійність pass^k, fault injection і тестування MCP servers.",
  }, agentTesting, agentTestingUk),
  underConstruction({
    id: "prompt-injection",
    label: "Prompt injection and jailbreaks",
    labelUk: "Prompt injection і jailbreaks",
    level: "advanced",
    description: "Trust boundaries, direct and indirect injection, exfiltration channels, the lethal trifecta, jailbreak families, canary-based test harnesses and testing each mitigation.",
    descriptionUk: "Trust boundaries, direct та indirect injection, канали exfiltration, lethal trifecta, родини jailbreaks, test harnesses з canaries і тестування кожної mitigation.",
  }),
  published({
    id: "security-red-teaming",
    label: "Red teaming and guardrails",
    labelUk: "Red teaming і guardrails",
    level: "advanced",
    description: "OWASP Top 10 for LLM Applications, direct and indirect prompt injection, the lethal trifecta, jailbreaks, leakage, guardrail testing, MITRE ATLAS and writing findings.",
    descriptionUk: "OWASP Top 10 for LLM Applications, direct та indirect prompt injection, lethal trifecta, jailbreaks, leakage, тестування guardrails, MITRE ATLAS і написання findings.",
  }, securityRedTeaming, securityRedTeamingUk),
  underConstruction({
    id: "bias-fairness-privacy",
    label: "Bias, fairness and privacy",
    labelUk: "Bias, fairness і privacy",
    level: "advanced",
    description: "Allocational and representational harms, counterfactual testing, fairness metrics, toxicity scoring, multilingual parity, PII detection and leakage testing.",
    descriptionUk: "Allocational і representational harms, counterfactual testing, fairness metrics, оцінювання toxicity, паритет мов, виявлення PII і тестування leakage.",
  }),
  published({
    id: "production-quality",
    label: "Observability and online evaluation",
    labelUk: "Observability і online evaluation",
    level: "advanced",
    description: "Evals in CI/CD, tracing with OpenTelemetry and Langfuse, online evaluation, feedback loops, latency and cost testing, model migrations and experiments.",
    descriptionUk: "Evals у CI/CD, tracing з OpenTelemetry і Langfuse, online evaluation, feedback loops, тестування latency і cost, міграції моделей та експерименти.",
  }, productionQuality, productionQualityUk),
  underConstruction({
    id: "ci-release-gates",
    label: "CI/CD, release gates and migrations",
    labelUk: "CI/CD, release gates і міграції",
    level: "advanced",
    description: "Smoke and full suites, baselines and tolerances, response caching, a complete GitHub Actions workflow, shadow and canary releases, model migrations and A/B tests.",
    descriptionUk: "Smoke і full suites, baselines і tolerances, кешування відповідей, повний GitHub Actions workflow, shadow і canary релізи, міграції моделей та A/B tests.",
  }),
  underConstruction({
    id: "performance-cost",
    label: "Performance and cost testing",
    labelUk: "Тестування performance і cost",
    level: "advanced",
    description: "Prefill and decode latency, time to first token, percentiles, Little's law, load tests for streaming endpoints, rate limits, capacity planning and cost regression gates.",
    descriptionUk: "Latency prefill і decode, time to first token, перцентилі, закон Літтла, load tests для streaming endpoints, rate limits, планування capacity і gates на regression cost.",
  }),
  underConstruction({
    id: "benchmarks-model-selection",
    label: "Benchmarks and model selection",
    labelUk: "Benchmarks і вибір моделі",
    level: "pro",
    description: "Benchmark families and harnesses, contamination and saturation, arena ratings, building custom benchmarks and a decision process for choosing a model.",
    descriptionUk: "Родини benchmarks і harnesses, contamination і saturation, arena ratings, побудова власних benchmarks і процес рішення щодо вибору моделі.",
  }),
  published({
    id: "pro-practice",
    label: "Human evaluation and governance",
    labelUk: "Human evaluation і governance",
    level: "pro",
    description: "Confidence intervals and paired comparisons, benchmarks and contamination, human evaluation programs, NIST AI RMF and the EU AI Act, eval platforms and quality leadership.",
    descriptionUk: "Confidence intervals і paired порівняння, benchmarks і contamination, програми human evaluation, NIST AI RMF і EU AI Act, eval platforms і лідерство в якості.",
  }, proPractice, proPracticeUk),
  underConstruction({
    id: "capstone",
    label: "Capstone project and career",
    labelUk: "Capstone project і кар'єра",
    level: "pro",
    description: "A complete capstone specification with milestones and acceptance criteria, a portfolio plan and interview preparation for AI quality roles.",
    descriptionUk: "Повна специфікація capstone з milestones і acceptance criteria, план portfolio і підготовка до інтерв'ю на ролі AI quality.",
  }),
];

export const llmTestingCatalog = {
  title: "Generative AI & LLM testing",
  titleUk: "Generative AI та LLM testing",
  description: "A complete course from zero to pro for testing products built on language models: how models work, building testable LLM applications, evaluation, RAG and agents, security, production quality and professional practice.",
  descriptionUk: "Повний курс від нуля до pro з тестування продуктів на мовних моделях: як працюють моделі, побудова тестованих LLM applications, evaluation, RAG і agents, security, якість у production і професійна практика.",
  sources: sourcesData as LlmTestingSource[],
  topics,
};

export default llmTestingCatalog;
