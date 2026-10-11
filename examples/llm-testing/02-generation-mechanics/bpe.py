"""A complete byte-pair encoding (BPE) tokenizer trainer, small enough to read.

Chapter: How LLMs generate text
https://gimme-job.com/learn/llm?topic=llm-foundations
"""

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
    """Learn merge rules: repeatedly merge the most frequent adjacent pair of symbols.
    Ties are broken by first occurrence, which makes training deterministic."""
    words = {word: list(word) + [END] for word in word_counts}
    merges = []
    for _ in range(num_merges):
        pairs: Counter = Counter()
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


def detokenize(tokens: list[str]) -> str:
    """Inverse of tokenize for a single word."""
    return "".join(tokens).removesuffix(END)
