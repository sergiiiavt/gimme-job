# How LLMs generate text

To test a system well you need a working model of how it produces its output. You do not need the linear algebra of transformers, but you do need to know what a token is, how the next token is chosen, which parameters change that choice, why repeated runs differ, and how the training process shapes behaviours such as refusing, agreeing or inventing facts. Each of these mechanisms explains a family of defects you will meet in practice.

**Prerequisites:** [Why LLM testing is different](/learn/llm?topic=llm-testing-problem-space).

## Tokens and tokenization

A model never sees characters or words. A **tokenizer** first splits text into **tokens**, units taken from a fixed **vocabulary**, and maps each token to an integer ID. The model reads and writes sequences of these IDs. Modern vocabularies contain roughly 100,000 to 200,000 entries: whole common words, fragments of words, punctuation, digits and raw bytes.

Why not use words? A word vocabulary cannot represent new words, typos, names or code. Why not use characters? Sequences would become several times longer, which makes models slower and more expensive. **Subword tokenization** is the compromise: frequent strings get their own token, rare strings are assembled from smaller pieces.

### Byte-pair encoding, step by step

The most widespread subword method is **byte-pair encoding (BPE)**, introduced for neural translation by Sennrich and colleagues and used, in byte-level form, by many current models. Training works like this:

```diagram
1. Start with every word split into single characters, plus an end-of-word marker.
2. Count every pair of adjacent symbols across the corpus, weighted by word frequency.
3. Merge the most frequent pair into one new symbol and record the merge.
4. Repeat steps 2–3 until the vocabulary reaches the target size.
To tokenize new text, apply the recorded merges in the same order.
```

The script below trains a tiny BPE tokenizer on English support vocabulary and then tokenizes four words. It is a complete implementation of the algorithm, only the corpus is small.

```python
from collections import Counter

END = "</w>"


def merge_symbols(symbols: list[str], pair: tuple[str, str]) -> list[str]:
    """Replace every adjacent occurrence of `pair` with one merged symbol."""
    merged = []
    i = 0
    while i < len(symbols):
        if i < len(symbols) - 1 and symbols[i] == pair[0] and symbols[i + 1] == pair[1]:
            merged.append(symbols[i] + symbols[i + 1])
            i += 2
        else:
            merged.append(symbols[i])
            i += 1
    return merged


def train_bpe(word_counts: dict[str, int], num_merges: int) -> list[tuple[str, str]]:
    """Learn merge rules: repeatedly merge the most frequent adjacent pair of symbols."""
    words = {word: list(word) + [END] for word in word_counts}
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for word, symbols in words.items():
            for i in range(len(symbols) - 1):
                pairs[(symbols[i], symbols[i + 1])] += word_counts[word]
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        words = {word: merge_symbols(symbols, best) for word, symbols in words.items()}
    return merges


def tokenize(word: str, merges: list[tuple[str, str]]) -> list[str]:
    """Apply the learned merges, in training order, to a new word."""
    symbols = list(word) + [END]
    for pair in merges:
        symbols = merge_symbols(symbols, pair)
    return symbols


training_counts = {
    "return": 20, "returns": 12, "returned": 8, "refund": 15, "refunds": 9,
    "order": 25, "orders": 10, "ordered": 6, "delivery": 14, "delivered": 9,
    "shoes": 18, "size": 11,
}
merges = train_bpe(training_counts, num_merges=30)
print("first 8 merges:", merges[:8])
for word in ["returned", "refunded", "reorder", "повернення"]:
    tokens = tokenize(word, merges)
    print(f"{word:>12} -> {len(tokens):2d} tokens: {tokens}")
```

Output:

```text
first 8 merges: [('r', 'e'), ('d', 'e'), ('s', '</w>'), ('o', 'r'), ('or', 'de'), ('re', 't'), ('ret', 'u'), ('retu', 'r')]
    returned ->  3 tokens: ['return', 'e', 'd</w>']
    refunded ->  3 tokens: ['refun', 'de', 'd</w>']
     reorder ->  2 tokens: ['re', 'order</w>']
  повернення -> 11 tokens: ['п', 'о', 'в', 'е', 'р', 'н', 'е', 'н', 'н', 'я', '</w>']
```

Three observations carry over directly to real tokenizers:

- **Unseen words are still representable.** "reorder" never appeared in training but is built from known pieces.
- **Token boundaries do not follow meaning.** "refunded" splits as `refun` + `de` + `d`. A model that has to reason about letters inside a token cannot see them directly, which is why letter counting, reversing strings and exact character positions are unreliable tasks.
- **Text the tokenizer was not trained on costs more tokens.** The Ukrainian word falls apart into single characters because the training corpus was English. Real tokenizers are trained on multilingual data, but languages and scripts that are less frequent in that data still need noticeably more tokens per word than English.

### Why testers care about tokens

| Consequence | Why it happens | What to test |
|---|---|---|
| Cost differs by language | Prices are per token, and some languages need more tokens per word | Measure tokens per request for each supported language with real inputs |
| Limits are in tokens | Context window, maximum output and rate limits are counted in tokens | Inputs near the limit; very long documents; long conversations |
| Truncated output | Generation stops when it reaches the maximum output tokens, even mid-word or mid-JSON | The application's handling of a truncated response |
| Character-level weakness | The model sees tokens, not letters | Do not build features that depend on exact character manipulation without code |
| Hidden characters change tokens | Zero-width spaces, homoglyphs and Unicode variants tokenize differently while looking identical | Input normalization; attacks that hide instructions in invisible characters |

A rule of thumb for English text with current tokenizers is about four characters per token. Use the provider's tokenizer library or token-counting endpoint for real numbers, because rules of thumb are wrong for code, JSON and non-English text.

```python
# Run on your own machine: pip install tiktoken
import tiktoken

encoding = tiktoken.get_encoding("o200k_base")   # tokenizer used by several OpenAI models
for text in ["Can I return worn shoes?", "Чи можу я повернути ношене взуття?", '{"order_id": "A-1042"}']:
    ids = encoding.encode(text)
    print(len(text), "characters ->", len(ids), "tokens:", [encoding.decode([i]) for i in ids])
```

### Chat templates and special tokens

Chat APIs accept a list of messages with roles (system, user, assistant, tool). Before the model sees them, the provider renders the messages into one token sequence using a **chat template**: special tokens mark where each message starts and ends and which role it has. Two testing consequences follow. First, every message, tool definition and piece of retrieved text consumes context tokens. Second, user text that imitates role markers (for example a fake "system:" line) is a classic prompt-injection technique; [Security, red teaming and guardrails](/learn/llm?topic=security-red-teaming) covers it.

## The generation loop

Generation is a loop that produces one token per iteration:

```diagram
 context tokens (system prompt, conversation, documents, tool results, output so far)
        │
        ▼
 model forward pass ──► logits: one score per vocabulary entry (about 100k–200k numbers)
        │
        ▼
 softmax(logits / temperature) ──► probability distribution over the vocabulary
        │
        ▼
 filtering (top-k, top-p) ──► sampling picks one token ID
        │
        ▼
 append token to the context ──► stop? (end-of-sequence token, stop sequence, max tokens)
        │ no                                    │ yes
        └──────────── repeat ◄──────────────────┘──► return text
```

The **logits** are unnormalized scores. **Softmax** turns them into probabilities that sum to 1. The **sampler** chooses the next token from those probabilities. Nothing in this loop checks facts: a fluent false statement and a fluent true statement are produced by exactly the same mechanism. That is the root reason why hallucination is a property of the method rather than a rare bug.

### Prefill and decode

Processing has two phases with different performance characteristics:

- **Prefill.** The model processes all input tokens in parallel and builds a cache of intermediate results (the **KV cache**). Prefill time grows with the input length and determines most of the **time to first token**.
- **Decode.** The model generates output tokens one at a time, each reusing the cache. Decode time grows with the number of output tokens.

So a long prompt mainly delays the first token, and a long answer mainly delays the last one. [Production quality](/learn/llm?topic=production-quality) builds on this distinction.

## Softmax, temperature, top-k and top-p

The formulas are short:

```text
softmax:      p_i = exp(z_i / T) / Σ_j exp(z_j / T)        z = logits, T = temperature

temperature:  T < 1 sharpens the distribution (more likely tokens get even more likely)
              T = 1 leaves the model's distribution unchanged
              T > 1 flattens it (unlikely tokens get more chances)
              T → 0 approaches greedy decoding: always pick the highest logit

top-k:        keep only the k most probable tokens, renormalize, sample
top-p:        keep the smallest set of most probable tokens whose probabilities sum to at least p
              (also called nucleus sampling), renormalize, sample
```

### Worked example

After the text *"Unworn shoes can be returned within"*, suppose the model assigns these logits to five candidate tokens. Only "30" and "thirty" are correct under Stride's policy. The script computes the distributions and then samples 1,000 answers at three temperatures.

