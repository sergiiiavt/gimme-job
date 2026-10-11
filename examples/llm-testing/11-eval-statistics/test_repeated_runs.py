import itertools
import random
from pathlib import Path

import pytest

from repeated_runs import (clustered_standard_error, load, main, mean_over_cases, naive_standard_error, pass_at_k,
                           pass_hat_k)

HERE = Path(__file__).parent
RUNS_PATH = HERE / "data" / "repeated_runs.jsonl"


@pytest.mark.parametrize("n", range(1, 8))
def test_estimators_equal_the_share_of_k_run_subsets(n):
    """pass@k and pass^k are exact: they average over every way to choose k of the recorded runs."""
    for c in range(n + 1):
        runs = [True] * c + [False] * (n - c)
        for k in range(1, n + 1):
            subsets = list(itertools.combinations(runs, k))
            assert pass_at_k(n, c, k) == pytest.approx(sum(any(s) for s in subsets) / len(subsets))
            assert pass_hat_k(n, c, k) == pytest.approx(sum(all(s) for s in subsets) / len(subsets))


def test_chapter_example():
    passes = [[True] * c + [False] * (10 - c) for c in [10, 10, 9, 9, 8, 7, 7, 5, 3, 2]]
    assert round(mean_over_cases(pass_at_k, passes, 5), 2) == 0.97
    assert round(mean_over_cases(pass_hat_k, passes, 5), 2) == 0.34


def test_more_attempts_help_pass_at_k_and_hurt_pass_hat_k():
    results = load(RUNS_PATH)
    at_k = [mean_over_cases(pass_at_k, results, k) for k in range(1, 9)]
    hat_k = [mean_over_cases(pass_hat_k, results, k) for k in range(1, 9)]
    assert at_k == sorted(at_k) and hat_k == sorted(hat_k, reverse=True)
    assert at_k[0] == hat_k[0], "with one attempt both are the plain pass rate"


def test_invalid_arguments_are_rejected():
    for n, c, k in [(5, 6, 1), (5, 2, 0), (5, 2, 6)]:
        with pytest.raises(ValueError):
            pass_at_k(n, c, k)


def test_runs_of_the_same_task_are_not_independent_observations():
    results = load(RUNS_PATH)
    assert clustered_standard_error(results) > 1.3 * naive_standard_error(results)


def test_without_differences_between_cases_both_errors_agree():
    rng = random.Random(4)
    results = [[rng.random() < 0.8 for _ in range(5)] for _ in range(400)]
    assert clustered_standard_error(results) / naive_standard_error(results) == pytest.approx(1.0, abs=0.12)


def test_command_line(capsys):
    assert main(["repeated_runs.py", str(RUNS_PATH)]) == 0
    out = capsys.readouterr().out
    assert out.startswith("30 tasks, 8 runs each, pass rate 80.0%")
    assert "5     1.00    0.46" in out
