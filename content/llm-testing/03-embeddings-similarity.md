# Embeddings and semantic similarity

An **embedding** is a list of numbers that represents the meaning of a piece of text. Embeddings are everywhere in LLM systems: retrieval in RAG pipelines, semantic caches, topic guardrails, deduplication, clustering and similarity-based test assertions. A tester meets them twice: as a component of the system under test, and as a tool for building tests. Both roles require the same understanding of what similarity scores mean and, more importantly, what they do not mean.

**After this chapter you can:**

- explain what an embedding is and how embedding models are trained;
- compute dot product, cosine similarity and Euclidean distance, and explain how normalization relates them;
- show why semantic similarity is not equivalence, with concrete failure cases;
- calibrate a similarity threshold on labelled pairs and report its precision and recall;
- explain exact and approximate nearest-neighbour search and measure the recall of an approximate index;
- use embeddings for test engineering: deduplication, failure clustering and coverage analysis.

**Prerequisites:** [How LLMs generate text](/learn/llm?topic=llm-foundations).

## What an embedding is

An **embedding model** is a function that maps a text to a vector of fixed length `d`, typically between 256 and 3,072 numbers. It is trained so that texts with similar meaning are mapped to vectors that point in similar directions. The usual training method is **contrastive learning**: the model sees pairs of texts that belong together (a question and its answer, a sentence and its paraphrase) and pairs that do not, and it is optimized to pull the first kind together and push the second kind apart.

Embedding models are separate from chat models. They have their own API endpoints or libraries, their own versions, their own maximum input length and their own language coverage. Given the same input and the same model version they return the same vector (up to tiny floating-point differences), which makes them much easier to test than generators.

```diagram
"Can I return worn shoes?"          ──► embedding model ──► [0.021, -0.113, 0.087, … ]  (d numbers)
"Is it possible to send shoes back?" ──► embedding model ──► [0.019, -0.098, 0.091, … ]
                                                               ▲ similar direction = similar meaning
"What is your delivery time?"       ──► embedding model ──► [-0.140, 0.052, 0.006, … ]
```

The individual numbers have no human meaning. Only relationships between vectors, measured by a similarity function, are meaningful, and only for vectors produced by the **same model version**.

## Measuring similarity

Three measures are common:

```text
dot product:         a · b = Σ a_i b_i
length (norm):       |a| = sqrt(a · a)
cosine similarity:   cos(a, b) = (a · b) / (|a| |b|)          range −1 … 1; 1 = same direction
Euclidean distance:  dist(a, b) = sqrt(Σ (a_i − b_i)²)

for unit-length vectors (|a| = |b| = 1):
    cos(a, b) = a · b
    dist(a, b)² = 2 − 2 cos(a, b)        so ranking by distance equals ranking by cosine
```

Many embedding APIs return vectors that are already normalized to length 1. Then dot product, cosine and Euclidean distance give the same ranking, and vector databases can use the fastest one. If vectors are **not** normalized, a dot product mixes direction with length and can rank a long, loosely related vector above a short, closely related one. The script implements the formulas and checks the identities.

```python
import math


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def norm(a: list[float]) -> float:
    return math.sqrt(dot(a, a))


def cosine(a: list[float], b: list[float]) -> float:
    return dot(a, b) / (norm(a) * norm(b))


def euclidean(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def normalize(a: list[float]) -> list[float]:
    length = norm(a)
    return [x / length for x in a]


a = [0.20, 0.71, 0.05, 0.40]
b = [0.25, 0.60, 0.10, 0.52]
c = [0.90, -0.10, 0.30, 0.05]

print(f"cosine(a, b) = {cosine(a, b):.3f}   cosine(a, c) = {cosine(a, c):.3f}")
print(f"dot(a, b) = {dot(a, b):.3f}   (not comparable across vectors of different length)")

ua, ub = normalize(a), normalize(b)
print(f"after normalization: dot = {dot(ua, ub):.3f}, equal to cosine")
distance = euclidean(ua, ub)
print(f"euclidean distance of unit vectors = {distance:.3f}; sqrt(2 - 2*cos) = {math.sqrt(2 - 2 * cosine(a, b)):.3f}")
```

Output:

```text
cosine(a, b) = 0.978   cosine(a, c) = 0.179
dot(a, b) = 0.689   (not comparable across vectors of different length)
after normalization: dot = 0.978, equal to cosine
euclidean distance of unit vectors = 0.211; sqrt(2 - 2*cos) = 0.211
```

### How to read similarity values

