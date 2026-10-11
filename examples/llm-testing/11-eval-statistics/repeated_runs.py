"""Repeated runs of the same cases: pass@k, pass^k and clustered standard errors.

Chapter: Statistics for evaluation (repeated runs)
https://gimme-job.com/learn/llm?topic=eval-statistics

Usage:
    python repeated_runs.py data/repeated_runs.jsonl
Each JSONL line holds {"task": ..., "runs": [true, false, ...]}.
"""

import json
import math
import sys
from math import comb
from pathlib import Path
from statistics import fmean, stdev


def pass_at_k(n: int, c: int, k: int) -> float:
    """Unbiased estimate of the chance that at least one of k attempts passes, from c passes in n runs
    (Chen et al., 2021)."""
    if not 0 < k <= n or not 0 <= c <= n:
        raise ValueError(f"need 0 < k <= n and 0 <= c <= n, got n={n}, c={c}, k={k}")
    if n - c < k:
        return 1.0
    return 1 - comb(n - c, k) / comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:
    """Estimate of the chance that all k attempts pass (pass^k, Yao et al., 2024)."""
    if not 0 < k <= n or not 0 <= c <= n:
        raise ValueError(f"need 0 < k <= n and 0 <= c <= n, got n={n}, c={c}, k={k}")
    return comb(c, k) / comb(n, k)


def mean_over_cases(estimator, results: list[list[bool]], k: int) -> float:
    return fmean(estimator(len(runs), sum(runs), k) for runs in results)


def naive_standard_error(results: list[list[bool]]) -> float:
    """Treats every run as an independent observation, which understates the uncertainty."""
    every_run = [passed for runs in results for passed in runs]
    rate = fmean(every_run)
    return math.sqrt(rate * (1 - rate) / len(every_run))


def clustered_standard_error(results: list[list[bool]]) -> float:
    """Treats the case as the sampled unit: the spread of per-case pass rates across cases."""
    case_rates = [fmean(runs) for runs in results]
    return stdev(case_rates) / math.sqrt(len(case_rates))


def load(path: Path) -> list[list[bool]]:
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    return [row["runs"] for row in rows]


def main(argv: list[str]) -> int:
    results = load(Path(argv[1]))
    runs = len(results[0])
    rate = fmean(passed for case in results for passed in case)
    print(f"{len(results)} tasks, {runs} runs each, pass rate {rate:.1%}")
    print(f"standard error: naive {naive_standard_error(results):.2%}, clustered by task {clustered_standard_error(results):.2%}")
    print("k   pass@k  pass^k")
    for k in range(1, min(runs, 5) + 1):
        print(f"{k}   {mean_over_cases(pass_at_k, results, k):6.2f}  {mean_over_cases(pass_hat_k, results, k):6.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
