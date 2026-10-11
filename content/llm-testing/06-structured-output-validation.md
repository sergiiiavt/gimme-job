# Structured output and validation

Free text is written for people. As soon as a model's output is read by code, to route a ticket, fill a form, write a database row or call a tool, it becomes an interface between two programs, and it needs a contract: a schema that says what a valid output is, and validation that enforces it every time. This chapter shows how to design that contract, how to enforce it with a validation pipeline that also repairs and falls back safely, how provider-native structured outputs help and where they stop helping, and which test cases every structured output needs.

**Prerequisites:** [LLM application anatomy and APIs](/learn/llm?topic=llm-application-anatomy), [Prompts as testable artifacts](/learn/llm?topic=prompts-as-artifacts).

## When output must be structured

Require structured output whenever code consumes the result:

| Consumer | Example in the Stride assistant | Structure |
|---|---|---|
| Routing logic | Send a ticket to billing, returns or technical support | Enum `category`, integer `priority` |
| User interface | Show an answer with clickable sources | `answer` text plus an array of source IDs |
| Database write | Store the extracted delivery address | Object with typed address fields |
| Tool call | Look up an order | Arguments matching the tool's input schema |
| Downstream model step | Pass extracted claims to a judge | Array of claim strings |

Extracting values from free text with regular expressions after the fact is fragile: the wording changes between runs, between prompt versions and between models. Asking for structure up front moves the problem from parsing prose to validating data, which is a solved engineering problem.

## Designing the output contract

The schema is an API contract between the model and your code. Design it with the same care:

- **Keep it minimal.** Every field is something the model can get wrong. Ask only for what the consumer uses.
- **Prefer enums to free text** for anything that drives logic. `"category": "returns"` is testable; `"category": "the customer wants to return something"` is not.
- **Make "unknown" representable.** If the model may not know a value, allow `null` or an explicit `"other"` / `"unknown"` value. Otherwise the schema forces the model to invent one.
- **Bound everything.** Maximum string lengths, numeric ranges and array sizes protect the UI and the database and make boundary tests possible.
- **Reference inputs by ID.** Citations should be IDs of retrieved chunks, not free-text titles, so that code can verify them.
- **Separate reasoning from the result.** If you ask for an explanation, put it in its own field and never show it to users by accident.
- **Version the schema.** A schema change is a breaking interface change for every consumer and every stored record.

The running example is a triage object for customer messages:

```json
{
  "type": "object",
  "properties": {
    "category": {"type": "string", "enum": ["billing", "technical", "account", "returns", "other"]},
    "priority": {"type": "integer", "minimum": 1, "maximum": 4},
    "summary": {"type": "string", "maxLength": 280},
    "needs_human": {"type": "boolean"},
    "order_id": {"type": ["string", "null"], "pattern": "^A-[0-9]{4}$"},
    "language": {"type": "string", "enum": ["en", "uk"]}
  },
  "required": ["category", "priority", "summary", "needs_human", "order_id", "language"],
  "additionalProperties": false
}
```

The keywords used here cover most real schemas:

| Keyword | Meaning |
|---|---|
| `type` | JSON type of the value; a list such as `["string", "null"]` allows several |
| `properties` | Schema of each named field |
| `required` | Fields that must be present (present with value `null` is still present) |
| `additionalProperties: false` | No fields other than the listed ones are allowed |
| `enum` | The value must be one of the listed values |
| `minimum`, `maximum` | Numeric bounds |
| `maxLength`, `minLength` | String length bounds |
| `pattern` | Regular expression the string must match |
| `items`, `minItems`, `maxItems` | Schema and size of arrays |

### Reviewing a weak schema

`{"type": "object", "properties": {"category": {"type": "string"}, "urgent": {"type": "string"}, "details": {"type": "object"}}}` has six defects: `category` is free text, so routing code cannot rely on it; `urgent` is a string where a boolean is meant; `details` is an unconstrained object, so anything passes; nothing is `required`, so `{}` is valid; extra fields are allowed; and there are no length limits and no way to say "unknown".