Cosine similarity is defined from −1 to 1, but real embedding models use only part of that range. For many models, unrelated texts still score well above 0, and the scores of paraphrases and of merely topical neighbours overlap. The scale is **model-specific**: a threshold of 0.8 can be strict for one model and loose for another. Never copy a threshold from an article or from a different model; calibrate it (see below).

## Similarity is not equivalence

Embeddings capture topic and phrasing much better than they capture logic. Two sentences about the same subject can have very high similarity while saying opposite things. The script below uses the simplest possible embedding, a bag-of-words count vector, to make the mechanism visible. Learned embedding models are far better at synonyms, but they show the same weaknesses on negation, numbers and roles to a smaller, still important degree.

```python
import math
import re
from collections import Counter


def bag_of_words(text: str) -> Counter:
    return Counter(re.findall(r"[a-z0-9]+", text.lower()))


def cosine(a: Counter, b: Counter) -> float:
    shared = sum(a[word] * b[word] for word in a)
    return shared / (math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values())))


pairs = [
    ("The refund was approved.", "The refund was not approved."),
    ("Returns are accepted within 30 days.", "Returns are accepted within 60 days."),
    ("Ship the order from Kyiv to Lviv.", "Ship the order from Lviv to Kyiv."),
    ("Can I send the shoes back?", "Is it possible to return the shoes?"),
]
for left, right in pairs:
    score = cosine(bag_of_words(left), bag_of_words(right))
    print(f"{score:.2f}  {left!r} vs {right!r}")
```

Output:

```text
0.89  'The refund was approved.' vs 'The refund was not approved.'
0.83  'Returns are accepted within 30 days.' vs 'Returns are accepted within 60 days.'
1.00  'Ship the order from Kyiv to Lviv.' vs 'Ship the order from Lviv to Kyiv.'
0.31  'Can I send the shoes back?' vs 'Is it possible to return the shoes?'
```

The first three pairs mean different things and score high; the last pair means the same thing and scores low. A learned model fixes the last case (it knows that "send back" and "return" are related) but keeps scoring the first three pairs as close, because they share topic, vocabulary and structure.

| Failure class | Example pair | Why similarity misleads | Better oracle |
|---|---|---|---|
| Negation | "approved" vs "not approved" | One short word flips the meaning | Fact or claim check, judge |
| Numbers and units | "30 days" vs "60 days" | Numbers carry little weight in the vector | Extract the number and compare exactly |
| Roles and order | "Kyiv to Lviv" vs "Lviv to Kyiv" | Same words, different relation | Structured extraction, judge |
| Scope and quantifiers | "all items" vs "some items" | Quantifiers are small tokens | Rubric that names the quantifier |
| Entity swaps | "order A-1042" vs "order A-1024" | IDs look alike | Exact match on IDs |

**Consequence for testing:** a similarity score can tell you that an answer is *about the right thing*. It cannot tell you that the answer is *right*. Use similarity for retrieval, clustering and as a cheap first filter; use fact checks, structured extraction or validated judges for correctness ([Code-based scorers and metrics](/learn/llm?topic=code-based-scorers)).

## Calibrating a similarity threshold

When a system or a test uses a similarity threshold, for example "treat the answer as matching the reference if cosine ≥ t" or "serve a cached answer if the new question is within t of a cached one", the threshold is a binary classifier and must be calibrated like one:

```diagram
1. Collect pairs from the real domain (hundreds, not dozens), including hard negatives:
   same topic, different meaning.
2. Have humans label each pair: equivalent (1) or not (0).
3. Compute the similarity of every pair with the exact model version you will use.
4. Sweep thresholds; at each one compute precision, recall, F1 and false-positive rate.
5. Choose the threshold from the cost of errors, not from the prettiest metric.
6. Confirm the choice on a separate held-out set of labelled pairs.
```

The script sweeps thresholds over a small labelled set. The scores are example data in a realistic range.

