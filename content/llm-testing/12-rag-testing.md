# Evaluating RAG systems

**Retrieval-augmented generation** (RAG) answers a question from documents that are retrieved at the moment the question is asked: policies, manuals, tickets, product data. It lets a model answer about private and current information without training, and it lets every answer cite its sources.

It also multiplies the places where things go wrong. A correct answer needs the right document to be ingested, split well, retrieved, ranked high enough, used by the model, and cited. A wrong answer can come from any of these steps, and an end-to-end score alone does not say which. This chapter explains how a RAG system works and how to test each stage on its own and the system as a whole.

**Prerequisites:** [Embeddings and similarity](/learn/llm?topic=embeddings-similarity), [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals), [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation).

## How a RAG system works

```diagram
Ingestion      load documents, parse formats, clean, attach metadata (source, date, owner, access)
     ↓
Chunking       split documents into passages small enough to retrieve precisely
     ↓
Indexing       embeddings in a vector index and/or a lexical (BM25) index
     ↓
Retrieval      find candidate chunks for the question: semantic, lexical or both (hybrid)
     ↓
Reranking      reorder the candidates with a stronger, slower model; keep the top few
     ↓
Context        assemble the chosen chunks, with IDs, into the prompt
     ↓
Generation     the model answers from the context and cites chunk IDs
     ↓
Validation     check citations, links, refusals and the output contract in code
```

The first three steps run offline when documents change; the rest run for every question. Each step has its own parameters (chunk size, number of candidates, reranker, prompt) and its own failure modes, which is why RAG is tested stage by stage.

## Where RAG systems fail

| Stage | Failure | Symptom | Test |
|---|---|---|---|
| Ingestion | A document is missing, truncated or parsed wrongly (tables, PDFs) | Answers miss information that exists | Document counts, parse errors, sample comparisons with the source |
| Chunking | A fact is split across two chunks, or a chunk loses its heading | The right chunk is retrieved but does not contain the answer | Invariants: no lost text, size limits, titles kept |
| Retrieval | The relevant chunk is not among the candidates | Wrong or missing answer despite good documents | Recall@k against labelled relevant chunks |
| Ranking | The relevant chunk is retrieved but ranked too low to be used | Answers depend on chunk order | MRR and nDCG@k |
| Generation | The model ignores, misreads or goes beyond the context | Unsupported claims, wrong numbers | Faithfulness of claims, with fixed known-good context |
| Citation | Citations point to chunks that do not support the claim | Users cannot verify the answer | Citation checks in code, support checks by a judge |
| Abstention | The system answers when the documents do not contain the answer | Confident invented answers | Unanswerable questions in the dataset |
| Access | A chunk from another customer or a restricted document is retrieved | A data leak | Tenant and permission filters tested with adversarial queries |

## Testing ingestion and chunking

Chunking decides what retrieval can find. A chunk that is too large dilutes its embedding and fills the context with noise; a chunk that is too small loses the context that makes it understandable. Whatever the strategy, some properties must hold for every document, and they can be tested directly:

```python
import re

POLICY = """# Returns
Unworn items with the tags attached can be returned within 30 days of delivery. Start a return at
shop.example/returns and print the prepaid label. Sale items can be returned on the same terms.
Items bought with a gift card are refunded as store credit.

# Refunds
Refunds go to the original payment method within 5 business days after the return reaches our
warehouse. Delivery costs are refunded only when the whole order is returned.

# Delivery
Standard delivery takes 3-5 business days and is free for orders over 50 EUR. Express delivery
takes 1-2 business days and costs 9 EUR. Delivery dates are estimates, not guarantees."""


def sentences(text: str) -> list[str]:
    return re.split(r"(?<=\.)\s+", " ".join(text.split()))


def chunk(document: str, max_words: int = 20, overlap: int = 1) -> list[dict]:
    """Split by section, then into chunks of whole sentences with at most max_words words.
    Neighbouring chunks share up to `overlap` sentences, and every chunk keeps its section title."""
    chunks = []
    for section in re.split(r"^# ", document, flags=re.MULTILINE)[1:]:
        title, body = section.split("\n", 1)
        parts, start = sentences(body), 0
        while start < len(parts):
            end, words = start, 0
            while end < len(parts):
                size = len(parts[end].split())
                if end > start and words + size > max_words:
                    break
                words += size
                end += 1
            chunks.append({"id": f"{title.lower()}-{len(chunks)}", "section": title, "sentences": parts[start:end]})
            if end == len(parts):
                break
            start = max(end - overlap, start + 1)
    return chunks


chunks = chunk(POLICY)
for item in chunks:
    text = " ".join(item["sentences"])
    print(f"{item['id']:<11} {len(text.split()):>2} words  {text[:58]}...")

# Invariants worth testing for every chunker and every document
body = "\n".join(line for line in POLICY.splitlines() if not line.startswith("#"))
lost = [s for s in sentences(body) if not any(s in item["sentences"] for item in chunks)]
shared = [(a["id"], b["id"], s) for a, b in zip(chunks, chunks[1:]) for s in a["sentences"] if s in b["sentences"]]
print("sentences lost:", lost)
print("largest chunk:", max(len(" ".join(item["sentences"]).split()) for item in chunks), "words")
print("shared by neighbours:", shared)
```

