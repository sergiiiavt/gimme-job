# Hands-on labs

These labs follow the syllabus hands-on objectives. Use only non-sensitive data, such as the public GimmeJob catalog or an open-source project.

## Lab 1: Tokens and context

Paste one of your test plans into a tokenizer tool and record the token count. Estimate how many such documents fit in a typical context window, and what one month of daily use would cost at a published price per million tokens.

Trains: tokenization, context windows, recurring cost (chapters 1 and 5).

## Lab 2: A structured prompt from a user story and a wireframe

Take a user story and a wireframe image. Write a prompt with all six components (role, context, instruction, input data, constraints, output format) that generates acceptance criteria. Mark each component in your prompt.

Trains: prompt structure and multimodal input (chapters 1 and 2).

## Lab 3: Chaining with human checks

Chain three prompts: find ambiguities in a requirement, derive test conditions from the clarified version, then prioritise them by risk. Review and correct the output after each step before moving on.

Trains: prompt chaining and test analysis (chapter 2, K3).

## Lab 4: Few-shot Gherkin

Give two example scenarios in Gherkin and ask for scenarios covering the remaining acceptance criteria. Then run zero-shot on the same task and compare format consistency.

Trains: zero-, one- and few-shot prompting and choosing a technique (chapter 2).

## Lab 5: Catching hallucinations

Ask for test cases for a feature and check each one against the specification. Label each problem as a hallucination, a reasoning error or a bias. Lower the temperature, rerun three times, and compare consistency.

Trains: risk identification and non-determinism (chapter 3).

## Lab 6: Measure, don't guess

Score ten generated test cases for accuracy, relevance, diversity and execution success rate. Change one thing in the prompt, rescore, and decide which version to keep.

Trains: evaluation metrics and prompt refinement (chapter 2).

## Executable baseline and independent oracle

Use the [offline practice package](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice). Requires Python 3.10+, no model or API key. Run `python examples/certification-practice/practice.py genai`: every reference case should pass. Copy `starter.py` to a scratch file; `--candidate your_solution.py` should fail until you implement the required functions. Retain fixture IDs, expected/actual outputs and the command exit status.

| Stage | Task | Check |
| --- | --- | --- |
| Derive | Read requirements before the reference code | Explain the expected outputs independently |
| Implement | Fill only your track’s starter functions | All selected cases pass; the unfinished starter fails |
| Challenge | Introduce an incorrect boundary, source claim or error state | At least one relevant oracle rejects it |
| Review | Explain a plausible mistake and missing production controls | Record limits, not just a green status |

Complete the six preceding exercises with R1 and F1–F3; compare independent expected IDs, unsupported claims and metric denominators. The local oracle validates the deterministic outputs, not stochastic model quality. Optional live-tool practice requires authorized access and a usage budget; production writes are outside this sandbox.