### The same contract as a Pydantic model

In Python the contract is usually written as a Pydantic model, which validates data and generates the JSON Schema for provider requests (run on your own machine):

```python
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class TicketTriage(BaseModel):
    model_config = ConfigDict(extra="forbid")            # additionalProperties: false

    category: Literal["billing", "technical", "account", "returns", "other"]
    priority: int = Field(ge=1, le=4)
    summary: str = Field(min_length=1, max_length=280)
    needs_human: bool
    order_id: str | None = Field(default=None, pattern=r"^A-\d{4}$")
    language: Literal["en", "uk"]


schema = TicketTriage.model_json_schema()               # send this to the provider

raw = '{"category": "Returns", "priority": "2", "summary": "Return request", "needs_human": false, "order_id": null, "language": "en"}'
try:
    TicketTriage.model_validate_json(raw)
except ValidationError as error:
    print(error)                                         # category: input should be 'billing', 'technical', ...
```

Note two Pydantic behaviours that matter for tests. By default Pydantic **coerces** compatible types, so `"priority": "2"` becomes the integer 2; use strict mode if the contract requires real integers. And enum values are **case-sensitive**: `"Returns"` fails, which is correct behaviour for a contract but means you must decide whether to normalize casing before validation.

## The validation pipeline

A robust consumer of model output runs every response through the same pipeline:

```diagram
raw model text
   │
   ▼
extract ── find the JSON object (models sometimes add prose or a Markdown fence)
   │
   ▼
parse ── json.loads; on failure: truncated (stop reason max_tokens) or malformed
   │
   ▼
normalize ── repair harmless drift only: enum casing, surrounding whitespace
   │
   ▼
schema validation ── types, required fields, enums, ranges, lengths, patterns, no extra fields
   │
   ▼
semantic validation ── rules a schema cannot express: agreement with the input and between fields
   │
   ├── valid ──► accept, log
   │
   └── invalid ──► repair: call the model again with the validation errors (bounded attempts)
                      │
                      └── still invalid ──► fallback: safe default + escalate + log
```

Two steps deserve emphasis:

- **Semantic validation** checks what JSON Schema cannot: that an `order_id` actually appears in the customer's message (otherwise it is hallucinated), that the `language` matches the message, that every cited source ID was among the retrieved chunks, that a refund amount does not exceed the order total.
- **Fallback** must be safe and visible. For triage, a safe fallback is "category other, needs a human"; it costs some manual work but never routes a ticket wrongly with confidence. Every fallback is logged and counted, because a rising fallback rate is an early signal of a regression.

The complete implementation below follows the diagram. A scripted fake model plays back responses, so every branch can be exercised without network access.

