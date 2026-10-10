Large language models are not deterministic functions that you call with an input and compare with one expected output. They are probability machines that generate text one token at a time. Every testing technique in this learning path follows from that fact.

This chapter gives you a tester's mental model of an LLM. It covers enough of the internals to predict how the model fails, without the linear algebra.

## 1. Where this path starts and ends

The path is ordered. Each chapter assumes the previous one.

| Level | Chapters | You can… |
|---|---|---|
| Beginner | 1–2 | Explain how an LLM produces output and build a small LLM application to test |
| Intermediate | 3–5 | Build datasets, write deterministic and model-graded evals, and evaluate RAG pipelines |
| Advanced | 6–8 | Test agents, red-team LLM applications, and run evals in CI and production |
| Pro | 9 | Design statistically sound evaluation programs, benchmarks and governance evidence |

Prerequisites: Python basics, pytest, HTTP/JSON APIs and Git. If any of those are new, start with [Programming](/learn/programming), [API & Integration](/learn/api) and [Test automation](/learn/automation). The ISTQB [CT-AI syllabus](/learn/certifications?track=ct-ai-v2) is a useful companion for terminology. This path goes deeper on generative systems.

## 2. Tokens, not characters or words

An LLM never sees text. A **tokenizer** first splits text into tokens: frequent words, word pieces, punctuation and bytes. Each token becomes an integer ID.

Practical consequences for testers:

- **Limits and prices are counted in tokens.** The context window, the maximum output length, rate limits and cost all use tokens. A rough English average is about 4 characters per token. Ukrainian, code, JSON and rare words usually need more tokens per character.
- **Character-level tasks are unreliable.** Counting letters, reversing strings, exact character positions and some arithmetic fail because the model does not see individual characters.
- **The same visible text can tokenize differently.** Leading spaces, Unicode normalization, invisible characters and homoglyphs change the tokens. Attackers use this to hide instructions.
- **Truncation happens at token boundaries.** When an output hits `max_tokens`, it can stop mid-word or mid-JSON. Always test for a truncated response.

## 3. Next-token prediction

Generation is a loop:

1. The model reads all tokens in the context: system prompt, conversation, retrieved documents, tool results and the output so far.
2. It computes a probability distribution over the whole vocabulary for the next token.
3. A **sampler** picks one token from that distribution.
4. The token is appended and the loop repeats until a stop token, a stop sequence or the token limit.

The model has no separate "fact lookup" step. A fluent wrong answer and a fluent right answer come from the same mechanism. This is why **hallucination is a property of the method, not a rare bug**.

## 4. Transformers and attention, at intuition level

Modern LLMs are **transformers**. The key mechanism is **attention**: when producing each token, the model weighs how relevant every earlier token is.

What matters for testing:

- **The context window is the model's only working memory.** Anything not in the context does not exist for that call, unless it was learned during training.
- **Long contexts degrade unevenly.** Models often use information at the start and end of a long context better than information in the middle. This is called *lost in the middle*. Test long-context features with the key fact placed at different positions.
- **Order and formatting matter.** Moving an instruction, a delimiter or an example can change behaviour. Treat prompt layout as code.

## 5. Sampling parameters

| Parameter | Effect | Testing implication |
|---|---|---|
| `temperature` | Scales the probability distribution. 0 is close to greedy; higher values add randomness | Use low values for extraction and classification; test creative features at their production setting |
| `top_p` | Samples only from the smallest set of tokens whose probability sums to `p` | Change one sampling parameter at a time when comparing runs |
| `max_tokens` | Hard cap on output length | Test truncated outputs and what the application does with them |
| stop sequences | End generation when a string appears | Test that a stop string inside legitimate content does not cut answers |
| `seed` | Some providers offer best-effort reproducibility | Never assume it guarantees identical output |

### Temperature 0 is not deterministic

Even at temperature 0, outputs can differ between runs. Causes include floating-point non-associativity on GPUs, batching with other requests, provider-side model updates and ties between tokens. **A test that passed once has not proven anything.** Chapter 4 covers how to test under non-determinism.

## 6. How models are trained

1. **Pretraining.** The model predicts the next token over a very large text corpus. It learns language, facts, code and patterns, including errors and biases in that data.
2. **Instruction tuning.** Supervised examples teach it to follow instructions and to use a chat format.
3. **Preference tuning.** Methods such as RLHF or DPO push the model toward answers humans or rubric graders prefer: helpful, honest, harmless.
4. **System prompt and runtime context.** The application adds instructions, tools and data at request time.

Each stage leaves testable traces:

- **Knowledge cutoff.** The model knows nothing after its training data ends unless you give it fresh context.
- **Sycophancy.** Preference tuning can teach a model to agree with the user, including when the user is wrong.
- **Over-refusal and under-refusal.** Safety tuning can block legitimate requests or miss harmful ones.
- **Training-data bias.** Stereotypes and uneven quality across languages come from the data.

## 7. Embeddings and semantic similarity

An **embedding model** turns text into a vector of numbers. Texts with similar meaning get vectors that point in similar directions. Similarity is usually measured with **cosine similarity**.

Embeddings power semantic search, RAG retrieval, clustering, deduplication and similarity-based test assertions.

Limits a tester must know:

- High similarity does not mean the same meaning. "The refund was approved" and "The refund was not approved" can score very close.
- Scores are not comparable across embedding models, and a threshold that works for one model breaks with another.
- Embedding models have their own token limits; long text may be silently truncated.
- Domain jargon, code, numbers and rare languages often embed poorly.

## 8. A catalogue of LLM failure modes

Use this list as a test-design checklist.

| Failure mode | What it looks like | First test idea |
|---|---|---|
| Hallucination | Confident, fluent, wrong facts, invented citations or APIs | Ask about facts not in the context; verify every claim against sources |
| Unfaithfulness | Answer contradicts or goes beyond the provided documents | Compare answer claims with retrieved context |
| Instruction drift | Ignores a system rule after several turns or a long input | Multi-turn tests with the rule challenged late |
| Format violation | Invalid JSON, missing fields, extra prose around JSON | Schema validation on every output |
| Sycophancy | Changes a correct answer when the user pushes back | Follow-up turn "Are you sure? I think X" |
| Over-refusal | Refuses a legitimate request | Borderline-but-legitimate prompts in the dataset |
| Inconsistency | Different answers to paraphrases of the same question | Metamorphic paraphrase tests |
| Lost in the middle | Misses facts placed mid-context | Position sweep of the key fact |
| Prompt injection | Follows instructions hidden in user data or documents | Injected instructions inside retrieved content |
| Bias | Different quality or tone by name, gender, region or language | Counterfactual input pairs |
| Stale knowledge | Answers with outdated facts | Questions about recent changes, with and without context |

## 9. The model landscape

You will test applications built on very different models. Compare them on:

- **Access:** closed API (Anthropic, OpenAI, Google and others) vs open-weight models you host yourself.
- **Capability vs cost vs latency:** larger models are usually stronger, slower and more expensive. Many products route easy requests to a small model.
- **Context window and output limits.**
- **Modalities:** text, images, audio, tool use, structured output support.
- **Model cards and system cards:** intended use, known limitations, evaluation results and safety testing.
- **Versioning:** pinned model versions vs moving aliases. A moving alias can change behaviour without any change in your code.

Treat a model change like a dependency upgrade: run the full evaluation suite before switching.

## 10. Why classic test oracles break

A classic automated test has an **oracle**: a precise expected result. LLM features often have:

- **many correct outputs** (a summary can be phrased in thousands of valid ways);
- **partially correct outputs** (four claims right, one wrong);
- **non-deterministic outputs** (different on every run);
- **quality judgements** (tone, helpfulness, safety) instead of equality.

The rest of the path replaces "assert output == expected" with a toolkit:

- deterministic checks on structure and constraints;
- reference-based metrics;
- model-graded evaluation with calibrated judges;
- human review;
- statistics over many runs.

## 11. QA quick reference

- Never accept one passing run as evidence. Repeat and measure.
- Record model name, version, parameters and prompt version with every test result.
- Always test truncation, empty output, invalid JSON and refusal paths.
- Check behaviour in every language the product supports, not only English.
- Treat the context window as a budget: measure token counts of real inputs.
- Keep a living failure-mode checklist per feature.

## 12. Practice

1. Use a tokenizer playground or library to tokenize the same sentence in English and Ukrainian. Compare token counts and estimate the cost difference for 10,000 requests.
2. Send the same prompt 30 times at temperature 0 and 30 times at temperature 1. Count distinct outputs and compute pairwise embedding similarity. Write one paragraph on what this means for test design.
3. Hide one key fact at the start, middle and end of a long document. Ask a question that needs it and record the accuracy per position.
4. Pick one product feature you know and map it to at least five failure modes from section 8.

**Exit check:** you can explain to a developer, with numbers from exercise 2, why "it worked when I tried it" is not a test result.

## Sources

- [Andrej Karpathy — Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Jay Alammar — The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/)
- [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course)
- [Liu et al. — Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)
- [OWASP — Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