```python
import math
import random
from collections import Counter

# Next-token candidates after "Unworn shoes can be returned within" and the logits a model might assign
tokens = ["30", "thirty", "14", "60", "unlimited"]
logits = [6.0, 4.6, 3.4, 2.6, 1.2]
correct = {"30", "thirty"}


def softmax(values: list[float], temperature: float = 1.0) -> list[float]:
    scaled = [value / temperature for value in values]
    largest = max(scaled)                      # subtract the max for numerical stability
    exps = [math.exp(value - largest) for value in scaled]
    total = sum(exps)
    return [value / total for value in exps]


def top_k(probs: list[float], k: int) -> list[float]:
    keep = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)[:k]
    kept = [p if i in keep else 0.0 for i, p in enumerate(probs)]
    return [p / sum(kept) for p in kept]


def top_p(probs: list[float], p_threshold: float) -> list[float]:
    order = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)
    keep, cumulative = [], 0.0
    for i in order:
        keep.append(i)
        cumulative += probs[i]
        if cumulative >= p_threshold:          # smallest set whose mass reaches p
            break
    kept = [p if i in keep else 0.0 for i, p in enumerate(probs)]
    return [p / sum(kept) for p in kept]


def show(label: str, probs: list[float]) -> None:
    cells = "  ".join(f"{token}={prob:.3f}" for token, prob in zip(tokens, probs))
    print(f"{label:<16} {cells}")


for temperature in [0.2, 0.7, 1.0, 1.5]:
    show(f"T={temperature}", softmax(logits, temperature))
show("T=1, top_k=2", top_k(softmax(logits), 2))
show("T=1, top_p=0.95", top_p(softmax(logits), 0.95))

rng = random.Random(0)
for temperature in [0.7, 1.0, 1.5]:
    probs = softmax(logits, temperature)
    draws = Counter(rng.choices(tokens, weights=probs, k=1000))
    wrong = sum(count for token, count in draws.items() if token not in correct)
    print(f"T={temperature}: {wrong} of 1000 sampled answers state a wrong return window")
```

Output:

```text
T=0.2            30=0.999  thirty=0.001  14=0.000  60=0.000  unlimited=0.000
T=0.7            30=0.856  thirty=0.116  14=0.021  60=0.007  unlimited=0.001
T=1.0            30=0.734  thirty=0.181  14=0.055  60=0.024  unlimited=0.006
T=1.5            30=0.583  thirty=0.229  14=0.103  60=0.060  unlimited=0.024
T=1, top_k=2     30=0.802  thirty=0.198  14=0.000  60=0.000  unlimited=0.000
T=1, top_p=0.95  30=0.757  thirty=0.187  14=0.056  60=0.000  unlimited=0.000
T=0.7: 27 of 1000 sampled answers state a wrong return window
T=1.0: 95 of 1000 sampled answers state a wrong return window
T=1.5: 193 of 1000 sampled answers state a wrong return window
```

Read the result as a tester. The model "knows" the right answer in the sense that it has the highest probability, yet at temperature 1.0 almost one answer in ten is wrong. A real answer contains dozens of tokens, and each one is sampled; errors can enter at any of them. Lower temperature and truncation (top-k, top-p) remove the long tail of unlikely tokens but cannot make a wrong high-probability token right.

### Choosing and testing sampling settings

| Task type | Typical setting | Reason | Testing note |
|---|---|---|---|
| Extraction, classification, structured output | Temperature 0 or close to it | One correct answer; variety is a defect | Still run cases several times: temperature 0 is not deterministic |
| Question answering from documents | Low temperature | Stay close to the most likely, grounded answer | Measure faithfulness, not only correctness |
| Creative writing, brainstorming | Temperature around 0.7–1.0 | Variety is the point | Measure distributions (quality across many samples), not single outputs |
| Code generation with multiple attempts | Moderate temperature, several samples | Diversity raises the chance one attempt passes tests | Report pass@k, see [Statistics for evaluation](/learn/llm?topic=eval-statistics) |

Two rules apply everywhere. **Test at the production settings**, because a prompt evaluated at temperature 0 may behave differently at 0.7. And **change one sampling parameter at a time** when comparing runs. Note also that some models, especially reasoning models, fix or ignore sampling parameters; check the provider documentation before assuming a parameter has an effect.

## Why outputs vary even at temperature 0

