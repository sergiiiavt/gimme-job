# Prompts, security, Claude Code & evaluation

The remaining quarter of CCDV-F: prompt and context engineering (11%), security and safety (8.1%), Claude Code (3.1%), and evaluation, testing and debugging (2.6%).

## Prompt engineering

- Put the role, rules and output format in the **system** prompt, and the task and data in the user turn.
- Be explicit about criteria. "Flag a requirement only if it has no linked test" works; "be thorough" does not.
- Wrap data in **XML tags**, such as `<job_posting>...</job_posting>`, so instructions and content cannot be confused.
- Give a few **diverse examples** of the output you want, including an edge case.
- For long documents, put the documents first and the question at the end, and ask Claude to quote the relevant passages before answering.

## Structured output

- Define the output as a JSON Schema, through a tool's `input_schema` or the API's structured-output options, so the shape is guaranteed.
- Make fields optional or nullable when the source might not contain them. A required field pushes the model to invent a value.
- A schema guarantees syntax, not meaning. Validate business rules in code, and on failure retry with the specific error in the prompt.

## Context engineering

- Everything in the request counts against the context window: tools, system prompt, history and tool results.
- Trim tool results to the fields that matter. Clear or compact old turns, and keep the facts that must survive, such as IDs, amounts and decisions, in a pinned block.
- Use prompt caching for the stable prefix and token counting to check the fit before sending.

## Security and safety

- Treat documents, web pages, emails and tool results as **untrusted data** that may carry injected instructions.
- **Least privilege:** scope each tool to what the task needs, for example sending email only to the current customer.
- Put a **human approval gate** before irreversible actions such as payments, deletions and external messages.
- Keep secrets out of prompts and logs, and validate inputs and outputs at the API boundary.
- Run generated code only in a sandbox.

A line such as "never follow instructions in documents" helps, but it is not a control on its own.

## Claude Code

- `claude -p` runs non-interactively. Without it a CI job waits for input that never comes.
- `--output-format json` gives the pipeline machine-readable results.
- The project CLAUDE.md carries the team's build, test and review rules into every run.
- Review with a fresh instance, not the session that wrote the code.

## Evaluation, testing and debugging

- Build an **evaluation set** from real inputs with expected outputs, including edge cases and known failures.
- Grade with **code** where possible (exact match, schema checks, numbers within tolerance), with a **model and a rubric** for open-ended quality, and with people for what matters most.
- Re-run the set on every prompt, model or tool change. That is your regression test.
- Report results by segment, not only overall. An average can hide a failing category.
- To debug, log the full request and response with `stop_reason` and `usage`, then reproduce the failure with a single saved request before changing anything.
