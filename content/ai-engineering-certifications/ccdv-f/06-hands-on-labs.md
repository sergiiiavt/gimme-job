# Hands-on labs

Three labs that cover every CCDV-F domain and each leave a working GimmeJob feature behind. They need an API key with a low spend limit set on the workspace.

## Lab 1: Streaming vacancy summariser

Build an endpoint that summarises a job posting into role, seniority, stack, salary (or "not stated") and red flags.

- Stream the response to the UI, and handle every `stop_reason`, including `max_tokens` and `refusal`.
- Retry 429, 529 and 5xx errors with backoff and jitter. Fail fast on 400.
- Return the fields through a JSON Schema and validate them in code, retrying once with the specific error.

Trains: applications and integration, structured output, error handling.

## Lab 2: Overnight question classifier

Classify every interview question in the GimmeJob catalog by topic and difficulty.

- Compare a Haiku-tier and a Sonnet-tier model on 30 hand-labelled questions, and pick the cheaper one if it meets the bar.
- Send the full run through Message Batches with a `custom_id` per question, and resubmit only the failures.
- Cache the long system prompt and its examples, and measure the cache hit rate.

Trains: model selection, batches, prompt caching, evaluation.

## Lab 3: Vacancy-research agent with an evaluation set

An agent with search_vacancies, get_company and save_note tools.

- Hand-write the loop with an iteration cap, then compare it with the SDK's Tool Runner.
- Return tool failures as `is_error`. Require approval before save_note writes anything.
- Feed it one vacancy page that contains an injected instruction, and confirm that tool scoping, not prompt wording, stops it.
- Build a 20-case evaluation set and re-run it after every prompt change. Report the results by vacancy type.

Trains: agents and tools, security, evaluation and debugging.

## Executable baseline and independent oracle

Use the [offline practice package](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice). Requires Python 3.10+, no model or API key. Run `python examples/certification-practice/practice.py developer`: every reference case should pass. Copy `starter.py` to a scratch file; `--candidate your_solution.py` should fail until you implement the required functions. Retain fixture IDs, expected/actual outputs and the command exit status.

| Stage | Task | Check |
| --- | --- | --- |
| Derive | Read requirements before the reference code | Explain the expected outputs independently |
| Implement | Fill only your track’s starter functions | All selected cases pass; the unfinished starter fails |
| Challenge | Introduce an incorrect boundary, source claim or error state | At least one relevant oracle rejects it |
| Review | Explain a plausible mistake and missing production controls | Record limits, not just a green status |

Check bounded replay decisions, nullable extraction and four trace outcomes. The retry function is a policy exercise; a real HTTP client still needs backoff/jitter, Retry-After, deadlines and operation reconciliation. Optional live-tool practice requires authorized access and a usage budget; production writes are outside this sandbox.