```python
# Labelled pairs: (similarity from your embedding model, 1 if a human judged the pair equivalent, else 0).
# In a real calibration you would have a few hundred pairs; 24 keep the example readable.
labelled = [
    (0.95, 1), (0.93, 1), (0.92, 1), (0.91, 1), (0.90, 1), (0.89, 1), (0.88, 1), (0.87, 1),
    (0.86, 1), (0.84, 1), (0.82, 1), (0.79, 1),
    (0.89, 0), (0.86, 0), (0.85, 0), (0.83, 0), (0.81, 0), (0.80, 0), (0.78, 0), (0.75, 0),
    (0.72, 0), (0.68, 0), (0.64, 0), (0.58, 0),
]


def confusion(threshold: float) -> tuple[int, int, int, int]:
    tp = sum(1 for score, label in labelled if score >= threshold and label == 1)
    fp = sum(1 for score, label in labelled if score >= threshold and label == 0)
    fn = sum(1 for score, label in labelled if score < threshold and label == 1)
    tn = sum(1 for score, label in labelled if score < threshold and label == 0)
    return tp, fp, fn, tn


print("threshold  precision  recall   F1    false-positive rate")
best = None
for step in range(15):
    threshold = round(0.76 + step * 0.01, 2)
    tp, fp, fn, tn = confusion(threshold)
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    fpr = fp / (fp + tn)
    print(f"  {threshold:.2f}      {precision:.2f}      {recall:.2f}   {f1:.2f}        {fpr:.2f}")
    better = best is None or recall > best[1]
    if precision >= 0.9 and better:
        best = (threshold, recall)

print(f"lowest threshold with precision >= 0.90: {best[0]:.2f} (recall {best[1]:.2f})")
```

Output:

```text
threshold  precision  recall   F1    false-positive rate
  0.76      0.63      1.00   0.77        0.58
  0.77      0.63      1.00   0.77        0.58
  0.78      0.63      1.00   0.77        0.58
  0.79      0.67      1.00   0.80        0.50
  0.80      0.65      0.92   0.76        0.50
  0.81      0.69      0.92   0.79        0.42
  0.82      0.73      0.92   0.81        0.33
  0.83      0.71      0.83   0.77        0.33
  0.84      0.77      0.83   0.80        0.25
  0.85      0.75      0.75   0.75        0.25
  0.86      0.82      0.75   0.78        0.17
  0.87      0.89      0.67   0.76        0.08
  0.88      0.88      0.58   0.70        0.08
  0.89      0.86      0.50   0.63        0.08
  0.90      1.00      0.42   0.59        0.00
lowest threshold with precision >= 0.90: 0.90 (recall 0.42)
```

How to interpret this table:

- **Overlap is the norm.** Equivalent and non-equivalent pairs share the range 0.78–0.89. No threshold separates them perfectly; every choice trades false positives against false negatives.
- **The right threshold depends on the cost of each error.** For a semantic cache, a false positive serves the wrong answer to a user ("cancel my order" answered with the cached reply to "don't cancel my order"), so high precision matters most, even at the price of fewer cache hits. For a test assertion that only pre-filters answers for a judge, recall matters more.
- **Small samples mislead.** With 24 pairs, one pair moves precision by several points. Use hundreds of pairs and report the uncertainty ([Statistics for evaluation](/learn/llm?topic=eval-statistics)).

## Vector search

To retrieve the documents most similar to a query, a system compares the query vector with stored vectors.

- **Exact k-nearest-neighbour (kNN) search** compares the query with every stored vector. It is always correct but its cost grows linearly with the number of vectors.
- **Approximate nearest-neighbour (ANN) search** uses an index to look at only part of the collection. Common index types are graph-based (HNSW) and cluster-based (IVF, "inverted file"). ANN is much faster and occasionally misses true nearest neighbours.

ANN quality is measured as **recall@k against exact search**: for a sample of queries, the share of the true top-k results that the index also returns. Index parameters trade recall for speed: for IVF, `nprobe` is the number of clusters searched; for HNSW, `ef_search` is the size of the candidate list. The simulation below builds a simple IVF index over random unit vectors and measures recall at several `nprobe` values.

```python
import math
import random

rng = random.Random(3)
DIM, N_DOCS, N_LISTS, K = 16, 800, 16, 10


def unit(vector: list[float]) -> list[float]:
    length = math.sqrt(sum(x * x for x in vector))
    return [x / length for x in vector]


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


docs = [unit([rng.gauss(0, 1) for _ in range(DIM)]) for _ in range(N_DOCS)]
queries = [unit([rng.gauss(0, 1) for _ in range(DIM)]) for _ in range(20)]

# Build an IVF-style index: pick list centroids and assign every document to its nearest centroid.
centroids = rng.sample(docs, N_LISTS)
lists = {i: [] for i in range(N_LISTS)}
for doc_id, doc in enumerate(docs):
    nearest = max(range(N_LISTS), key=lambda c: dot(doc, centroids[c]))
    lists[nearest].append(doc_id)


def exact_top_k(query: list[float]) -> list[int]:
    return sorted(range(N_DOCS), key=lambda d: dot(query, docs[d]), reverse=True)[:K]


def ivf_top_k(query: list[float], nprobe: int) -> tuple[list[int], int]:
    probe = sorted(range(N_LISTS), key=lambda c: dot(query, centroids[c]), reverse=True)[:nprobe]
    candidates = [doc_id for c in probe for doc_id in lists[c]]
    best = sorted(candidates, key=lambda d: dot(query, docs[d]), reverse=True)[:K]
    return best, len(candidates)


truth = [set(exact_top_k(q)) for q in queries]
print("nprobe  scanned  recall@10")
for nprobe in [1, 2, 4, 8, 16]:
    recalls, scanned = [], []
    for query, expected in zip(queries, truth):
        found, count = ivf_top_k(query, nprobe)
        recalls.append(len(expected & set(found)) / K)
        scanned.append(count)
    print(f"{nprobe:>6}  {sum(scanned) / len(scanned) / N_DOCS:>6.0%}   {sum(recalls) / len(recalls):.2f}")
```

