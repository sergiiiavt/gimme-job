# Prompt artifacts

Chapter: [Prompts as testable artifacts](https://gimme-job.com/learn/llm?topic=prompts-as-artifacts)

Prompts treated like code: versioned files, a reviewed lock, safe rendering of untrusted text, and instructions verified by code.

| File | Content |
|---|---|
| `prompts/<id>/<version>.txt` | Prompt templates (`string.Template` placeholders such as `$customer_message`, so JSON braces are safe) |
| `prompts/<id>/<version>.meta.json` | Owner, evaluated models, changelog and the evaluation run that approved the version |
| `prompts.lock` | Content hash of every approved version |
| `prompt_registry.py` | Loads prompts, builds and checks the lock. `python prompt_registry.py check` is the CI check; `lock` is the release step |
| `render.py` | Renders the system prompt and the customer message; neutralizes structural tags in untrusted text |
| `instruction_checks.py` | Code-verified instructions (length, bullets, required facts, apologies, language, e-mail leaks, exact order IDs) and input perturbations |
| `test_prompt_artifacts.py` | Lock integrity, silent-edit detection, structure fuzzing with Hypothesis, instruction checks, a metamorphic robustness test |

Change a released prompt and run the check to see the CI failure:

```bash
cd examples/llm-testing/05-prompt-artifacts
uv run --project .. python prompt_registry.py check
```

Key ideas shown by the tests:

- A released version never changes; any edit needs a new version and a review, which the lock enforces.
- Customer text can never open or close the application's structural tags, but plain-language instructions remain and are a separate (prompt-injection) test topic.
- Typos, casing, whitespace, greetings and emoji must not change the facts in an answer (metamorphic relation).

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/05-prompt-artifacts
```
