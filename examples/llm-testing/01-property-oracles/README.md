# Property oracles

Chapter: [Why LLM testing is different](https://gimme-job.com/learn/llm?topic=llm-testing-problem-space)

Generative output has no single expected value, so exact-match assertions do not work. A **property oracle** checks rules that every correct answer must satisfy. This project implements property oracles for the refund assistant of the fictional store Stride and documents what they can and cannot detect.

| File | Content |
|---|---|
| `refund_oracles.py` | `check_refund_answer` (return window, over-promising, length, link), `probability_all_pass`, `runs_to_reveal_failure` |
| `test_refund_oracles.py` | One test per property, the word-limit boundary, a test that documents the limitation of property oracles, and the sample-size arithmetic |

Key ideas shown by the tests:

- Each property catches one class of wrong answers cheaply and deterministically.
- An answer can pass every property and still be wrong ("30 days of purchase" vs "of delivery"); that defect needs a reference-based or model-based oracle.
- A feature that is right 90% of the time passes five manual tries 59% of the time; seeing a 1% failure at least once with 95% probability takes 299 runs.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/01-property-oracles
```
