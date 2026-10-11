"""Probes for judge biases: position bias in pairwise comparisons and verbosity bias in pointwise verdicts.

Chapter: LLM-as-a-judge (known biases and how to measure them)
https://gimme-job.com/learn/llm?topic=model-graded-evaluation

Usage:
    python bias_probes.py data/pairwise.jsonl
Each line holds {"pair": ..., "a_first": "A" or "B", "b_first": "A" or "B"}: the winner when A was shown
first and the winner when B was shown first.
"""

import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

PADDING = (" Thank you for shopping with us. We value every customer and always aim to provide the best possible"
           " service, fast delivery, a wide choice of footwear for every season and friendly support whenever you"
           " need it, by e-mail, chat or phone, seven days a week, including public holidays.")


@dataclass(frozen=True)
class PositionReport:
    pairs: int
    consistent: int
    shown_first_won: float      # share of all judgements won by the answer shown first
    one_order_win_rate_b: float  # what a single run with A first would have reported
    wins_a: int
    wins_b: int
    ties: int                   # inconsistent pairs

    @property
    def win_rate_b(self) -> float:
        """Candidate win rate over both orders, inconsistent pairs counted as half a win each."""
        return (self.wins_b + self.ties / 2) / self.pairs


def position_report(verdicts: list[tuple[str, str]]) -> PositionReport:
    consistent = Counter(first for first, second in verdicts if first == second)
    shown_first = sum(first == "A" for first, _ in verdicts) + sum(second == "B" for _, second in verdicts)
    return PositionReport(
        pairs=len(verdicts),
        consistent=sum(consistent.values()),
        shown_first_won=shown_first / (2 * len(verdicts)),
        one_order_win_rate_b=sum(first == "B" for first, _ in verdicts) / len(verdicts),
        wins_a=consistent["A"],
        wins_b=consistent["B"],
        ties=len(verdicts) - sum(consistent.values()),
    )


def judge_both_orders(judge, pairs: list[dict]) -> list[tuple[str, str]]:
    """Ask the judge twice per pair, once with each answer first, and return the winners."""
    results = []
    for pair in pairs:
        better = pair["better"]
        first_run = judge.compare(pair["id"], pair["a"], pair["b"], "first" if better == "A" else "second")
        second_run = judge.compare(pair["id"], pair["b"], pair["a"], "first" if better == "B" else "second")
        results.append(("A" if first_run == "first" else "B", "B" if second_run == "first" else "A"))
    return results


def verbosity_flip_rate(judge, failing_answers: list[dict]) -> float:
    """Share of answers that people fail which the judge passes once irrelevant text is added.
    An unbiased judge keeps every verdict: padding adds no supported or unsupported policy."""
    flips = 0
    for case in failing_answers:
        plain = json.loads(judge.judge(case["id"], case["answer"], truly_passes=False))["verdict"]
        padded = json.loads(judge.judge(case["id"], case["answer"] + PADDING, truly_passes=False))["verdict"]
        flips += plain == "FAIL" and padded == "PASS"
    return flips / len(failing_answers)


def main(argv: list[str]) -> int:
    rows = [json.loads(line) for line in Path(argv[1]).read_text(encoding="utf-8").splitlines() if line.strip()]
    report = position_report([(row["a_first"], row["b_first"]) for row in rows])
    print(f"{report.pairs} pairs, consistent in both orders: {report.consistent} ({report.consistent / report.pairs:.0%})")
    print(f"the answer shown first won {report.shown_first_won:.0%} of judgements")
    print(f"one order only: B wins {report.one_order_win_rate_b:.0%}")
    print(f"both orders: B wins {report.wins_b}, A wins {report.wins_a}, ties {report.ties}, B win rate {report.win_rate_b:.0%}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
