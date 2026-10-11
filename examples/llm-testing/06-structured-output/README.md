# Structured output

Chapter: [Structured output and validation](https://gimme-job.com/learn/llm?topic=structured-output-validation)

When code consumes model output, the output needs a contract and a pipeline that enforces it every time.

| File | Content |
|---|---|
| `triage_contract.py` | `TicketTriage` Pydantic contract (enums, bounds, nullable `order_id`, no extra fields), the safe fallback and the JSON Schema |
| `pipeline.py` | extract → parse → normalize → strict schema validation → semantic validation → bounded repair → logged fallback |
| `fixtures/raw_outputs.jsonl` | 19 recorded raw outputs: clean, wrapped in prose, casing drift, wrong types, boundaries, missing and extra fields, hallucinated order ID, wrong language, trailing comma, truncation, refusal |
| `evaluate.py` | Field-level accuracy, exact-record accuracy, category confusions, missed and unnecessary escalations. Command-line tool |
| `data/labelled_predictions.jsonl` | Six labelled predictions for the evaluation example |
| `test_structured_output.py` | Every fixture, repair and fallback behaviour, a property test generated from the JSON Schema (hypothesis-jsonschema), the evaluation report |
| `test_live_structured_output.py` | Optional: provider-native structured output, still checked by the semantic rules (`-m live`) |

```bash
cd examples/llm-testing/06-structured-output
uv run --project .. python evaluate.py data/labelled_predictions.jsonl
```

Key ideas shown by the tests:

- Strict validation rejects `"2"` and `true` where the contract requires an integer.
- Format errors are often fixed by one repair attempt; semantic errors such as an invented order ID usually are not, and end in a safe, logged fallback that escalates to a human.
- Every object the schema allows passes schema validation; semantic rules still need input from the conversation.
- A valid object can be wrong: report field accuracy, exact records and the business-critical error (missed escalations).

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/06-structured-output
```
