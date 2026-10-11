"""Rankings from pairwise preferences: online Elo, the Bradley-Terry model fitted by maximum likelihood,
bootstrap intervals, and ranks that respect the uncertainty.

Chapter: Benchmarks, human evaluation and governance (human evaluation programs)
https://gimme-job.com/learn/llm?topic=pro-practice

The Bradley-Terry model (Bradley and Terry, 1952) gives each system a positive worth and assumes
that i beats j with probability worth_i / (worth_i + worth_j). It is fitted with the MM algorithm of
Hunter (2004). Scores are reported on the Elo scale: 400 * log10(worth) + 1000.

Usage:
    python pairwise_ranking.py data/preference_votes.jsonl
Each JSONL line holds one vote: {"a": ..., "b": ..., "winner": "a" | "b" | "tie"}.
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

Vote = tuple[str, str, float]  # system a, system b, score of a: 1 win, 0.5 tie, 0 loss


def systems_of(votes: list[Vote]) -> list[str]:
    return sorted({vote[0] for vote in votes} | {vote[1] for vote in votes})


def elo(votes: list[Vote], k: float = 32, start: float = 1000) -> dict[str, float]:
    """Online Elo: each vote moves both ratings, so the result depends on the order of the votes."""
    rating = {name: start for name in systems_of(votes)}
    for a, b, score in votes:
        expected = 1 / (1 + 10 ** ((rating[b] - rating[a]) / 400))
        rating[a] += k * (score - expected)
        rating[b] -= k * (score - expected)
    return rating


def bradley_terry(votes: list[Vote], tolerance: float = 1e-10, max_rounds: int = 10_000) -> dict[str, float]:
    """Maximum likelihood Bradley-Terry scores on the Elo scale; a tie counts as half a win for each side.
    Every system needs at least one win and one loss (or tie), or its maximum likelihood score is infinite."""
    names = systems_of(votes)
    wins = {name: 0.0 for name in names}
    games: dict[tuple[str, str], int] = {}
    for a, b, score in votes:
        wins[a] += score
        wins[b] += 1 - score
        pair = (a, b) if a < b else (b, a)
        games[pair] = games.get(pair, 0) + 1
    for name in names:
        played = sum(count for pair, count in games.items() if name in pair)
        if not 0 < wins[name] < played:
            raise ValueError(f"{name} won all or none of its games; its score cannot be estimated")
    worth = {name: 1.0 for name in names}
    for _ in range(max_rounds):
        updated = {}
        for name in names:
            denominator = sum(count / (worth[pair[0]] + worth[pair[1]]) for pair, count in games.items() if name in pair)
            updated[name] = wins[name] / denominator
        center = math.exp(sum(math.log(value) for value in updated.values()) / len(names))
        updated = {name: value / center for name, value in updated.items()}
        change = max(abs(math.log(updated[name] / worth[name])) for name in names)
        worth = updated
        if change < tolerance:
            break
    return {name: 1000 + 400 * math.log10(value) for name, value in worth.items()}


def win_probability(score_a: float, score_b: float) -> float:
    """Chance that a beats b for two scores on the Elo scale."""
    return 1 / (1 + 10 ** ((score_b - score_a) / 400))


def expected_wins(votes: list[Vote], scores: dict[str, float]) -> dict[str, float]:
    """Wins each system should have under the fitted model; at the maximum they equal the observed wins."""
    expected = {name: 0.0 for name in scores}
    for a, b, _ in votes:
        p = win_probability(scores[a], scores[b])
        expected[a] += p
        expected[b] += 1 - p
    return expected


def bootstrap_intervals(votes: list[Vote], resamples: int = 200, seed: int = 0,
                        confidence: float = 0.95) -> dict[str, tuple[float, float]]:
    """Percentile intervals of the Bradley-Terry scores, resampling votes with replacement."""
    rng = random.Random(seed)
    samples: dict[str, list[float]] = {name: [] for name in systems_of(votes)}
    for _ in range(resamples):
        try:
            fitted = bradley_terry([rng.choice(votes) for _ in votes], tolerance=1e-8)
        except ValueError:
            continue  # a resample where a system won or lost everything
        for name, value in fitted.items():
            samples[name].append(value)
    tail = (1 - confidence) / 2
    intervals = {}
    for name, values in samples.items():
        values.sort()
        intervals[name] = (values[int(tail * (len(values) - 1))], values[int((1 - tail) * (len(values) - 1))])
    return intervals


def ranks(intervals: dict[str, tuple[float, float]]) -> dict[str, int]:
    """Rank 1 plus the number of systems that are clearly better: whose lower bound is above this
    system's upper bound. Systems with overlapping intervals share a rank."""
    return {name: 1 + sum(1 for other, (low, _) in intervals.items() if other != name and low > high)
            for name, (_, high) in intervals.items()}


def load_votes(path: Path) -> list[Vote]:
    votes = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if line.strip():
            row = json.loads(line)
            votes.append((row["a"], row["b"], {"a": 1.0, "b": 0.0, "tie": 0.5}[row["winner"]]))
    return votes


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Rank systems from pairwise preference votes.")
    parser.add_argument("votes", type=Path)
    parser.add_argument("--resamples", type=int, default=200)
    args = parser.parse_args(argv[1:])

    votes = load_votes(args.votes)
    scores, intervals = bradley_terry(votes), bootstrap_intervals(votes, args.resamples)
    forward, backward, rank = elo(votes), elo(votes[::-1]), ranks(intervals)
    print(f"{len(votes)} votes")
    print(f"{'rank':<5} {'system':<10} {'Bradley-Terry':>13} {'95% interval':>15} {'Elo':>6} {'Elo reversed':>13}")
    for name in sorted(scores, key=lambda system: -scores[system]):
        low, high = intervals[name]
        print(f"{rank[name]:<5} {name:<10} {scores[name]:>13.0f} {low:>7.0f} - {high:<5.0f} {forward[name]:>6.0f} "
              f"{backward[name]:>13.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
