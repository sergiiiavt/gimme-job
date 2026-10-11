# Generation mechanics

Chapter: [How LLMs generate text](https://gimme-job.com/learn/llm?topic=llm-foundations)

The mechanisms behind many LLM defects, implemented in plain Python and tested.

| File | Content |
|---|---|
| `bpe.py` | Byte-pair encoding: training, tokenization and detokenization |
| `sampling.py` | Softmax with temperature, greedy decoding, top-k, top-p (nucleus) filtering, sampling |
| `needle.py` | Needle-in-a-haystack case generation by length and depth, scoring and an accuracy-per-cell report |
| `test_generation_mechanics.py` | Example-based and property-based tests (Hypothesis) for all three |

Key ideas shown by the tests:

- Unseen words are assembled from known pieces; text outside the training data costs more tokens.
- For any logits and positive temperature, softmax is a probability distribution that preserves the ranking; lower temperature concentrates probability on the top token.
- Top-p keeps the smallest set of tokens whose probability reaches p; top-k keeps exactly k.
- Floating-point addition is not associative, the root cause of non-determinism at temperature 0.
- A long-context report must show accuracy per length and depth; replace the stand-in `answer` function with a real model call to test a model.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/02-generation-mechanics
```
