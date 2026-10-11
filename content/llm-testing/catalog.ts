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
import structuredOutput from "./06-structured-output-validation.md?raw";
import structuredOutputUk from "./06-structured-output-validation.uk.md?raw";
import testingWithoutModel from "./07-testing-without-the-model.md?raw";
import testingWithoutModelUk from "./07-testing-without-the-model.uk.md?raw";
import evaluationFundamentals from "./10-evaluation-fundamentals.md?raw";
import evaluationFundamentalsUk from "./10-evaluation-fundamentals.uk.md?raw";
import codeBasedScorers from "./09-code-based-scorers.md?raw";
import codeBasedScorersUk from "./09-code-based-scorers.uk.md?raw";
import modelGradedEvaluation from "./13-model-graded-evaluation.md?raw";
import modelGradedEvaluationUk from "./13-model-graded-evaluation.uk.md?raw";
import evalStatistics from "./11-eval-statistics.md?raw";
import evalStatisticsUk from "./11-eval-statistics.uk.md?raw";
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
  status: "published";
  markdown: string;
  markdownUk: string;
  sourceIds: string[];
}

type TopicFields = Omit<LlmTestingTopic, "status" | "markdown" | "markdownUk" | "sourceIds">;

/** Only written chapters are listed; planned chapters are added here when their content exists. */
const chapter = (
  fields: TopicFields,
  markdown: string,
  markdownUk: string,
  sourceIds: string[] = [],
): LlmTestingTopic => ({ ...fields, status: "published", markdown, markdownUk, sourceIds });