At temperature 0 the sampler always picks the highest logit, so the output should be deterministic. In practice it often is not. The main reason is that **floating-point addition is not associative**: `(a + b) + c` can differ from `a + (b + c)` in the last bits. A logit is a sum of thousands of products, and the order of those additions depends on how the GPU kernel splits the work, which can depend on batch size (how many other requests are processed together), hardware and software versions. If two candidate tokens are nearly tied, a difference in the last bit decides which one wins, and from that token on the two outputs diverge.

```python
import random

# Floating-point addition is not associative: the order of a sum changes the result.
print((0.1 + 0.2) + 0.3 == 0.1 + (0.2 + 0.3))
print(f"{(0.1 + 0.2) + 0.3:.17f} vs {0.1 + (0.2 + 0.3):.17f}")


def chunked_sum(values: list[float], chunk: int) -> float:
    """Sum in parallel-style blocks, as a GPU reduction kernel might, then add the partial sums."""
    partials = [sum(values[i:i + chunk]) for i in range(0, len(values), chunk)]
    return sum(partials)


# A logit is a sum of many partial products. The order of additions depends on the kernel,
# which can depend on batch size or hardware. Simulate three reduction strategies.
rng = random.Random(1)
contributions = [rng.uniform(-1, 1) for _ in range(4096)]
logits_a = {
    "sequential": sum(contributions),
    "blocks of 64": chunked_sum(contributions, 64),
    "blocks of 256": chunked_sum(contributions, 256),
}
for strategy, value in logits_a.items():
    print(f"logit of token A, {strategy:<13}: {value!r}")

# Suppose a competing token B is in a near-tie: its logit equals the lowest variant above.
logit_b = min(logits_a.values())
print(f"difference between variants: {max(logits_a.values()) - logit_b:.1e}")
for strategy, value in logits_a.items():
    winner = "A" if value > logit_b else "B"
    print(f"{strategy:<13}: greedy decoding picks token {winner}")
```

Output:

```text
False
0.60000000000000009 vs 0.59999999999999998
logit of token A, sequential   : 18.783645481949275
logit of token A, blocks of 64 : 18.78364548194927
logit of token A, blocks of 256: 18.783645481949275
difference between variants: 3.6e-15
sequential   : greedy decoding picks token A
blocks of 64 : greedy decoding picks token B
blocks of 256: greedy decoding picks token A
```

A difference of a few quadrillionths changed the chosen token. Real near-ties are common: whenever two phrasings are almost equally likely, the model is effectively flipping a biased coin made of rounding errors. Research on inference engines has shown that the dependence on batch size is the dominant source of this behaviour in practice and that batch-invariant kernels can remove it, at some performance cost.

Other sources add to this: the provider may route your request to different hardware, update the serving software or the model snapshot, and some architectures route tokens through different expert sub-networks depending on the batch. A few APIs accept a `seed` parameter for best-effort reproducibility and return a fingerprint of the serving configuration; treat that as a convenience for debugging, not as a guarantee.

**Testing consequence:** design every evaluation to tolerate variation. Run important cases several times, assert on properties and rates rather than exact strings, and record the model version and parameters with every result.

### When a temperature-0 test flips

A typical symptom: an extraction test alternates between two outputs that differ in one word. Make such a test robust without hiding real defects:

- assert on the extracted values after the normalization the specification allows (case, whitespace, accepted synonyms), not on the full string;
- run the case several times and require a pass rate instead of a single pass;
- pin the model version and record the serving fingerprint when the API returns one;
- never widen an assertion until it always passes: if one of the two outputs is actually wrong, the test must keep failing on it.

## How training shapes testable behaviour

Modern chat models are produced in stages. Each stage leaves characteristic behaviours that you can and should test.

| Stage | What happens | Behaviour you can observe | Test idea |
|---|---|---|---|
| Pretraining | Next-token prediction on a very large text and code corpus | Broad knowledge, fluent language, knowledge cutoff, memorized text, biases of the data | Questions about events after the cutoff; facts that changed recently; requests for verbatim copyrighted or personal text |
| Supervised instruction tuning | Training on examples of instructions and good responses | Follows instructions and chat format | Format adherence, multi-constraint instructions, instruction priority |
| Preference tuning (RLHF, DPO and variants) | The model is optimized toward responses that human raters or reward models prefer | Helpful tone, but also sycophancy (agreeing with the user), verbosity, confident wording | Push-back tests ("Are you sure? I think it is 60 days"); length analysis |
| Safety training | Training to refuse harmful requests | Refusals, sometimes for harmless requests (over-refusal) | Borderline-but-legitimate prompts; harmful prompts; both measured |
| Your own fine-tuning | Additional training on your data (for example with LoRA adapters) | Better domain behaviour, possible loss of general skills | Re-run general capability and safety suites after fine-tuning |

