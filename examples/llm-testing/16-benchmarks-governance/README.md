# Benchmarks, human evaluation and governance

Chapter: [Benchmarks, human evaluation and governance](https://gimme-job.com/learn/llm?topic=pro-practice)

The professional layer of LLM testing in code:
- checking benchmarks for contamination and broken items;
- choosing a model from evaluation results;
- measuring the reliability of human labels and ranking systems from human preferences;
- error rates for speech and OCR;
- turning a risk register and test results into governance evidence.

| File | Content |
|---|---|
| `contamination.py` | 13-gram overlap with a corpus (whole-item matching for short items), canary strings, and the exact sign test that compares original and reworded items. Command-line tool |
| `item_analysis.py` | Difficulty and discrimination of every benchmark item, verdicts for useless items and probable wrong references, and the noise of a benchmark of a given size. Command-line tool |
| `pairwise_ranking.py` | Online Elo, Bradley–Terry fitted by maximum likelihood (MM algorithm, ties as half wins), bootstrap intervals, and ranks shared by systems with overlapping intervals. Command-line tool |
| `annotation_quality.py` | Krippendorff's alpha for nominal, ordinal, interval and ratio data with any number of annotators and missing labels, accuracy on gold items, and confusions between annotators |
| `model_selection.py` | Hard requirements, the Pareto front of quality, cost and latency, and a non-inferiority margin on paired quality differences. Command-line tool |
| `speech_metrics.py` | Word and character error rates with a minimum-edit alignment, normalization, and pooled rates per slice |
| `governance_evidence.py` | A risk register checked against the latest test results: gaps, failures, stale evidence, tests that cover no risk, a Markdown evidence report and a go or no-go exit status. Command-line tool |
| `make_benchmark_data.py` | Regenerates the synthetic data in `data/` with fixed seeds |
| `data/` | Results of 16 systems on a 60-item benchmark with planted problems, 600 preference votes, six candidate models on 400 shared cases, items and crawled pages for the contamination check, and the risk register of the chapter |
| `test_*.py` | Published values, hand calculations, independent implementations and simulations as oracles, and property-based tests with Hypothesis |

## Check a custom benchmark

```bash
cd examples/llm-testing/16-benchmarks-governance
uv run --project .. python item_analysis.py data/model_results.jsonl
```

```text
16 systems, 60 items, scores from 23% to 80%
item   solved discrimination  verdict
3         25%          -0.14  weak: hardly separates the models
7        100%              -  everyone solves it: no information
15        50%          -0.73  stronger models fail more often: check the reference answer
23       100%              -  everyone solves it: no information
30        44%          +0.12  weak: hardly separates the models
37        62%          +0.11  weak: hardly separates the models
41         0%              -  nobody solves it: too hard or broken
42        88%          -0.04  weak: hardly separates the models
46        31%          +0.05  weak: hardly separates the models
51        56%          +0.02  weak: hardly separates the models
52        50%          -0.60  stronger models fail more often: check the reference answer
59        94%          +0.18  weak: hardly separates the models
48 items are ok; 12 need attention
```

The data hides five problems: two trivial items (7 and 23), one impossible item (41) and two items with a wrong reference answer (15 and 52). All five are found. The two wrong keys stand out clearly. The seven weak items are a reminder that one item's correlation over 16 systems has a standard error of about 0.25: weak items deserve a second look, not automatic removal.

```bash
uv run --project .. python contamination.py data/benchmark_items.jsonl data/crawl_sample.jsonl
```

```text
cv-01      0 of  14 shared 13-grams  clean
cv-02      0 of  15 shared 13-grams  clean
cv-03      1 of  18 shared 13-grams  partly copied
cv-04     11 of  11 shared 13-grams  copied
cv-05      1 of   1 shared 13-grams  copied
cv-06      0 of   8 shared 13-grams  clean
3 item(s) overlap the corpus
```

Item cv-05 is shorter than 13 words, so it is matched as a whole. The exit status is 1 when any item overlaps the corpus.

## Rank systems from human preferences

```bash
uv run --project .. python pairwise_ranking.py data/preference_votes.jsonl
```

```text
600 votes
rank  system     Bradley-Terry    95% interval    Elo  Elo reversed
1     assist-a            1096    1059 - 1136    1019          1191
1     assist-b            1058    1023 - 1089    1029          1058
1     assist-c            1032    1000 - 1066    1094           984
4     assist-d             957     917 - 988     1007           893
5     assist-e             858     818 - 897      851           873
```

Bradley–Terry recovers the true order of the five assistants. After 600 votes, though, its intervals cannot separate the top three, so they share rank 1. Online Elo over the same votes puts assist-c first. Processing the votes in reverse order puts assist-a first, 207 points ahead of assist-c.

## Choose a model

```bash
uv run --project .. python model_selection.py data/candidates.json
```

```text
model       quality  EUR/resolved    p95  context
large-a       92.2%        0.0310   5.2s   200000
medium-b      91.2%        0.0120   3.9s   128000
medium-c      87.2%        0.0140   4.4s   128000
small-d       85.8%        0.0040   2.1s    32000
long-e        92.8%        0.0260   7.5s  1000000
tiny-f        73.8%        0.0020   1.4s    16000
long-e: fails a hard requirement
tiny-f: fails a hard requirement
medium-c: dominated
medium-b: on the Pareto front, within 3 points of large-a
small-d: on the Pareto front, but may be more than 3 points worse than large-a
choice: medium-b
```

The best score belongs to long-e, but it is too slow. The cheapest model, tiny-f, is below the quality floor. medium-c is worse than medium-b on every dimension. Three candidates remain on the Pareto front. medium-b is within the agreed 3-point margin of large-a (paired interval −2.5 to +0.5 points) at under 40% of the cost, so it wins. With a 0.5-point margin, large-a would.

## Check the evidence for a release

```bash
uv run --project .. python governance_evidence.py data/risk_register.json data/test_results.json --release 2.4.0 --date 2026-10-10 --report evidence.md
```

```text
R1 high   answers contradict the refund policy   evidence current
R2 high   one customer sees another's data       red-team-leaks fails
R3 high   CV scores differ by gender or origin   no test covers it
R4 medium slow answers at peak load              load-test tested 2.1.0; load-test is 130 days old
R5 low    answer in the wrong language           evidence current
tests that cover no risk: tone-check
release 2.4.0: no-go, high risks without current evidence: R2, R3
```

The exit status is 1 while a high-severity risk lacks current, passing evidence. `evidence.md` holds the same table for the release record.

## What the tests show

- **Krippendorff's alpha** reproduces the published values of Krippendorff (2011) for all four levels of measurement: .743 nominal, .815 ordinal, .849 interval, .797 ratio. It is about 0 for random labels, ignores units labelled by a single annotator, and does not change when nominal categories are renamed. It refuses data where every label is the same, because agreement then cannot be told apart from chance.
- **The annotators of the chapter** (alpha 0.87 for the reliable pair, 0.65 for all three) show one systematic confusion: unsafe labelled as bad, three times.
- **Fitted Bradley–Terry scores** satisfy the likelihood equations: every system's expected wins equal its observed wins. The scores do not depend on the order of votes, while Elo moves by more than 100 points when the order is reversed. With 6,000 votes the differences between systems come within 30 points of the truth. Bootstrap intervals contain the estimates and shrink by more than half with 16 times the votes.
- **Item analysis** finds every planted problem and nothing else that looks like a wrong key. Reversing an item's key exactly reverses its discrimination (property-based).
- **The rewording test** alarms on at most 5% of uncontaminated benchmarks. It finds a 12-point advantage for the original wording in most benchmarks of 200 items. Case, punctuation and spacing never hide a copy (property-based).
- **The Pareto front** is exactly the set of undominated candidates (property-based), and a tighter margin changes the choice.
- **The word alignment** always finds the minimum number of edits, compared with an independent edit distance (property-based). Rates per slice pool the errors, because an average of per-utterance rates would let a two-word utterance outweigh a twenty-word one.
- **Governance evidence:** evidence goes stale one day after the age limit, a test that never ran is a gap, and fixing the two high-severity risks turns the decision into a go.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/16-benchmarks-governance
```