const topics: LlmTestingTopic[] = [
  chapter({
    id: "llm-testing-problem-space",
    label: "Why LLM testing is different",
    labelUk: "Чим особливе тестування LLM",
    level: "beginner",
    description: "LLM systems vs models, the test oracle problem and oracle types, sources of variability, quality characteristics, turning vague requirements into testable criteria, and the core vocabulary.",
    descriptionUk: "LLM systems vs моделі, проблема test oracle і типи oracles, джерела варіативності, характеристики якості, перетворення розмитих вимог на тестовані критерії та базовий словник.",
  }, problemSpace, problemSpaceUk, ["barr-oracle-problem", "chen-behavior-drift", "iso-25010", "iso-25059", "istqb-ctai", "husain-evals", "ollama"]),
  chapter({
    id: "llm-foundations",
    label: "How LLMs generate text",
    labelUk: "Як LLM генерують текст",
    level: "beginner",
    description: "Tokenization with byte-pair encoding, the generation loop, softmax, temperature, top-k and top-p, non-determinism at temperature 0, training stages, hallucination, long contexts and reasoning models.",
    descriptionUk: "Tokenization через byte-pair encoding, цикл генерації, softmax, temperature, top-k і top-p, non-determinism при temperature 0, етапи training, hallucination, long contexts і reasoning models.",
  }, llmFoundations, llmFoundationsUk, ["sennrich-bpe", "tiktoken", "vaswani-attention", "alammar-transformer", "karpathy-intro-llms", "holtzman-nucleus", "thinking-machines-nondeterminism", "ouyang-instructgpt", "rafailov-dpo", "sharma-sycophancy", "rottger-xstest", "kalai-why-hallucinate", "maynez-faithfulness", "liu-lost-middle", "hsieh-ruler", "turpin-cot-faithfulness"]),
  chapter({
    id: "embeddings-similarity",
    label: "Embeddings and similarity",
    labelUk: "Embeddings і semantic similarity",
    level: "beginner",
    description: "Embedding models, cosine similarity and distance, why similarity is not equivalence, calibrating thresholds, exact and approximate vector search, and embeddings as a test-engineering tool.",
    descriptionUk: "Embedding models, cosine similarity і distance, чому similarity — не еквівалентність, калібрування thresholds, exact та approximate vector search і embeddings як інструмент test engineering.",
  }, embeddingsSimilarity, embeddingsSimilarityUk, ["muennighoff-mteb", "mteb-leaderboard", "reimers-sbert", "sbert-docs", "openai-embeddings-guide", "malkov-hnsw", "faiss", "pgvector"]),
  chapter({
    id: "llm-application-anatomy",
    label: "LLM application anatomy and APIs",
    labelUk: "Анатомія LLM application і APIs",
    level: "beginner",
    description: "Architecture of an LLM application, chat API requests and responses, stop reasons, streaming, errors and retries, token cost per resolved task, and what to record for every model call.",
    descriptionUk: "Архітектура LLM application, requests і responses chat APIs, stop reasons, streaming, помилки й retries, cost tokens на розв'язану задачу і що записувати для кожного виклику моделі.",
  }, applicationAnatomy, applicationAnatomyUk, ["anthropic-messages-api", "anthropic-stop-reasons", "anthropic-errors", "anthropic-streaming", "openai-text-guide", "openai-error-codes", "openai-streaming", "openai-prompt-caching", "aws-backoff-jitter", "litellm", "ollama-openai-compat"]),
  chapter({
    id: "prompts-as-artifacts",
    label: "Prompts as testable artifacts",
    labelUk: "Prompts як тестовані артефакти",
    level: "beginner",
    description: "Prompt anatomy, techniques and their failure modes, safe templates and fuzz tests, prompt versioning with a CI lock check, reviewing prompts and prompt diffs, sensitivity experiments and verifiable instructions.",
    descriptionUk: "Анатомія prompt, техніки та їхні failure modes, безпечні templates і fuzz tests, versioning prompts з lock check у CI, рев'ю prompts і prompt diffs, експерименти чутливості та верифіковані інструкції.",
  }, promptsAsArtifacts, promptsAsArtifactsUk, ["sclar-prompt-format", "lu-example-order", "zhao-calibrate", "wei-chain-of-thought", "zhou-ifeval", "anthropic-prompt-engineering", "openai-prompt-engineering", "langfuse-prompt-management", "jinja", "python-string-template"]),
  chapter({
    id: "structured-output-validation",
    label: "Structured output and validation",
    labelUk: "Structured output і validation",
    level: "beginner",
    description: "Designing output contracts with JSON Schema and Pydantic, the extract, validate, repair and fallback pipeline, provider-native structured outputs and their limits, truncation, test cases and field-level accuracy.",
    descriptionUk: "Проєктування контрактів output з JSON Schema і Pydantic, pipeline extract, validate, repair і fallback, нативні structured outputs providers та їхні межі, truncation, test cases і точність по полях.",
  }, structuredOutput, structuredOutputUk, ["json-schema-docs", "pydantic-docs", "anthropic-structured-outputs", "openai-structured-outputs", "rfc8259", "hypothesis-docs", "hypothesis-jsonschema", "tam-format-restrictions", "willard-guided-generation"]),
  chapter({
    id: "testing-without-the-model",
    label: "Testing LLM code without the model",
    labelUk: "Тестування LLM code без моделі",
    level: "intermediate",
    description: "Test doubles for model clients, dependency injection, context-assembly invariants, prompt snapshots, record and replay, contract fixtures, tool routing and authorization, and organizing offline, live and evaluation test layers.",
    descriptionUk: "Test doubles для model clients, dependency injection, інваріанти збирання context, snapshots prompts, record and replay, contract fixtures, маршрутизація tools і authorization та організація offline, live і evaluation рівнів тестів.",
  }, testingWithoutModel, testingWithoutModelUk, ["fowler-test-double", "fowler-mocks-arent-stubs", "vcrpy-docs", "pytest-recording", "syrupy", "pytest-monkeypatch", "pytest-markers", "pytest-asyncio", "hypothesis-docs"]),
  chapter({
    id: "evaluation-fundamentals",
    label: "Evaluation methodology and datasets",
    labelUk: "Методологія evaluation і datasets",
    level: "intermediate",
    description: "The LLM test pyramid, error analysis, golden datasets, deterministic assertions, reference-based metrics, promptfoo and DeepEval, and reading a scorecard.",
    descriptionUk: "Піраміда тестування LLM, error analysis, golden datasets, deterministic assertions, reference-based metrics, promptfoo і DeepEval та читання scorecard.",
  }, evaluationFundamentals, evaluationFundamentalsUk),
  chapter({
    id: "code-based-scorers",
    label: "Code-based scorers and metrics",
    labelUk: "Code-based scorers і metrics",
    level: "intermediate",
    description: "Scorers as tested software: assertions without a reference, exact match and token F1, fact-based scoring validated against human labels, BLEU and ROUGE step by step, BERTScore, classification metrics, execution-based scoring and a scoring harness with slices.",
    descriptionUk: "Scorers як протестоване software: assertions без reference, exact match і token F1, оцінювання за фактами з validation проти human labels, BLEU і ROUGE крок за кроком, BERTScore, classification metrics, оцінювання виконанням і scoring harness зі зрізами.",
  }, codeBasedScorers, codeBasedScorersUk, ["rajpurkar-squad", "papineni-bleu", "lin-och-orange", "chen-cherry-bleu-smoothing", "lin-rouge", "rouge-score", "post-sacrebleu", "novikova-nlg-metrics", "zhang-bertscore", "sklearn-metrics", "chen-humaneval", "zhong-test-suite-sql", "python-sqlite3", "anthropic-develop-tests", "promptfoo-assertions", "deepeval-custom-metrics", "hypothesis-docs", "husain-evals"]),
  chapter({
    id: "model-graded-evaluation",
    label: "LLM-as-a-judge",
    labelUk: "LLM-as-a-judge",
    level: "intermediate",
    description: "Judge patterns, rubric design, judge biases, calibration against human labels, metamorphic testing, testing under non-determinism with pass@k and pass^k, and cost control.",
    descriptionUk: "Patterns judges, дизайн rubrics, bias judges, калібрування проти human labels, metamorphic testing, тестування в умовах non-determinism з pass@k і pass^k та контроль cost.",
  }, modelGradedEvaluation, modelGradedEvaluationUk),
  chapter({
    id: "eval-statistics",
    label: "Statistics for evaluation",
    labelUk: "Статистика для evaluation",
    level: "advanced",
    description: "Confidence intervals for pass rates, paired comparisons with McNemar's test, the bootstrap, pass@k and pass^k for repeated runs, clustered errors, sample size and power, multiple comparisons, and release gates with a non-inferiority margin.",
    descriptionUk: "Довірчі інтервали для pass rate, парні порівняння з тестом Мак-Немара, bootstrap, pass@k і pass^k для повторних запусків, кластеризовані похибки, розмір вибірки і power, множинні порівняння та release gates з margin non-inferiority.",
  }, evalStatistics, evalStatisticsUk, ["miller-error-bars", "anthropic-statistical-evals", "wilson-1927", "brown-cai-dasgupta", "mcnemar-1947", "dietterich-1998", "koehn-bootstrap", "dror-significance", "card-power", "connor-1987", "holm-1979", "chen-humaneval", "yao-tau-bench", "madaan-variance", "thinking-machines-nondeterminism", "statsmodels-proportion-confint", "statsmodels-mcnemar", "python-statistics"]),
  chapter({
    id: "rag-testing",
    label: "Evaluating RAG systems",
    labelUk: "Evaluation RAG систем",
    level: "advanced",
    description: "Separating retrieval from generation, recall@k, MRR and nDCG, the RAG triad, Ragas, test-set design, citation checks and a GimmeJob canonical RAG case study.",
    descriptionUk: "Розділення retrieval і generation, recall@k, MRR і nDCG, RAG triad, Ragas, дизайн test set, перевірка citations і case study canonical RAG GimmeJob.",
  }, ragTesting, ragTestingUk),
  chapter({
    id: "agent-testing",
    label: "Evaluating agents and tool use",
    labelUk: "Evaluation agents і tool use",
    level: "advanced",
    description: "Outcome vs trajectory evaluation, tool-call correctness, sandboxed environments, simulated users, pass^k reliability, fault injection and MCP server testing.",
    descriptionUk: "Outcome vs trajectory evaluation, коректність tool calls, sandboxed environments, simulated users, надійність pass^k, fault injection і тестування MCP servers.",
  }, agentTesting, agentTestingUk),
  chapter({
    id: "security-red-teaming",
    label: "Security, red teaming and guardrails",
    labelUk: "Security, red teaming і guardrails",
    level: "advanced",
    description: "OWASP Top 10 for LLM Applications, direct and indirect prompt injection, the lethal trifecta, jailbreaks, data leakage, bias and toxicity, automated red teaming, guardrail testing, MITRE ATLAS and writing findings.",
    descriptionUk: "OWASP Top 10 for LLM Applications, direct та indirect prompt injection, lethal trifecta, jailbreaks, leakage даних, bias і toxicity, автоматизований red teaming, тестування guardrails, MITRE ATLAS і написання findings.",
  }, securityRedTeaming, securityRedTeamingUk),
  chapter({
    id: "production-quality",
    label: "Production quality",
    labelUk: "Якість у production",
    level: "advanced",
    description: "Evals in CI/CD, tracing with OpenTelemetry and Langfuse, online evaluation, feedback loops, performance and cost testing, model migrations and experiments.",
    descriptionUk: "Evals у CI/CD, tracing з OpenTelemetry і Langfuse, online evaluation, feedback loops, тестування performance і cost, міграції моделей та експерименти.",
  }, productionQuality, productionQualityUk),
  chapter({
    id: "pro-practice",
    label: "Benchmarks, human evaluation and governance",
    labelUk: "Benchmarks, human evaluation і governance",
    level: "pro",
    description: "Confidence intervals and paired comparisons, benchmarks and contamination, custom benchmarks, human evaluation programs, NIST AI RMF and the EU AI Act, evaluation platforms and quality leadership.",
    descriptionUk: "Confidence intervals і paired порівняння, benchmarks і contamination, власні benchmarks, програми human evaluation, NIST AI RMF і EU AI Act, evaluation platforms і лідерство в якості.",
  }, proPractice, proPracticeUk),
];

export const llmTestingCatalog = {
  title: "Generative AI & LLM testing",
  titleUk: "Generative AI та LLM testing",
  description: "A course from zero to pro for testing products built on language models: how models work, building testable LLM applications, evaluation, RAG and agents, security, production quality and professional practice.",
  descriptionUk: "Курс від нуля до pro з тестування продуктів на мовних моделях: як працюють моделі, побудова тестованих LLM applications, evaluation, RAG і agents, security, якість у production і професійна практика.",
  sources: sourcesData as LlmTestingSource[],
  topics,
};

export default llmTestingCatalog;