```python
import json
import re

CATEGORIES = {"billing", "technical", "account", "returns", "other"}
LANGUAGES = {"en", "uk"}
FIELDS = {"category", "priority", "summary", "needs_human", "order_id", "language"}
FALLBACK = {"category": "other", "priority": 3, "summary": "Needs manual triage",
            "needs_human": True, "order_id": None, "language": "en"}


def extract_json(text: str) -> str:
    """Models sometimes wrap JSON in prose or a Markdown fence: take the outermost object."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found")
    return text[start:end + 1]


def normalize(data: dict) -> dict:
    """Repair harmless drift before validating: enum casing and surrounding spaces."""
    fixed = dict(data)
    for key in ["category", "language"]:
        if isinstance(fixed.get(key), str):
            fixed[key] = fixed[key].strip().lower()
    return fixed


def schema_errors(data: dict) -> list[str]:
    errors = []
    if FIELDS - data.keys():
        errors.append(f"missing fields: {sorted(FIELDS - data.keys())}")
    if data.keys() - FIELDS:
        errors.append(f"unexpected fields: {sorted(data.keys() - FIELDS)}")
    if data.get("category") not in CATEGORIES:
        errors.append(f"category must be one of {sorted(CATEGORIES)}")
    priority = data.get("priority")
    if isinstance(priority, bool) or not isinstance(priority, int) or not 1 <= priority <= 4:
        errors.append("priority must be an integer from 1 to 4")     # bool is a subclass of int!
    summary = data.get("summary")
    if not isinstance(summary, str) or not summary.strip() or len(summary) > 280:
        errors.append("summary must be a non-empty string of at most 280 characters")
    if not isinstance(data.get("needs_human"), bool):
        errors.append("needs_human must be true or false")
    order_id = data.get("order_id")
    valid_id = isinstance(order_id, str) and re.fullmatch(r"A-\d{4}", order_id)
    if order_id is not None and not valid_id:
        errors.append("order_id must be null or match A-1234")
    if data.get("language") not in LANGUAGES:
        errors.append("language must be en or uk")
    return errors


def semantic_errors(data: dict, message: str) -> list[str]:
    """Rules a schema cannot express: the output must agree with the input."""
    errors = []
    if data["order_id"] is not None and data["order_id"] not in message:
        errors.append(f"order_id {data['order_id']} does not appear in the message")
    expected_language = "uk" if re.search(r"[а-яіїєґ]", message.lower()) else "en"
    if data["language"] != expected_language:
        errors.append(f"language should be {expected_language}")
    return errors


def parse_and_validate(raw: str, message: str) -> tuple:
    try:
        data = json.loads(extract_json(raw))
    except ValueError as error:                       # JSONDecodeError is a ValueError
        return None, [f"not valid JSON: {error}"]
    if not isinstance(data, dict):
        return None, ["top-level value must be an object"]
    data = normalize(data)
    errors = schema_errors(data) or semantic_errors(data, message)
    return (None if errors else data), errors


def triage(message: str, model, max_attempts: int = 2) -> tuple:
    feedback = []
    for attempt in range(1, max_attempts + 1):
        raw = model(message, feedback)                # feedback goes into the repair prompt
        data, errors = parse_and_validate(raw, message)
        if data is not None:
            return data, f"accepted on attempt {attempt}"
        feedback = errors
    return dict(FALLBACK), f"fallback after {max_attempts} attempts; last errors: {feedback}"


def scripted(*responses):
    """Fake model that returns the scripted responses in order."""
    queue = list(responses)
    return lambda message, feedback: queue.pop(0)


good = '{"category": "returns", "priority": 2, "summary": "Wants to return shoes", "needs_human": false, "order_id": "A-1042", "language": "en"}'
message = "Hi, I want to return my order A-1042, the shoes are too small."
cases = [
    ("clean JSON", scripted(good)),
    ("JSON inside prose and a fence", scripted("Sure! Here it is:\n```json\n" + good + "\n```")),
    ("enum casing drift", scripted(good.replace('"returns"', '"Returns"'))),
    ("priority as a string, then fixed", scripted(good.replace('"priority": 2', '"priority": "2"'), good)),
    ("truncated output, then fixed", scripted(good[:70], good)),
    ("hallucinated order id twice", scripted(good.replace("A-1042", "A-9999"), good.replace("A-1042", "A-7777"))),
]
for name, model in cases:
    data, outcome = triage(message, model)
    print(f"{name:<34} -> {outcome}")
```

Output:

```text
clean JSON                         -> accepted on attempt 1
JSON inside prose and a fence      -> accepted on attempt 1
enum casing drift                  -> accepted on attempt 1
priority as a string, then fixed   -> accepted on attempt 2
truncated output, then fixed       -> accepted on attempt 2
hallucinated order id twice        -> fallback after 2 attempts; last errors: ['order_id A-7777 does not appear in the message']
```

Each line is a test of one branch. In a real test suite each would be a separate test case asserting the outcome, the number of model calls and the logged event.