Two of these deserve a closer look:

- **Sycophancy.** Models trained on human preferences learn that agreeing is often rewarded. A sycophantic model changes a correct answer when the user pushes back. Test it with two-turn cases: ask, then contradict the correct answer, and score whether the model holds its position when it was right and corrects itself when it was wrong.
- **Over-refusal.** Safety training can generalize too far, so that "How do I kill a Python process?" is refused. Test sets such as XSTest contain safe prompts that superficially resemble unsafe ones. Measure the refusal rate on both safe and unsafe prompts; a guardrail that blocks everything scores perfectly on the unsafe set and fails the product.

## Hallucination: what it is and why it happens

**Hallucination** (also called confabulation) is output that is fluent and plausible but not supported by facts or by the provided sources. Summarization research distinguishes two kinds that are useful for test design:

- **Intrinsic hallucination** contradicts the source: the policy says 30 days, the answer says 60.
- **Extrinsic hallucination** adds information that the source does not contain and that cannot be verified from it: the answer adds "and we pay return shipping", which the policy never mentions.

Why it happens: the training objective rewards plausible continuations, not verified truth, and common evaluation practice rewards guessing over saying "I don't know". A model that always guesses scores better on many benchmarks than one that abstains when unsure, so models learn to guess. A 2025 analysis of this incentive problem argues that evaluation design must reward calibrated abstention to reduce hallucination.

Test design consequences:

- Include **unanswerable questions** whose correct response is to abstain, and score abstention explicitly.
- For grounded features, check **every claim against the sources**, not only the overall answer ([Evaluating RAG systems](/learn/llm?topic=rag-testing)).
- Verify **citations, references, URLs, API names and numbers** mechanically where possible: these are the most frequent hallucinations and the easiest to check.
- Do not rely on the model's own confidence statements; wording such as "definitely" carries no reliable information about correctness.

## Context window behaviour

The **context window** is the maximum number of tokens the model can process in one call: system prompt, conversation, documents, tool definitions, tool results and the output itself. Current models offer windows from tens of thousands to a million or more tokens, but a large window is not the same as reliable use of everything in it.

Two well-documented effects matter for testing:

- **Position sensitivity.** Many models use information at the beginning and end of a long context better than information in the middle ("lost in the middle").
- **Effective vs advertised length.** Benchmarks such as RULER show that accuracy on retrieval and reasoning tasks often drops well before the advertised maximum length.

The standard probe is a **needle-in-a-haystack** test: place one fact (the needle) at a controlled depth in long filler text and ask a question that requires it. Vary length and depth, repeat each cell, and report accuracy per cell. The generator below builds such a test set. The model call is replaced by a clearly labelled simulation so that you can see the report format; replace `simulated_model` with a real call to run the test for real.

```python
import random
from collections import defaultdict

FILLER = [
    "Orders are packed in recycled boxes.",
    "Customer service is available on weekdays.",
    "Gift cards never expire.",
    "Standard delivery takes three to five working days.",
    "Shoe sizes follow the EU standard.",
    "Prices include VAT.",
]


def build_case(depth: float, total_sentences: int, rng: random.Random) -> dict:
    """Create a long context with one 'needle' fact inserted at a relative depth (0.0 = start, 1.0 = end)."""
    code = f"STR-{rng.randint(1000, 9999)}"
    needle = f"The discount code for loyal customers is {code}."
    sentences = [rng.choice(FILLER) for _ in range(total_sentences)]
    sentences.insert(round(depth * total_sentences), needle)
    return {
        "context": " ".join(sentences),
        "question": "What is the discount code for loyal customers?",
        "expected": code,
        "depth": depth,
        "length": total_sentences,
    }


def score(answer: str, expected: str) -> bool:
    return expected in answer


rng = random.Random(7)
cases = [build_case(depth, length, rng)
         for length in [200, 2000]
         for depth in [0.0, 0.25, 0.5, 0.75, 1.0]
         for _ in range(3)]                       # 3 repetitions per cell
print(f"{len(cases)} cases; example context starts: {cases[0]['context'][:90]}...")


def simulated_model(case: dict) -> str:
    """Stand-in for a real model call, only to demonstrate the report format.
    It 'loses' facts in the middle of long contexts, the pattern long-context studies report."""
    middle = 0.2 < case["depth"] < 0.8
    if case["length"] > 1000 and middle and rng.random() < 0.6:
        return "I could not find a discount code."
    return f"The code is {case['expected']}."


results = defaultdict(list)
for case in cases:
    results[(case["length"], case["depth"])].append(score(simulated_model(case), case["expected"]))

print("length  depth  accuracy")
for key in sorted(results):
    outcomes = results[key]
    print(f"{key[0]:>6}  {key[1]:>5.2f}  {sum(outcomes)}/{len(outcomes)}")
```

