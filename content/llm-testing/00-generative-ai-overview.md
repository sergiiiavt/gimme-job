# Generative AI and LLMs: an introduction

Generative AI is broader than chatbots, and a large language model (LLM) is only one component of a useful product. Start here to understand the field, the terminology, how systems are assembled and where the learning path goes next. No testing background is required.

**Prerequisites:** none.

## AI, ML, generative AI and LLMs

Artificial intelligence (AI) is a broad field concerned with systems that perform tasks associated with human intelligence. Some systems use explicit rules; machine learning (ML) instead learns patterns from data. Deep learning is a family of ML methods using multi-layer neural networks. Transformers are an architecture used in many modern language models.

Generative AI creates content, such as text, code, images, audio or video. LLMs are generative models designed primarily for language and commonly trained to predict the next token. A spam classifier is ML, but is not necessarily generative AI; an image generator is generative AI, but not necessarily an LLM. Multimodal models can cross these boundaries.

| Concept | Main purpose | Example |
|---|---|---|
| Artificial intelligence | Broad field of intelligent software | Planning and recommendations |
| Machine learning | Learn patterns from examples | Fraud detection |
| Deep learning | Learn representations with neural networks | Speech recognition |
| Generative AI | Produce new content | Text or image generation |
| Large language model | Process and generate token sequences | Answer a question or explain code |

The names describe overlapping categories, not a required stack. You can build useful AI features without an LLM, and an LLM can be used within conventional software.

## How a language model produces an answer

A tokenizer converts text into tokens. The model processes the sequence and computes scores for possible next tokens. Decoding chooses a token and repeats until a stop condition. The model does not retrieve a prewritten sentence from a database on every request. The next chapter explains tokenization, attention, sampling and training with concrete examples.

Pretraining teaches broad statistical patterns from text and other data. Instruction tuning and preference optimization can make models more helpful, but do not guarantee correct facts or consistent reasoning. A fluent answer is not evidence that the model accessed a source, used a calculator or performed a real-world action. External information and actions require additional application components.

Model choice involves context size, modality, latency, price, language support, data handling, deployment options and task performance. Bigger is not always better; reliability and cost matter more than a model's popularity.

## Model versus application versus product

A model is a component with learned weights, inference logic and an interface for sending inputs and receiving outputs. An application assembles prompts, session history, retrieved information, tools, validation and business rules. A product also includes authentication, a user experience, feedback, monitoring and operational ownership.

For a customer-support assistant, a request may follow this path:

| Step | Owner | Responsibility |
|---|---|---|
| 1 | Application API | Authenticate the user, accept and validate input |
| 2 | Orchestrator | Construct instructions and relevant conversation context |
| 3 | Retriever, if needed | Find current documents the user is allowed to read |
| 4 | LLM | Generate a response or propose a structured tool call |
| 5 | Tool executor, if needed | Authorize and carry out an external action |
| 6 | Application output layer | Validate, display or stream results and record usage |

The model itself cannot establish authorization to read an order or confirm that a refund occurred. The surrounding software must enforce permissions and check external results. Treat prompts as model instructions, not as a security boundary.

## Common system patterns

| Pattern | Typical use | What to consider |
|---|---|---|
| Direct prompt | Summarize a supplied document | Context limits and accuracy |
| Structured generation | Extract a record into JSON | Schema validation and missing fields |
| Retrieval-augmented generation (RAG) | Answer from a changing policy library | Search quality, freshness and access control |
| Tool calling | Look up an authorized order | Server-side permissions and error handling |
| Agents | Complete a multi-step workflow | Approval boundaries, loops, cost and tracing |
| Fine-tuning | Adapt a model to specialized examples | Training data, evaluation and maintenance |

RAG is not the same as fine-tuning: it supplies external information at request time rather than updating the model's weights. An agent is an application design with an action loop, not a special kind of model. Structured output helps software parse a response; it does not automatically make the information true.

## Core vocabulary

These are the terms you will encounter repeatedly. Provider-specific terminology may vary.

| Term | Meaning |
|---|---|
| Foundation model | A broadly trained model used for different downstream tasks |
| Model weights | Learned parameters defining the network's behavior |
| Inference | Running a trained model on an input |
| Token and tokenizer | A unit of model input/output and the component that maps text to token IDs |
| Context window | Maximum token sequence supplied to a model, including history and retrieved material |
| Prompt | Input content and instructions assembled for a model |
| Message roles | Roles such as system, developer and user; exact support depends on provider |
| Sampling and temperature | Ways of selecting the next token and controlling response variation |
| Embedding | Numeric representation used for similarity and search |
| Retrieval | Selecting relevant information from an external source |
| RAG | Retrieval-augmented generation, which adds context to a model request |
| Tool call | Structured model request for the application to invoke a function |
| Agent | Application loop that can select actions and use tools repeatedly |
| Multimodal | Processing or generating more than one kind of data |
| Grounding | Connecting an answer to supplied evidence |
| Hallucination | Plausible-looking output not supported by facts or relevant evidence |
| Guardrail | A control that constrains, validates or blocks inputs and outputs |
| Latency and token cost | Time and consumption required to serve a request |