**What the repair prompt contains.** The second attempt sends the original request plus a message such as: *"Your previous output was invalid: priority must be an integer from 1 to 4. Return only the corrected JSON object."* Repair prompts work well for format errors and poorly for semantic errors: a model that invented an order ID once often invents another, as the last case shows. Bound the attempts (one repair is usually enough) and count repair rates in monitoring.

## Provider-native structured outputs

Current provider APIs can constrain generation to a JSON schema, so that the returned text always parses and matches the schema's structure. Implementations use **constrained decoding**: at each step, tokens that would violate the schema are excluded from sampling.

```python
# Anthropic Messages API with a Pydantic model (run on your own machine)
import os
import anthropic

client = anthropic.Anthropic()
response = client.messages.parse(
    model=os.environ["LLM_MODEL"],
    max_tokens=500,
    system="Classify the customer message for the support team.",
    messages=[{"role": "user", "content": "Hi, I want to return my order A-1042."}],
    output_format=TicketTriage,                    # the Pydantic model defined above
)
if response.stop_reason in ("refusal", "max_tokens"):
    print("no usable output:", response.stop_reason)   # fall back; output may not match the schema
else:
    print(response.parsed_output)
```

```python
# OpenAI Responses API with a Pydantic model (run on your own machine)
import os
from openai import OpenAI

client = OpenAI()
response = client.responses.parse(
    model=os.environ["LLM_MODEL"],
    input=[
        {"role": "system", "content": "Classify the customer message for the support team."},
        {"role": "user", "content": "Hi, I want to return my order A-1042."},
    ],
    text_format=TicketTriage,
)
print(response.output_parsed)                      # None when the model refused; check the refusal item
```

Without the SDK helpers the schema is sent in the request body: in the Anthropic API under `output_config.format` with `"type": "json_schema"`, and in the OpenAI Responses API under `text.format` with `"type": "json_schema"` and `"strict": true`. Strict modes require every property to be listed in `required` (optional values are expressed as nullable types) and `additionalProperties: false`.

### What native structured outputs guarantee, and what they do not

| Guaranteed (when generation completes normally) | Not guaranteed |
|---|---|
| The output parses as JSON | That the values are correct |
| The structure matches the schema: field names, types, required fields | Semantic rules: an order ID that exists in the input, citations that were retrieved |
| Enum values come from the list | Consistent enum casing with every provider (one provider documents that capitalization may change, so compare case-insensitively) |
| | Constraints the provider does not support: some providers reject or ignore keywords such as numeric ranges or string lengths, so they must be validated in code |
| | A complete object when generation stops at the token limit |
| | A schema-conforming object when the model refuses |

So native structured output removes most parse failures, which is valuable, but the validation pipeline above stays: the semantic checks, the length and range checks the provider cannot enforce, the refusal and truncation handling, and the fallback.

A further consideration for evaluation: research has reported that strict format constraints can reduce reasoning quality on some tasks compared with free-form answers. If you switch an existing feature to constrained output, run the full quality evaluation, not only a parse-rate check.

### Tool calling as structured output

Before native structured outputs existed, the standard technique was to define a tool whose input schema is the desired output and force the model to call it. It still works with every provider that supports tool calling, and the same validation rules apply to tool arguments ([Evaluating agents and tool use](/learn/llm?topic=agent-testing)).

## Truncated and malformed output

Two different failures look alike at first: the JSON does not parse. They need different handling.

- **Truncated output** happens when generation hits the maximum output length. The stop reason says `max_tokens` (or `length`), and the parse error is at the end of the text. The fix is a larger limit or a smaller requested output, not a repair prompt.
- **Malformed output** is complete but invalid: trailing commas, single quotes, unescaped characters, comments. It goes to the repair step (or does not occur with native structured output).