Output (simulated model):

```text
30 cases; example context starts: The discount code for loyal customers is STR-6305. Customer service is available on weekda...
length  depth  accuracy
   200   0.00  3/3
   200   0.25  3/3
   200   0.50  3/3
   200   0.75  3/3
   200   1.00  3/3
  2000   0.00  3/3
  2000   0.25  2/3
  2000   0.50  0/3
  2000   0.75  1/3
  2000   1.00  3/3
```

Needle tests measure retrieval of a single explicit fact, which is the easiest long-context task. Real features also need multi-fact reasoning over long inputs, so treat a passing needle test as a necessary, not a sufficient, condition. Also test what your application does **before** the limit: which messages or documents are dropped when a conversation grows, whether the system prompt survives truncation, and how the user is told that a document was too long.

### Designing a long-context test plan

For a feature that answers questions about uploaded contracts of up to 150 pages:

| Dimension | Values |
|---|---|
| Document length | 5, 50 and 150 pages, plus one document above the limit |
| Position of the relevant clause | Start, 25%, 50%, 75%, end |
| Question type | Single fact lookup; comparison of two clauses far apart; aggregation such as "list all termination conditions" |
| Repetitions | 3–5 per cell, because of output variability |
| Scoring | Deterministic checks against labelled values for facts; a validated judge or human review for multi-clause answers |
| Report | Accuracy per length and position; latency and cost per length; the behaviour above the limit |

## Reasoning models

Some models generate a hidden or summarized chain of intermediate **reasoning tokens** before the final answer. Providers expose a setting such as a reasoning effort level or a thinking-token budget. This improves performance on multi-step problems but changes the testing picture:

- **Latency and cost grow with the reasoning budget.** Reasoning tokens are usually billed as output tokens even when you do not see them. Measure latency and cost at the effort setting you will ship.
- **Evaluate at the production setting.** A prompt tuned with high effort can fail at low effort.
- **Do not treat the reasoning text as an explanation of the decision.** Studies of chain-of-thought faithfulness show that stated reasoning can omit the factors that actually drove the answer. Evaluate the final output and its effects; use visible reasoning only as a debugging hint.
- **Some sampling parameters may be fixed** for reasoning models, so the advice about temperature does not apply unchanged.

## Example project

The method of this chapter is implemented and tested in [examples/llm-testing/02-generation-mechanics](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/02-generation-mechanics): a BPE tokenizer, softmax, temperature, top-k and top-p with property-based tests, and a needle-in-a-haystack generator with a per-cell report. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/02-generation-mechanics
```

## Common mistakes

- **Assuming temperature 0 gives repeatable output** and writing exact-string assertions on it.
- **Testing at one temperature and shipping at another.**
- **Estimating tokens from characters for non-English text, code or JSON.** Use the real tokenizer.
- **Ignoring truncation:** no test for answers cut off at the maximum output length.
- **Treating a refusal as a pass.** A refusal of a legitimate request is a failure of helpfulness.
- **Trusting the model's confidence wording** or its displayed reasoning as evidence of correctness.
- **Declaring long-context support after one needle test** at one depth.

## Summary

- Models read and write tokens. Tokenization explains language-dependent cost, token limits, truncation and weakness at character-level tasks.
- Generation is a loop: logits, softmax with temperature, filtering, sampling, append. Nothing in the loop verifies facts.
- Temperature reshapes the distribution; top-k and top-p cut off its tail. Test at production settings and change one parameter at a time.
- Even temperature 0 is not deterministic, mainly because floating-point reduction order depends on batching and hardware. Assert on properties and rates.
- Training stages explain knowledge cutoffs, sycophancy, over-refusal and the incentive to guess. Each has a concrete test design.
- Long-context support must be measured by length and position, and reasoning models must be tested at the effort setting you ship.
