# Data & architecture

10–15% of GH-300. Use the sequence below as a conceptual model; verify the actual client/feature contract.

## The suggestion lifecycle

1. **Context gathering:** the IDE collects code around the cursor, open tabs and related files.
2. **Prompt building:** the client assembles that context into a prompt.
3. **Proxy filtering:** a GitHub proxy screens the prompt, for example for toxic language, relevance and hacking attempts.
4. **Model response:** the model generates candidate completions.
5. **Post-processing:** filters run on the output, such as the public-code duplication check and vulnerability screening.
6. **Display:** the suggestion appears in the editor or chat for you to accept or reject.

## How context is determined

Inline suggestions lean on nearby code and other open files, so keeping the relevant files open improves results. Chat can widen context with `@workspace` or `#codebase`, or narrow it with `#selection` and `#file`. Content exclusion removes files from this context where it is supported.

## Data usage and retention

Know the difference between prompts and suggestions (the content exchanged) and engagement data (how features are used). Retention rules differ by surface and plan and have changed over time, so check GitHub's current Copilot Trust Center documentation rather than memorising a number. For the cloud agent, session logs are kept to provide the service.

## Limitations of the model

LLMs predict likely text; they do not verify it. Training data has a cutoff, suggestions can be outdated, and output varies between runs. That is why the architecture adds filters and why the developer still validates.

## Worked example

A question lists four orderings of prompt, proxy, model and filters. In the simplified architecture assumed by that question, the sequence is: the client builds the prompt, the proxy screens it, the model responds, post-processing filters run, then the suggestion is shown.

## A conceptual context flow

Task → available authorized context → model request → suggested change → human/application verification is a conceptual model, not a promise that every Copilot surface uses the same pipeline or filter order. Record which client/feature and policy you actually used. Exclusion, retention and training commitments depend on plan, setting and feature; verify current documentation and do not infer guarantees from the diagram.