### Evaluation terminology encountered later

Evaluation and testing are important parts of working with LLM products, but they come after the foundations. These definitions are here so the vocabulary is searchable from the beginning.

Terms are used inconsistently across tools and papers. This course uses them as defined here.

| Term | Meaning in this course |
|---|---|
| Evaluation (eval) | A repeatable measurement of quality: a dataset, a way to run the system on it, scorers and a decision rule |
| Case (sample) | One input to evaluate, with optional reference answer, metadata and tags |
| Dataset | A versioned collection of cases; a "golden dataset" is a curated, trusted one |
| Scorer (grader) | Code, a model or a person that assigns a score or verdict to one output |
| Metric | An aggregate of scores over a dataset, for example pass rate or mean faithfulness |
| Judge | A model used as a scorer (LLM-as-a-judge) |
| Rubric | Written criteria a judge or human applies |
| Reference answer | A known good answer, or the facts it must contain |
| Baseline | The results of the current production version, used for comparison |
| Regression | A statistically and practically meaningful drop compared with the baseline |
| Trace / span | A record of one request and of each step inside it (model call, retrieval, tool call) |
| Hallucination (confabulation) | Output that is fluent but not supported by facts or sources |
| Grounding | Basing output on provided sources, verifiable by citation |
| Guardrail | A control around the model that blocks or modifies inputs or outputs |
| Red teaming | Adversarial testing that tries to make the system fail in harmful ways |
| Prompt injection | Input that makes the model follow attacker instructions instead of the developer's |
| Benchmark | A public, standardized evaluation used to compare models |
| pass@k / pass^k | Probability that at least one of k attempts passes / that all k attempts pass |

## How this course is organized

The path moves from general concepts to the engineering of complete systems, and then to testing and quality evaluation. The fictional store Stride's support assistant provides a recurring example. Some chapters also use the GimmeJob Learning Path Advisor.

| Part | Topics | What you gain |
|---|---|---|
| Foundations | This overview; [How LLMs generate text](/learn/llm?topic=llm-foundations); [Embeddings and similarity](/learn/llm?topic=embeddings-similarity) | Vocabulary, model mechanics and representations |
| Application engineering | [Application anatomy and APIs](/learn/llm?topic=llm-application-anatomy); [Prompts](/learn/llm?topic=prompts-as-artifacts); [Structured output](/learn/llm?topic=structured-output-validation) | Understand and assemble LLM-powered applications |
| Testing and evaluation | [Why LLM testing is different](/learn/llm?topic=llm-testing-problem-space); [Testing without the model](/learn/llm?topic=testing-without-the-model); [Evaluation methodology](/learn/llm?topic=evaluation-fundamentals); scorers, judges and statistics | Measure quality and detect regressions |
| Advanced systems | [RAG systems](/learn/llm?topic=rag-testing); [Agents and tool use](/learn/llm?topic=agent-testing) | Understand multi-stage retrieval and action workflows |
| Security and operations | [Security and guardrails](/learn/llm?topic=security-red-teaming); [Production quality](/learn/llm?topic=production-quality); [Governance](/learn/llm?topic=pro-practice) | Operate systems safely and responsibly |

Many examples run directly in the page. Later, Python 3.11+, a virtual environment and an optional hosted model API or local model via Ollama are useful. Runnable examples live in [examples/llm-testing](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing); the folder name predates this broader course structure.

## Choosing the simplest solution

A store policy question needs current policy evidence. A RAG application can retrieve relevant policy text, and a tool can look up the authenticated order if needed. The LLM can then explain the result, with links back to its sources. By contrast, converting a fixed CSV format into JSON is often better handled by a deterministic parser. Summarizing open-ended customer messages may genuinely benefit from generation, but privacy and acceptable output still matter.

Choose the architecture based on the job: correctness, freshness, privacy, latency, operational complexity and cost. Testing supports these goals; it is not the organizing principle for learning what an LLM is.

## Common mistakes

- Assuming every AI system is a chatbot or every neural network is an LLM.
- Confusing an LLM's generated text with a fact verified by an external source.
- Thinking that the model alone can enforce permissions or perform an external action.
- Using an agent where a simple script, search or one model call is sufficient.
- Choosing frameworks and providers before defining the problem and system boundaries.

## Summary

- Generative AI creates content; LLMs are one family of generative models.
- The model, the application and the product have different responsibilities.
- Tokens, context, embeddings, RAG and tool use each solve different problems.
- Learn the foundations and application architecture before evaluation, testing and operations.
