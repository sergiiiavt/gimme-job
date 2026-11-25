# Prompt engineering & structured output

20% of CCAR-F. The exam rewards explicit criteria and validated structure over clever wording.

## Explicit criteria beat adjectives

"Be conservative" or "only report important issues" changes little. "Report only bugs, security issues and data-loss risks; never comment on style" changes behaviour. When a reviewer's false positives make developers ignore it, cut or temporarily disable the noisiest categories first: trust comes back when the signal is clean.

## Few-shot examples

Use a small, evaluated set of targeted examples; no fixed count is best for every task. Show the ambiguous cases and the reasoning behind each decision, not only the easy ones. Examples fix output format and edge-case handling better than longer instructions.

## Structured output with schemas

A tool `input_schema` describes arguments. `tool_choice` selects whether/which tool must be called; neither alone enables strict schema enforcement. Use supported **strict tool use** (`strict: true`) for arguments, or supported **JSON structured outputs** for a response, with an accepted schema and compatible model/configuration. Handle refusals, truncation and transport errors. Validate the result on receipt. Even schema-valid content can be wrong: line items may not add up or a quoted source may not support a claim.

Design schemas so the model can be honest:

- make fields nullable or optional and tell the model to return null when the value is absent, instead of inventing a plausible invoice number;
- add an `other` enum value with a free-text detail field;
- include an explicit `unclear` value where a document is genuinely ambiguous.

## Validation and retry

After extraction, validate semantics in code: sums, date order, required combinations. On failure, retry with the source document, the failed output and the **specific** error. Retrying cannot recover information the source does not contain, so a null field that keeps failing is a sign to change the schema, not to retry more.

## The Message Batches API

Batches cost 50% less and complete within 24 hours, with no latency guarantee. Each request carries a `custom_id` that ties its result back to the input. Use batches for overnight extraction, weekly audits and backfills; never for a blocking pre-merge check someone waits on. Resubmit only the failed items.

## Reviewing large changes

A single pass over many files dilutes attention. Review each file on its own, then run one cross-file pass for integration issues such as a renamed function still called by its old name.

## Worked example

Extraction returns believable customer IDs for documents that have none. More retries or more examples with IDs make it worse. Make the field nullable, tell the model to return null when it is missing, and measure how often null is returned on documents you know lack an ID.

## Three separate validation layers

Record: title=QA Engineer, salary_min=5000, salary_max=3000, remote=hybrid. It can satisfy a JSON type schema yet fail salary order. Another record with ordered salaries can still invent a salary absent from the source. Check syntax/shape, business rules and evidence separately. A field missing from the source should be nullable; retries cannot recover a nonexistent fact. Compare `check_extraction` with `grounded_claims` in the exercise package.
