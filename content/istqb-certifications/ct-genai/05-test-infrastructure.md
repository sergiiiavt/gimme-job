# LLM-powered test infrastructure

Chapter 4 explains how GenAI test tools are built: architecture, RAG, agents, fine-tuning and LLMOps.

## Architecture components

- **Front-end:** where testers enter queries or commands.
- **Back-end:** authentication, data retrieval, prompt preparation, LLM interaction and post-processing.
- **LLM:** a third-party service through an API, or a custom in-house model.
- **Data sources:** relational databases for structured test data such as test cases, and vector databases for semantic retrieval using embeddings.

A rule-based chatbot follows scripted responses; an LLM-powered test tool generates insights dynamically from context, analyses requirements, generates test cases and evaluates output.

## Retrieval-augmented generation (RAG)

**Preprocessing:** split documents into chunks (for example 256 to 512 tokens), encode each chunk as an embedding, and store it in a vector database.

**At runtime:**

1. **Retrieval:** find the chunks semantically closest to the encoded query.
2. **Generation:** the LLM combines the retrieved context with its own knowledge to answer.

The benefit for testing: answers are grounded in current specifications, requirements and test data instead of the model's training data alone.

## LLM-powered agents

Agents are semi-autonomous or autonomous GenAI applications that use an LLM to understand and generate, and call **tools** to act on external systems.

- **Autonomous agents** run with minimal human intervention, using rules, reinforcement learning and feedback loops.
- **Semi-autonomous agents** run with periodic human oversight toward user-defined goals.
- In a **multi-agent** architecture, specialised agents coordinate; this is called **orchestration**.

Agents can cover analysis, design, implementation, execution and reporting. For critical tasks, use automated verification of results or keep agents semi-autonomous.

## Fine-tuning

Fine-tuning further trains a pre-trained model (LLM or SLM) on a targeted dataset to specialise it. Steps: select a model, prepare a task-specific dataset, apply a fine-tuning framework, then test with prompts and assess output quality.

Challenges: biased or inaccurate results from poor data, **overfitting** that reduces generalisation, opacity that complicates debugging, and high compute cost. Fine-tuned **SLMs** can reach strong task performance with less compute than LLMs.

## LLMOps

LLMOps covers the practices, tools and processes for developing, deploying and maintaining LLMs in production. Three adoption approaches:

| Approach | Main concerns |
| --- | --- |
| AI chatbot | Data privacy, security and cost; LLM-as-a-service or in-house open-source models |
| Test tool with GenAI | The same, plus the vendor's data security and performance assurances |
| In-house GenAI test tool | Maximum control; plan compute, storage, staff training and validation |

## RAG failure analysis

Facts F1=hybrid, F2=Kyiv, F3=salary unknown. Retrieval returns F1 and F2; generation says remote with salary 5000. Check retrieval relevance/recall separately from answer grounding: a valid link to F1 does not support “remote”. Require null for missing salary and run `grounded_claims`. Fine-tuning changes model behavior but is not a substitute for fresh access-controlled facts. Record source version, retrieval query and safe output evidence for a reproducible failure.
