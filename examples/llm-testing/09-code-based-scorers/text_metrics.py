"""Reference-based text metrics: exact match, token F1, BLEU, ROUGE-N and ROUGE-L.

Chapter: Code-based scorers and metrics
https://gimme-job.com/learn/llm?topic=code-based-scorers

Each definition is written out step by step so that it can be read and tested. To publish numbers
that others can compare with, use the reference implementations (the official SQuAD evaluation
script, sacreBLEU, rouge-score): tokenization details change the values.
"""

import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

ARTICLES = frozenset({"a", "an", "the"})
WORD = re.compile(r"\w+")
UKRAINIAN_APOSTROPHE = "\u02bc"  # a letter modifier, not punctuation, in Unicode


def normalize_answer(text: str) -> str:
    """SQuAD normalization: lowercase, remove punctuation and the English articles, collapse whitespace.

    Punctuation is removed by Unicode category instead of string.punctuation, so that guillemets,
    dashes and every apostrophe used in Ukrainian text are removed too.
    """
    text = text.lower()
    text = "".join(ch for ch in text if not unicodedata.category(ch).startswith("P") and ch != UKRAINIAN_APOSTROPHE)
    return " ".join(word for word in text.split() if word not in ARTICLES)


def exact_match(prediction: str, reference: str) -> float:
    return float(normalize_answer(prediction) == normalize_answer(reference))


def token_f1(prediction: str, reference: str) -> float:
    """Harmonic mean of token precision and recall after normalization (SQuAD)."""
    pred, ref = normalize_answer(prediction).split(), normalize_answer(reference).split()
    if not pred or not ref:
        return float(pred == ref)  # as in the official script: two empty answers match
    overlap = sum((Counter(pred) & Counter(ref)).values())
    if overlap == 0:
        return 0.0
    precision, recall = overlap / len(pred), overlap / len(ref)
    return 2 * precision * recall / (precision + recall)


def tokenize(text: str) -> list[str]:
    """Lowercased word tokens in any script; punctuation separates words.

    The default tokenizer of the rouge-score package keeps only a-z and 0-9, so Ukrainian text
    has no tokens there unless you pass your own tokenizer.
    """
    return WORD.findall(text.lower())


def ngrams(tokens: list[str], n: int) -> Counter:
    return Counter(tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1))


def _clipped_matches(candidate: list[str], reference: list[str], n: int) -> tuple[int, int]:
    """Candidate n-grams found in the reference, each counted at most as often as the reference has it,
    and the number of candidate n-grams."""
    cand, ref = ngrams(candidate, n), ngrams(reference, n)
    return sum(min(count, ref[gram]) for gram, count in cand.items()), sum(cand.values())


def _brevity_penalty(candidate_length: int, reference_length: int) -> float:
    if candidate_length > reference_length:
        return 1.0
    return math.exp(1 - reference_length / candidate_length)


def sentence_bleu(candidate: str, reference: str, max_n: int = 4) -> float:
    """BLEU for one sentence pair.

    Add-one smoothing of the 2..4-gram precisions (Lin and Och, 2004; compared with other methods by
    Chen and Cherry, 2014) keeps a short sentence without any 4-gram match from scoring exactly zero.
    """
    cand, ref = tokenize(candidate), tokenize(reference)
    if not cand or not ref:
        return 0.0
    log_precision = 0.0
    for n in range(1, max_n + 1):
        matches, total = _clipped_matches(cand, ref, n)
        if n > 1:
            matches, total = matches + 1, total + 1
        if matches == 0:
            return 0.0
        log_precision += math.log(matches / total) / max_n
    return _brevity_penalty(len(cand), len(ref)) * math.exp(log_precision)


def corpus_bleu(candidates: list[str], references: list[str], max_n: int = 4) -> float:
    """BLEU as originally defined: n-gram matches and lengths are summed over the whole corpus
    before the precisions are combined, so it is not the average of sentence scores."""
    if len(candidates) != len(references):
        raise ValueError("every candidate needs exactly one reference")
    matches, totals = [0] * max_n, [0] * max_n
    candidate_length = reference_length = 0
    for candidate, reference in zip(candidates, references):
        cand, ref = tokenize(candidate), tokenize(reference)
        candidate_length += len(cand)
        reference_length += len(ref)
        for n in range(1, max_n + 1):
            found, total = _clipped_matches(cand, ref, n)
            matches[n - 1] += found
            totals[n - 1] += total
    if candidate_length == 0 or min(matches) == 0:
        return 0.0
    log_precision = sum(math.log(found / total) for found, total in zip(matches, totals)) / max_n
    return _brevity_penalty(candidate_length, reference_length) * math.exp(log_precision)


@dataclass(frozen=True)
class PRF:
    precision: float
    recall: float
    f1: float


def _prf(overlap: int, candidate_total: int, reference_total: int) -> PRF:
    if overlap == 0:
        return PRF(0.0, 0.0, 0.0)
    precision, recall = overlap / candidate_total, overlap / reference_total
    return PRF(precision, recall, 2 * precision * recall / (precision + recall))


def rouge_n(candidate: str, reference: str, n: int = 1) -> PRF:
    """ROUGE-N: n-gram overlap; recall (overlap / reference n-grams) is the classic summarization score."""
    cand, ref = ngrams(tokenize(candidate), n), ngrams(tokenize(reference), n)
    return _prf(sum((cand & ref).values()), sum(cand.values()), sum(ref.values()))


def lcs_length(a: list[str], b: list[str]) -> int:
    """Length of the longest common subsequence, by dynamic programming in O(len(a) * len(b)) time."""
    previous = [0] * (len(b) + 1)
    for x in a:
        current = [0]
        for j, y in enumerate(b, 1):
            current.append(previous[j - 1] + 1 if x == y else max(previous[j], current[j - 1]))
        previous = current
    return previous[-1]


def rouge_l(candidate: str, reference: str) -> PRF:
    """ROUGE-L: precision, recall and F1 of the longest common subsequence of words."""
    cand, ref = tokenize(candidate), tokenize(reference)
    return _prf(lcs_length(cand, ref), len(cand), len(ref))
