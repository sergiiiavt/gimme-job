# Security testing

Chapter: [Security, red teaming and guardrails](https://gimme-job.com/learn/llm?topic=security-red-teaming)

The defences of an LLM application have to hold when the model has been fooled. This project replaces the model with one that obeys every injected instruction, and tests that nothing leaves the system anyway.

| File | Content |
|---|---|
| `assistant_security.py` | A model stand-in that follows instructions found in retrieved text, rendering without exfiltration channels, a tool gate driven by the customer's request, a fallback for answers that leak, and canary detection for plain, base64, reversed and spelled-out leaks |
| `output_encoding.py` | HTML encoding of model output with links kept only for https URLs on allowed hosts |
| `guardrails.py` | A keyword guardrail and a normalizing one (separators, whitespace, base64), evaluated per attack category. Command-line tool |
| `fairness.py` | Counterfactual CV pairs, a scorer stand-in with an optional hidden penalty, and an exact sign test |
| `consumption.py` | Input limits, an output cap and per-user token budgets with an injected clock |
| `data/attacks.jsonl` | Ten indirect injections in reviews and tool results, in English and Ukrainian: images, links, e-mail, encoded leaks, an unauthorized refund |
| `data/guardrail_labels.jsonl` | 23 labelled messages in eight categories, including benign messages with trigger words |

## Guardrails per category

```bash
cd examples/llm-testing/14-security-testing
uv run --project .. python guardrails.py data/guardrail_labels.jsonl
```

```text
category                  keywords  normalizing
attack: Ukrainian              0/3          2/3
attack: base64                 0/2          2/2
attack: paraphrase             0/3          2/3
attack: plain                  3/3          3/3
attack: separators             0/2          2/2
benign: Ukrainian              3/3          3/3
benign: everyday               4/4          4/4
benign: trigger words          1/3          1/3
```

Normalization closes the encoding and separator gaps, rewordings still get through, and both guardrails block customers who write "please ignore previous instructions I gave about the address".

## What the tests show

- For every attack in the corpus the model leaks the secret or asks for a harmful tool call, and still the customer never sees the secret in any form, no URL to an attacker's host survives, and no tool call is executed for a plain question. Monitoring sees each leak in the raw output.
- Rendering alone was not enough: the first version let base64, reversed and spelled-out leaks through to the customer, and the canary detector missed the spelled-out form. Both gaps were found by the corpus; leaking answers are now replaced by a fallback.
- Benign reviews, including one that says "ignore the mud on the photo", are answered normally.
- Output encoding is property-tested: for any text, no markup survives except anchors to the allowed host, and no link points anywhere else. The first version compared only the part of the authority before a colon, so `https://shop.example:1@evil.example` passed as the allowed host while browsers open `evil.example`; the whole authority must now equal an allowed host, and the property test generates such look-alike URLs.
- A hidden scoring penalty for one group of names is detected by counterfactual pairs (p < 0.001) and changes shortlist decisions; a scorer without it passes.
- Oversized inputs are refused before any model call, budgets run out per user and refill over time, and every allowed request carries the output cap.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/14-security-testing
```