Output:

```text
nprobe  scanned  recall@10
     1      6%   0.24
     2     13%   0.45
     4     26%   0.63
     8     51%   0.90
    16    100%   1.00
```

Random vectors have no cluster structure, so this is close to a worst case; real embeddings cluster by topic and usually reach high recall while scanning a smaller fraction. The lesson is the method, not the numbers: **measure index recall on your own data**, because a misconfigured index silently removes relevant documents before the language model ever sees them.

Other vector-store behaviours to test:

- **Metadata filters.** Production queries usually filter by tenant, language, product or permission. Test that filters are applied *before* results are returned (a user must never receive another tenant's document), and that filtering does not collapse recall when few documents match.
- **Freshness.** After a document is updated or deleted, the old vector must disappear. Test the update and delete paths, not only inserts.
- **Model consistency.** Query and document vectors must come from the same embedding model version. Store the model name and version with the index and fail loudly on a mismatch.

## Using embeddings in test engineering

Embeddings are also a practical tool for testers:

| Task | How embeddings help | Caution |
|---|---|---|
| Deduplicating an evaluation dataset | Cases with very high similarity (for example above a calibrated 0.95) are probably duplicates; review and merge | Near-duplicates can differ in one critical detail; review before deleting |
| Clustering failures for error analysis | Embed failing outputs or inputs and cluster them to see failure groups | Clusters reflect topic, not cause; name them after reading examples |
| Coverage analysis | Embed production queries and evaluation cases; production clusters without nearby cases are coverage gaps | Requires access to (anonymized) production data |
| Semantic cache testing | Generate pairs of near-identical questions with different meaning and check the cache does not answer one with the other | False hits are user-visible defects |
| Input drift detection | Compare the distribution of today's queries with last month's | Use with care; see [Observability and online evaluation](/learn/llm?topic=production-quality) |

A coverage check with a real embedding model takes only a few lines. Run it on your own machine:

```python
# pip install sentence-transformers
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")   # supports English and Ukrainian

eval_cases = ["Can I return worn shoes?", "How long does delivery take?", "Do you ship to Poland?"]
production_queries = ["чи можна повернути взуття після 40 днів", "my parcel is late", "do you have vegan sneakers?"]

case_vectors = model.encode(eval_cases, normalize_embeddings=True)
query_vectors = model.encode(production_queries, normalize_embeddings=True)
similarity = query_vectors @ case_vectors.T                   # cosine, because vectors are normalized

for query, row in zip(production_queries, similarity):
    nearest = row.argmax()
    flag = "COVERED" if row[nearest] >= 0.6 else "GAP"      # calibrate this threshold on labelled pairs
    print(f"{flag:<8} {row[nearest]:.2f}  {query!r} -> nearest case {eval_cases[nearest]!r}")
```

## Choosing and testing an embedding model

Public leaderboards such as MTEB compare embedding models across many tasks and languages and are a good starting point. They do not replace testing on your own data, because retrieval quality depends heavily on domain vocabulary, document style and language mix. Evaluate candidates with the retrieval metrics from [Evaluating RAG systems](/learn/llm?topic=rag-testing) on labelled queries from your domain, and also compare:

- **maximum input length:** text beyond it is truncated, often silently, so long chunks lose their end;
- **languages:** check every language your users write in, and cross-language retrieval if users ask in one language about documents in another;
- **dimensions, latency and cost:** larger vectors cost more storage and search time;
- **versioning:** switching models means re-embedding the whole corpus, because vectors from different models are not comparable.

A typical API call looks like this (OpenAI Python SDK; other providers are similar):

```python
from openai import OpenAI

client = OpenAI()                                  # reads OPENAI_API_KEY from the environment
response = client.embeddings.create(
    model="text-embedding-3-small",                # record the exact model name with the index
    input=["Can I return worn shoes?", "Is it possible to send shoes back?"],
)
vectors = [item.embedding for item in response.data]
print(len(vectors), "vectors of", len(vectors[0]), "dimensions")
```

## Common mistakes

- **Reusing a similarity threshold** from another model, another domain or an article.
- **Using cosine similarity as a correctness oracle** for answers where negation, numbers or roles matter.
- **Mixing vectors from different embedding models or versions** in one index.
- **Ignoring input truncation** of long chunks by the embedding model.
- **Not measuring ANN recall** and not testing metadata filters, updates and deletes.
- **Using dot product on vectors that are not normalized** and getting a length-biased ranking.

## Exercises

1. Compute by hand the cosine similarity of `a = (1, 2, 2)` and `b = (2, 1, 2)`, and the Euclidean distance between their normalized versions. Check with code.
2. A team uses "cosine ≥ 0.85 to the reference answer" as the pass criterion for a refund assistant. Write three test answers that would pass this criterion while being wrong, and explain which oracle should replace or complement it.
3. For a semantic cache, false hits cost a support ticket each and misses cost one extra model call. Using the calibration table in this chapter, which threshold would you choose, and what would you do before shipping it?
4. Write a test plan for replacing the embedding model of a RAG system: what you measure, on which data, and what must be true before the switch.

:::details Solution to exercise 1

The dot product is 1·2 + 2·1 + 2·2 = 8, both lengths are sqrt(9) = 3, so the cosine is 8 / 9 = 0.889. For unit vectors the distance is sqrt(2 − 2 · 0.889) = 0.471.

```python
import math

a, b = [1, 2, 2], [2, 1, 2]
dot = sum(x * y for x, y in zip(a, b))
cos = dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(x * x for x in b)))
print(f"cosine = {cos:.3f}, distance of normalized vectors = {math.sqrt(2 - 2 * cos):.3f}")
```

```text
cosine = 0.889, distance of normalized vectors = 0.471
```

:::

:::details Solution to exercise 2

Answers that share topic and wording with a reference such as "You can return unworn shoes within 30 days of delivery" but are wrong: (1) "You can return unworn shoes within 60 days of delivery" (number); (2) "You cannot return unworn shoes within 30 days of delivery" (negation); (3) "You can return worn shoes within 30 days of delivery" (one changed word that changes the policy). Each is likely to score close to the reference. The criterion should be replaced or complemented by fact checks: extract the number of days and compare exactly, check the condition "unworn", and use a faithfulness judge validated on labelled examples. Similarity can remain as a cheap first filter for answers that are off-topic.

:::

:::details Solution to exercise 3

Because false hits are expensive, precision is the priority. In the table, precision first reaches 0.90 or more at threshold 0.90 (precision 1.00, recall 0.42): fewer than half of the true duplicates hit the cache, but no wrong answers are served on this sample. Before shipping: label several hundred more pairs, especially hard negatives such as "cancel / don't cancel"; compute a confidence interval for precision at the chosen threshold; add exclusion rules for questions with order IDs, amounts or negations; and monitor cache hits in production with sampled human review.

:::

:::details Solution to exercise 4

Measure retrieval quality (recall@k, MRR, nDCG) of the old and new model on the same labelled query set from your domain, in every supported language, including cross-language queries; end-to-end answer quality on the RAG evaluation set; latency and cost of embedding and search; and the effect of the new maximum input length on your chunk sizes. Re-embed the full corpus into a new index rather than mixing vectors; store the model version in the index metadata and assert at query time that query and index models match. Before switching: the new model must be at least as good on the agreed metrics with statistical confidence, no language or segment may regress beyond the tolerance, and a rollback path to the old index must exist.

:::

## Summary

- An embedding maps text to a vector; similar meaning gives similar direction. Vectors are only comparable within one model version.
- Cosine similarity, dot product and Euclidean distance are equivalent for normalized vectors. Similarity scales are model-specific.
- Similarity is not equivalence: negation, numbers, roles, quantifiers and IDs are where it fails. Use it for topic, not truth.
- Any similarity threshold is a classifier; calibrate it on labelled pairs and choose it from the cost of errors.
- Approximate vector search trades recall for speed; measure index recall, filters, freshness and model consistency.
- Embeddings are also a testing tool for deduplication, failure clustering and coverage analysis.