Output:

```text
returns-0   14 words  Unworn items with the tags attached can be returned within...
returns-1   19 words  Start a return at shop.example/returns and print the prepa...
returns-2   20 words  Sale items can be returned on the same terms. Items bought...
refunds-3   17 words  Refunds go to the original payment method within 5 busines...
refunds-4   11 words  Delivery costs are refunded only when the whole order is r...
delivery-5  14 words  Standard delivery takes 3-5 business days and is free for ...
delivery-6  16 words  Express delivery takes 1-2 business days and costs 9 EUR. ...
sentences lost: []
largest chunk: 20 words
shared by neighbours: [('returns-1', 'returns-2', 'Sale items can be returned on the same terms.')]
```

Invariants to test for every chunker: no text is lost, every chunk respects the size limit (except a single sentence longer than the limit, which must not be dropped), chunks never cross section boundaries, and every chunk carries the metadata it needs: section title, source document, date and access rights. The overlap means that a sentence on the border is available to both neighbours, at the price of some duplication in the index.

## Retrieval metrics

Retrieval is evaluated against **relevance labels**: for each question, the chunks that contain the answer. With them, ranked results become numbers:

```text
hit@k        1 if at least one relevant chunk is in the top k, else 0
recall@k     relevant chunks in the top k / all relevant chunks for the question
precision@k  relevant chunks in the top k / k
MRR          mean over questions of 1 / rank of the first relevant chunk (0 when none is found)
nDCG@k       Σ relevance / log2(rank + 1) over the top k, divided by the same sum for a perfect ranking
```

The script compares a lexical retriever with the same retriever followed by a reranker, on five labelled questions over the chunks above:

```python
import math

# For each question: the chunks that contain the answer (labels), and the top 3 chunks of two retrievers
relevant = {
    "Can I return sale items?": {"returns-1", "returns-2"},
    "When do I get my money back?": {"refunds-3"},
    "Is express delivery free?": {"delivery-6"},
    "Can I return a gift and get cash?": {"returns-2"},
    "Are delivery costs refunded?": {"refunds-4"},
}
rankings = {
    "lexical": {
        "Can I return sale items?": ["returns-0", "returns-2", "returns-1"],
        "When do I get my money back?": ["refunds-4", "returns-2", "refunds-3"],
        "Is express delivery free?": ["delivery-5", "delivery-6", "refunds-4"],
        "Can I return a gift and get cash?": ["returns-0", "refunds-3", "refunds-4"],
        "Are delivery costs refunded?": ["delivery-5", "refunds-4", "delivery-6"],
    },
    "lexical + reranker": {
        "Can I return sale items?": ["returns-2", "returns-1", "returns-0"],
        "When do I get my money back?": ["refunds-3", "refunds-4", "returns-2"],
        "Is express delivery free?": ["delivery-6", "delivery-5", "refunds-4"],
        "Can I return a gift and get cash?": ["refunds-3", "returns-0", "refunds-4"],
        "Are delivery costs refunded?": ["refunds-4", "delivery-5", "delivery-6"],
    },
}


def metrics(expected: set[str], ranked: list[str], k: int = 3) -> dict[str, float]:
    hits = [chunk in expected for chunk in ranked[:k]]
    first = next((rank for rank, hit in enumerate(hits, 1) if hit), None)
    dcg = sum(hit / math.log2(rank + 1) for rank, hit in enumerate(hits, 1))
    ideal = sum(1 / math.log2(rank + 1) for rank in range(1, min(len(expected), k) + 1))
    return {"hit@3": float(any(hits)), "recall@3": sum(hits) / len(expected), "precision@3": sum(hits) / k,
            "MRR": 1 / first if first else 0.0, "nDCG@3": dcg / ideal}


for name, ranked_by_question in rankings.items():
    per_question = [metrics(relevant[question], ranked_by_question[question]) for question in relevant]
    averages = {key: sum(m[key] for m in per_question) / len(per_question) for key in per_question[0]}
    print(f"{name:<19}" + "  ".join(f"{key} {value:.2f}" for key, value in averages.items()))
```