```python
import json

complete = '{"category": "returns", "priority": 2, "summary": "Return request"}'
truncated = complete[:48]          # what arrives when generation stops at max_tokens


def diagnose(raw: str, stop_reason: str) -> str:
    try:
        json.loads(raw)
        return "valid JSON"
    except json.JSONDecodeError as error:
        near_end = error.pos >= len(raw.rstrip()) - 1
        if stop_reason == "max_tokens" or near_end:
            return f"truncated output ({error.msg} at position {error.pos}): retry with a larger max_tokens"
        return f"malformed output ({error.msg} at position {error.pos}): send to the repair step"


print(diagnose(complete, "end"))
print(diagnose(truncated, "max_tokens"))
print(diagnose('{"category": "returns", "priority": 2,}', "end"))
```

Output:

```text
valid JSON
truncated output (Expecting ':' delimiter at position 48): retry with a larger max_tokens
malformed output (Illegal trailing comma before end of object at position 37): send to the repair step
```

With **streaming**, JSON is incomplete until the last event. Validate only the assembled object. If the UI needs a live preview, use a parser designed for partial JSON and treat the preview as untrusted until final validation succeeds.

## Test cases every structured output needs

Use the schema as a checklist. For the triage object:

| Group | Test cases |
|---|---|
| Valid outputs | A typical object; each enum value at least once; `order_id` both null and present |
| Boundaries | `priority` 1 and 4 (valid), 0 and 5 (invalid); `summary` of 280 characters (valid) and 281 (invalid); empty summary |
| Types | `"priority": "2"` (string), `"needs_human": "false"` (string), `"priority": true` (boolean is not an integer in the contract), `2.0` |
| Structure | Missing each required field; one extra field; array instead of object; nested object where a string is expected |
| Encoding and syntax | Prose before and after the JSON; Markdown fence; trailing comma; single quotes; unescaped quote inside a string; Ukrainian text and emoji in strings |
| Truncation | Output cut at several points, with stop reason `max_tokens` |
| Semantics | `order_id` not present in the message; language not matching the message; category inconsistent with explicit keywords in the message |
| Model behaviour | Refusal; empty response; repeated invalid output leading to fallback |
| Operational | Each repair, fallback and refusal is logged and counted |

Two kinds of tests cover this table:

- **Unit tests of the pipeline** with recorded or synthetic raw outputs (as in the example above). They run on every commit, need no model, and should cover every row.
- **Evaluation of the model's outputs** on a labelled dataset, measuring the schema validity rate, repair rate, fallback rate and the accuracy of each field.

Property-based testing is a strong addition for the pipeline: generate many valid objects from the schema and check that the validator accepts all of them, then mutate them and check that it rejects the mutations (run on your own machine):

```python
# pip install hypothesis hypothesis-jsonschema
from hypothesis import given
from hypothesis_jsonschema import from_schema

SCHEMA = TicketTriage.model_json_schema()


@given(from_schema(SCHEMA))
def test_every_schema_valid_object_is_accepted_by_the_pipeline(obj):
    obj["language"] = "en"                       # keep the semantic language rule satisfied
    obj["order_id"] = None                       # and the order-ID rule
    data, errors = parse_and_validate(json.dumps(obj), message="Hello")
    assert errors == []
```

### Measuring field-level accuracy

A valid object can still be wrong. On a labelled evaluation set, measure accuracy per field, exact-record accuracy and the errors that matter most to the business:

```python
from collections import Counter

# (expected labels from a human, prediction from the model) for six evaluation cases
results = [
    ({"category": "returns", "priority": 2, "needs_human": False, "order_id": "A-1042"},
     {"category": "returns", "priority": 2, "needs_human": False, "order_id": "A-1042"}),
    ({"category": "billing", "priority": 3, "needs_human": True, "order_id": None},
     {"category": "billing", "priority": 2, "needs_human": True, "order_id": None}),
    ({"category": "technical", "priority": 1, "needs_human": False, "order_id": None},
     {"category": "account", "priority": 1, "needs_human": False, "order_id": None}),
    ({"category": "returns", "priority": 3, "needs_human": True, "order_id": "A-2001"},
     {"category": "returns", "priority": 3, "needs_human": False, "order_id": "A-2001"}),
    ({"category": "account", "priority": 2, "needs_human": False, "order_id": None},
     {"category": "account", "priority": 2, "needs_human": False, "order_id": None}),
    ({"category": "billing", "priority": 4, "needs_human": True, "order_id": "A-3310"},
     {"category": "returns", "priority": 4, "needs_human": True, "order_id": "A-3310"}),
]

fields = ["category", "priority", "needs_human", "order_id"]
for field in fields:
    correct = sum(expected[field] == predicted[field] for expected, predicted in results)
    print(f"{field:<12} accuracy {correct}/{len(results)} = {correct / len(results):.0%}")

exact = sum(expected == predicted for expected, predicted in results)
print(f"whole record exactly right: {exact}/{len(results)}")

confusion = Counter((expected["category"], predicted["category"]) for expected, predicted in results)
print("category errors (expected -> predicted):",
      {f"{pair[0]} -> {pair[1]}": count for pair, count in confusion.items() if pair[0] != pair[1]})

# The costly error for the business: a case that needed a human but was not escalated
missed_escalations = sum(expected["needs_human"] and not predicted["needs_human"] for expected, predicted in results)
print(f"missed escalations: {missed_escalations}")
```

Output:

```text
category     accuracy 4/6 = 67%
priority     accuracy 5/6 = 83%
needs_human  accuracy 5/6 = 83%
order_id     accuracy 6/6 = 100%
whole record exactly right: 2/6
category errors (expected -> predicted): {'technical -> account': 1, 'billing -> returns': 1}
missed escalations: 1
```

Report all three views. Field accuracies look reasonable here, but only a third of the records are entirely correct, and the single missed escalation may matter more than every other error combined. Acceptance criteria for structured outputs should name the costly error explicitly, for example "no more than 1% missed escalations".

Fixing one costly error often creates another. If the model is changed so that it always sets `needs_human` to true for priority 3 and 4, the missed escalation above disappears, but cases with priority 3 or 4 that did not need a human are now escalated unnecessarily. Measure the false escalation rate (the manual workload) next to the missed escalation rate, and agree the acceptable trade-off with the business before changing the rule.

## Example project

The method of this chapter is implemented and tested in [examples/llm-testing/06-structured-output](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/06-structured-output): the Pydantic contract, the full validation pipeline run against 19 recorded raw outputs, property tests generated from the JSON Schema, a field-level accuracy report and an optional live check of native structured output. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/06-structured-output
```

## Common mistakes

- **Parsing with regular expressions** instead of asking for structure.
- **Trusting native structured output for correctness**, skipping semantic validation and the checks the provider does not enforce.
- **Treating truncation as a malformed response** and sending it to a repair prompt.
- **Unbounded repair loops** that multiply cost and latency.
- **Unsafe fallbacks** that guess a confident value instead of escalating.
- **Forgetting that `bool` is an `int` in Python**, so `True` passes an integer check.
- **Reporting only the schema validity rate**, which says nothing about whether the values are right.

## Summary

- When code consumes model output, the output needs a contract: a minimal, bounded, versioned schema with enums for logic and an explicit way to say "unknown".
- Validate every response with the pipeline: extract, parse, normalize harmless drift, validate the schema, validate semantics, repair a bounded number of times, and fall back safely and visibly.
- Provider-native structured outputs remove most parse failures but not semantic errors, unsupported constraints, truncation or refusals.
- Distinguish truncated output (raise the limit) from malformed output (repair).
- Test every branch of the pipeline with recorded outputs, fuzz it with property-based tests, and evaluate the model with field-level accuracy and business-critical error rates.
