# LLM testing examples

Runnable sub-projects for the [Generative AI & LLM testing course](https://gimme-job.com/learn/llm). Each folder applies one chapter's method to real code with a real test suite, so you can read the technique, run it, break it and extend it.

| Folder | Chapter | What it demonstrates |
|---|---|---|
| [01-property-oracles](01-property-oracles) | Why LLM testing is different | Property oracles for generative answers, their limits, and how many runs reveal a rare failure |
| [02-generation-mechanics](02-generation-mechanics) | How LLMs generate text | A BPE tokenizer, softmax/temperature/top-k/top-p with property-based tests, and a needle-in-a-haystack test generator |
| [03-similarity-thresholds](03-similarity-thresholds) | Embeddings and similarity | Similarity measures, a threshold-calibration tool on labelled pairs, and recall measurement of an approximate index |
| [04-model-client](04-model-client) | LLM application anatomy and APIs | Stop-reason handling for two providers, a bounded retry policy tested with a fake clock, replayed stream recordings, cost per resolved task |
| [05-prompt-artifacts](05-prompt-artifacts) | Prompts as testable artifacts | Versioned prompt files with a lock file checked in CI, safe rendering fuzzed with Hypothesis, code-verified instructions, metamorphic input tests |
| [06-structured-output](06-structured-output) | Structured output and validation | A Pydantic contract, the extract/validate/repair/fallback pipeline against recorded raw outputs, schema-generated property tests, field-level accuracy |
| [07-testing-without-the-model](07-testing-without-the-model) | Testing LLM code without the model | A support assistant with an injected client, all kinds of test doubles, context-assembly invariants, a prompt snapshot, provider contract fixtures, tool authorization, record and replay with vcrpy |
| [08-evaluation-methodology](08-evaluation-methodology) | Evaluation methodology and datasets | Error analysis with priorities and saturation, a dataset builder and validator (personal data, duplicates, stratified sampling, hash splits, leakage), pairwise case design, label agreement, and an evaluation runner with a cache, a run manifest and flipped cases |
| [09-code-based-scorers](09-code-based-scorers) | Code-based scorers and metrics | Text and classification metrics with property-based tests, a bilingual fact scorer validated against human labels, a scoring harness that compares two versions slice by slice, execution-based scoring of generated SQL |
| [10-llm-judge](10-llm-judge) | LLM-as-a-judge | A versioned judge prompt with strict verdicts, validation on development and test labels, the corrected pass rate with a bootstrap interval, and probes for position and verbosity bias, all checked against a simulated judge with known error rates |
| [11-eval-statistics](11-eval-statistics) | Statistics for evaluation | Wilson and exact intervals with exact coverage checks, McNemar's test and the paired bootstrap, pass@k and pass^k, clustered errors, sample size and power, the Holm correction, and a release gate that decides ship, block or inconclusive |
| [12-rag-testing](12-rag-testing) | Evaluating RAG systems | A chunker with property-based invariants, BM25 written out, retrieval metrics against labelled questions, a small RAG pipeline with tenant filtering and document versions, faithfulness and citation checks with injected faults, abstention outcomes, and metamorphic tests |
| [13-agent-testing](13-agent-testing) | Evaluating agents and tool use | A support-agent environment with validated, scoped tools and an approval gate, outcome and trajectory checks, fault injection with false-claim detection, pass^k over seeded runs, and an MCP-style server with protocol contract tests |

## Principles

- **Offline by default.** Every test runs without network access or API keys, using fake models, recorded responses and fixtures. That is how LLM application code should be unit-tested.
- **Live checks are opt-in.** Tests marked `live` call a real provider and run only when you ask for them.
- **Deterministic.** Random behaviour uses fixed seeds, so a failure is reproducible.

## Run

With [uv](https://docs.astral.sh/uv/) from the repository root:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing
```

Or with pip in a virtual environment:

```bash
pip install hypothesis==6.169.0 hypothesis-jsonschema==0.23.1 pydantic==2.14.0 pytest==9.1.1 vcrpy==8.3.0
cd examples/llm-testing && pytest
```

Run one sub-project by passing its folder, for example `pytest examples/llm-testing/04-model-client`.

## Live checks against a real model

```bash
uv sync --project examples/llm-testing --extra live
LLM_PROVIDER=openai LLM_MODEL=<pinned model id> OPENAI_API_KEY=... uv run --project examples/llm-testing pytest examples/llm-testing -m live
LLM_PROVIDER=anthropic LLM_MODEL=<pinned model id> ANTHROPIC_API_KEY=... uv run --project examples/llm-testing pytest examples/llm-testing -m live
```

Live checks cost money and their results vary between runs; they verify integration, not quality. Quality is measured with evaluation datasets, as described in the course.

## Continuous integration

The repository's `Validate` workflow job verifies the lock file and runs the offline suite on every pull request, so the examples stay working as the course evolves.