Output:

```text
lexical            hit@3 0.80  recall@3 0.80  precision@3 0.33  MRR 0.37  nDCG@3 0.49
lexical + reranker hit@3 0.80  recall@3 0.80  precision@3 0.33  MRR 0.80  nDCG@3 0.80
```

The reranker moves relevant chunks to the top: MRR and nDCG rise sharply. Recall does not move, because a reranker can only reorder the candidates it receives. The question about getting cash for a gift is lost before reranking: "cash" never appears in the chunk that says "store credit". Fixing that requires better retrieval: hybrid search that combines embeddings with BM25, query rewriting, or adding context to chunks before indexing. Anthropic reported that contextual retrieval, which prepends a short description of the surrounding document to every chunk, cut failed retrievals by 49%, and by 67% together with reranking.

Read the metrics in this order: **recall first** (is the answer reachable at all?), then **MRR and nDCG** (is it near the top?), and precision last (how much noise reaches the context?).

## Building retrieval labels

Relevance labels are a dataset like any other ([Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals)), with their own ways of being built:

- **Questions from real traffic,** labelled by a domain expert who searches the documents for every chunk that answers them.
- **Synthetic questions per chunk:** a model writes questions that a chunk answers, and a person reviews them. Such questions tend to reuse the chunk's own words, which favours lexical retrieval, so mix them with real questions.
- **Pooling:** to avoid labelling every chunk for every question, label the union of the top results of several different retrievers. This is the standard practice of information-retrieval evaluation campaigns.
- **Graded relevance:** "answers the question" and "related background" can carry different gains in nDCG.

Relabel when documents change: a chunk ID that no longer exists makes a perfectly good retriever look broken.

## Evaluating generation: the RAG triad

Three questions locate a failure between retrieval and generation:

| Score | Question | Low score points to | Typical fix |
|---|---|---|---|
| Context relevance | Is the retrieved context about the question? | Retrieval or chunking | Chunk size, hybrid search, reranking, query rewriting |
| Groundedness | Is every claim in the answer supported by the context? | Generation | Stricter instructions, required citations, abstention rules, another model |
| Answer relevance | Does the answer address the question? | The prompt or the understanding of the question | Instructions, clarifying questions |

Evaluate generation in isolation as well: run the generator with **known-good context**, the labelled relevant chunks, instead of the retrieved ones. If answers fail even then, the generator or the prompt is the problem; if they pass, retrieval is. The same split keeps generation tests stable while the retriever changes.

## Faithfulness and citations

Faithfulness is checked claim by claim: split the answer into claims, then decide for each one whether the context supports it. FActScore applies the same idea to long texts with atomic facts. In production systems the support decision is made by a judge validated against human labels ([LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)). The structure of the check is the same with a code-level stand-in:

```python
import re

retrieved = {
    "refunds-3": "Refunds go to the original payment method within 5 business days after the return reaches our warehouse.",
    "refunds-4": "Delivery costs are refunded only when the whole order is returned.",
}
# The answer, split into claims, each with the chunks it cites
answer = [
    ("Your refund goes to the original payment method.", ["refunds-3"]),
    ("It arrives within 5 business days after the return reaches our warehouse.", ["refunds-3"]),
    ("Delivery costs are always refunded.", ["refunds-4"]),
    ("You will also receive a 10% discount code for your next order.", []),
]
STOP = {"the", "a", "an", "is", "are", "to", "your", "you", "will", "for", "it", "our", "of", "and", "after", "within"}


def content_words(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9%]+", text.lower()) if word not in STOP}


def supported(claim: str, sources: list[str]) -> bool:
    """Code-level stand-in for a judge: every number must occur in a cited source, most content words too,
    and a claim that says always or never must not contradict an only or except in the source."""
    text = " ".join(sources).lower()
    words = content_words(claim)
    numbers_ok = all(number in text for number in re.findall(r"\d+%?", claim))
    overlap = len(words & content_words(text)) / len(words) if words else 0.0
    absolute = re.search(r"\b(always|never|all|any)\b", claim.lower()) and re.search(r"\b(only|except|unless)\b", text)
    return numbers_ok and overlap >= 0.6 and not absolute


results = []
for claim, cited in answer:
    sources = [retrieved[chunk_id] for chunk_id in cited if chunk_id in retrieved]
    results.append((claim, bool(cited), supported(claim, sources)))
    print(f"{'supported' if results[-1][2] else 'NOT supported':<14} cited={cited}  {claim}")

faithfulness = sum(ok for _, _, ok in results) / len(results)
cited_and_supported = sum(ok for _, has_citation, ok in results if has_citation) / sum(has for _, has, _ in results)
print(f"faithfulness {faithfulness:.0%} of claims; citations that support their claim {cited_and_supported:.0%}")
```

Output:

```text
supported      cited=['refunds-3']  Your refund goes to the original payment method.
supported      cited=['refunds-3']  It arrives within 5 business days after the return reaches our warehouse.
NOT supported  cited=['refunds-4']  Delivery costs are always refunded.
NOT supported  cited=[]  You will also receive a 10% discount code for your next order.
faithfulness 50% of claims; citations that support their claim 67%
```

The answer cites a real chunk for its third claim, but the chunk says the opposite ("only when the whole order is returned"); the fourth claim has no source at all. Both failure kinds are common: a citation proves that a chunk was retrieved, not that it supports the claim. Split the checks accordingly: code verifies that every cited ID exists in the retrieved set and that every claim carries a citation; a validated judge decides whether the cited text supports the claim.

## Questions without an answer

A RAG system must recognise when the documents do not contain the answer and say so, instead of filling the gap from the model's general knowledge. The dataset therefore needs unanswerable questions, and the results need a table with more than one number:

```python
from collections import Counter

# (question is answerable from the documents, the system answered instead of abstaining, the answer was correct)
results = (
    [(True, True, True)] * 70 + [(True, True, False)] * 8 + [(True, False, False)] * 7 +
    [(False, False, False)] * 9 + [(False, True, False)] * 6
)

outcomes = Counter()
for answerable, answered, correct in results:
    if answerable and answered:
        outcomes["correct answer" if correct else "wrong answer"] += 1
    elif answerable:
        outcomes["false abstention"] += 1
    elif answered:
        outcomes["answer to an unanswerable question"] += 1
    else:
        outcomes["correct abstention"] += 1

for outcome, count in outcomes.items():
    print(f"{outcome:<36} {count:>3}")

answerable = sum(a for a, _, _ in results)
unanswerable = len(results) - answerable
print(f"accuracy on answerable questions      {outcomes['correct answer'] / answerable:.0%}")
print(f"abstains when it should               {outcomes['correct abstention'] / unanswerable:.0%}")
print(f"answers only when sure (precision)    {outcomes['correct answer'] / (outcomes['correct answer'] + outcomes['wrong answer'] + outcomes['answer to an unanswerable question']):.0%}")
```

Output:

```text
correct answer                        70
wrong answer                           8
false abstention                       7
correct abstention                     9
answer to an unanswerable question     6
accuracy on answerable questions      82%
abstains when it should               60%
answers only when sure (precision)    83%
```

Six of fifteen unanswerable questions received an invented answer, which is the most damaging outcome for a support system. Tightening the abstention rule usually trades it against false abstentions on answerable questions, so track both and decide the balance with the product owner. Note that "the documents do not say" and "the answer is no" are different: a question about delivery to Antarctica is unanswerable only if no policy mentions it.

## Robustness tests

Metamorphic tests ([LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)) catch RAG failures that labelled datasets miss:

- **Order of chunks:** shuffle the retrieved chunks in the context; the answer must not change. Models use information at the start and the end of a long context better than in the middle, so order effects are real.
- **Distractors:** add a relevant-looking but wrong chunk, for example an outdated policy; the answer must follow the current one or point out the conflict.
- **Paraphrased questions:** the same question in other words, in another language, with typos; retrieval must find the same chunks.
- **Stale and conflicting documents:** two versions of a policy; the system must prefer the newer one by metadata, not by luck.
- **Access control:** questions designed to retrieve another customer's tickets or an internal document must return nothing from them. Filters by tenant and permission belong in the retrieval query itself, not in the prompt.

## Metric libraries

Ragas, ARES and TruLens provide ready-made RAG metrics such as context precision and recall, faithfulness and answer relevance. Most of them use a model as a judge, so they inherit everything from the previous chapter: they need validation against your labels before their numbers mean anything, and their versions must be pinned. Deterministic retrieval metrics against relevance labels need no model at all; compute them yourself where you can, and use library metrics for the parts that require reading.

## Changing a RAG system safely

Every parameter changes behaviour: chunk size, overlap, embedding model, number of candidates, reranker, prompt. Treat changes as experiments:

- **Change one thing at a time** and compare against the baseline on the same questions ([Statistics for evaluation](/learn/llm?topic=eval-statistics)).
- **Measure retrieval and end-to-end results separately,** so that a retrieval gain is not hidden by a generation loss.
- **Version the index** together with the chunker, the embedding model and the document snapshot; a new embedding model means re-embedding everything, and queries embedded with the old model must never search the new index.
- **Watch cost and latency:** more candidates and a reranker improve quality and cost time on every question.

## Case study: the RAG behind this site

The Learning Path Advisor of GimmeJob retrieves from one canonical RAG pipeline that runs in a Cloudflare Worker, and it applies several practices of this chapter:

- **Sections are the retrieval units.** Every published `##` section of the learning material, including this chapter, becomes its own document with a deep link, so retrieval can point to the narrowest useful passage.
- **A degradation path.** Vector search provides semantic candidates; a lexical ranker in the same pipeline takes over when the vector index is unavailable.
- **Deterministic retrieval metrics.** The AI service implements precision@k, recall@k, hit rate@k, reciprocal rank and nDCG@k with unit tests (`ai-service/src/gimmejob_ai/rag_metrics.py`).
- **Runtime quality scores.** Traces record scores such as the top retrieval score, the share of grounded items and the validity of cited sources.
- **Links are validated by shape.** Consumers check that a cited path is a canonical learning route instead of trusting model output.

## Example project

The methods of this chapter are implemented and tested in [examples/llm-testing/12-rag-testing](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/12-rag-testing): a chunker with property-based invariant tests, a BM25 retriever written out step by step, retrieval metrics against labelled questions, a small RAG pipeline with a fake generator, claim-level faithfulness and citation checks, abstention metrics, and metamorphic tests for chunk order, distractors, paraphrases and tenant isolation. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/12-rag-testing
```

## Common mistakes

- **Only end-to-end scores,** which cannot say whether retrieval or generation failed.
- **Improving ranking when recall is the problem:** a reranker cannot rank what was never retrieved.
- **Synthetic questions only,** which reuse the words of the chunks and flatter lexical retrieval.
- **Trusting citations** without checking that the cited text supports the claim.
- **No unanswerable questions** in the dataset.
- **Relevance labels that point to chunk IDs from an older index.**
- **Access control in the prompt** instead of in the retrieval query.
- **Library metrics used without validation** against your own labels.

## Summary

- A RAG system is a pipeline: ingestion, chunking, indexing, retrieval, reranking, context, generation and validation; each stage fails in its own way and is tested on its own.
- Test chunkers with invariants: no lost text, size limits, section boundaries and metadata.
- Evaluate retrieval with relevance labels: recall@k first, then MRR and nDCG for ranking, precision for noise.
- Locate failures with the RAG triad and by running generation with known-good context.
- Check faithfulness claim by claim, verify citations in code, and judge support with a validated judge.
- Include unanswerable questions and track invented answers and false abstentions separately.
- Add metamorphic tests for order, distractors, paraphrases, stale documents and access control, and change one parameter at a time.
