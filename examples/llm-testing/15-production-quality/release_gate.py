"""A release gate over several kinds of requirements: hard checks, quality, latency, cost and slices.

Chapter: Production quality (evaluation in CI/CD)
https://gimme-job.com/learn/llm?topic=production-quality

Usage:
    python release_gate.py data/release_suite.jsonl gate.json --candidate cheaper
    python release_gate.py data/release_suite.jsonl gate.json --candidate cheaper --summary summary.md
Each JSONL line holds one case with its tags and the result of every version:
{"id": "c0001", "language": "uk", "intent": "refund", "zero_tolerance": false,
 "results": {"current": {"passed": true, "latency_s": 4.2, "ttft_s": 0.7, "cost_eur": 0.031}, ...}}

The limits live in gate.json, are versioned with the code and are decided before the run. Every check
has to pass: the exit status is 0 to ship and 1 to block. The report names the data and the limits by
their SHA-256, so that a decision can be traced back to exactly what produced it. In GitHub Actions,
pass --summary "$GITHUB_STEP_SUMMARY" to show the table on the run page.
"""

import argparse
import hashlib
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from statistics import fmean
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from latency_capacity import percentile

Z_95 = 1.959963984540054
PAIRED = {"paired_difference_low"}  # compares the candidate with the baseline, so the baseline has no value
FORMATS = {
    "zero_tolerance_failures": "{:.0f}",
    "paired_difference_low": "{:+.1%}",
    "pass_rate": "{:.1%}",
    "latency_p95": "{:.2f} s",
    "ttft_p95": "{:.2f} s",
    "cost_per_resolved": "EUR {:.4f}",
}


class Check(BaseModel):
    """One requirement. A misspelled field is an error, not an ignored limit: a gate that silently
    drops a limit passes everything."""
    model_config = ConfigDict(extra="forbid")

    name: str
    kind: Literal["hard", "quality", "latency", "cost", "slice"]
    metric: Literal["zero_tolerance_failures", "paired_difference_low", "pass_rate", "latency_p95", "ttft_p95",
                    "cost_per_resolved"]
    where: dict[str, str] = {}
    min: float | None = None
    max: float | None = None

    @model_validator(mode="after")
    def exactly_one_limit(self) -> "Check":
        if (self.min is None) == (self.max is None):
            raise ValueError(f"{self.name}: set exactly one of min and max")
        return self

    def accepts(self, value: float) -> bool:
        return value >= self.min if self.min is not None else value <= self.max

    def limit_text(self) -> str:
        if self.min is not None:
            return f"at least {FORMATS[self.metric].format(self.min)}"
        return f"at most {FORMATS[self.metric].format(self.max)}"


class Gate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decided: str  # when and by whom the limits were agreed, before any run
    checks: list[Check]


@dataclass(frozen=True)
class CheckResult:
    check: Check
    cases: int
    baseline: float | None
    candidate: float
    passed: bool


def load_cases(path: Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def load_gate(path: Path) -> Gate:
    return Gate.model_validate_json(Path(path).read_text(encoding="utf-8"))


def paired_difference(rows: list[dict], baseline: str, candidate: str) -> tuple[float, float, float]:
    """Difference in pass rate (candidate minus baseline) with a paired 95% interval: only the cases
    where the versions disagree carry information about the difference."""
    n = len(rows)
    only_baseline = sum(1 for row in rows if row["results"][baseline]["passed"] and not row["results"][candidate]["passed"])
    only_candidate = sum(1 for row in rows if row["results"][candidate]["passed"] and not row["results"][baseline]["passed"])
    diff = (only_candidate - only_baseline) / n
    se = math.sqrt(only_baseline + only_candidate - (only_candidate - only_baseline) ** 2 / n) / n
    return diff, diff - Z_95 * se, diff + Z_95 * se


def measure(metric: str, rows: list[dict], version: str, baseline: str) -> float:
    results = [row["results"][version] for row in rows]
    match metric:
        case "zero_tolerance_failures":
            return float(sum(1 for row, result in zip(rows, results) if row["zero_tolerance"] and not result["passed"]))
        case "paired_difference_low":
            return paired_difference(rows, baseline, version)[1]
        case "pass_rate":
            return fmean(1.0 if result["passed"] else 0.0 for result in results)
        case "latency_p95":
            return percentile([result["latency_s"] for result in results], 95)
        case "ttft_p95":
            return percentile([result["ttft_s"] for result in results], 95)
        case "cost_per_resolved":
            resolved = sum(1 for result in results if result["passed"])
            return sum(result["cost_eur"] for result in results) / resolved if resolved else math.inf
    raise ValueError(f"unknown metric {metric!r}")


def evaluate(rows: list[dict], gate: Gate, baseline: str, candidate: str) -> list[CheckResult]:
    outcome = []
    for check in gate.checks:
        selected = [row for row in rows if all(str(row.get(key)) == value for key, value in check.where.items())]
        if not selected:
            raise ValueError(f"{check.name}: no case matches {check.where}")
        before = None if check.metric in PAIRED else measure(check.metric, selected, baseline, baseline)
        value = measure(check.metric, selected, candidate, baseline)
        outcome.append(CheckResult(check, len(selected), before, value, check.accepts(value)))
    return outcome


def decision(results: list[CheckResult]) -> str:
    return "ship" if all(result.passed for result in results) else "block"


def fingerprint(path: Path) -> str:
    """SHA-256 of the file with line endings normalized, so that a checkout on Windows gives the same value."""
    text = Path(path).read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def show(metric: str, value: float | None) -> str:
    return "-" if value is None else FORMATS[metric].format(value)


def report_lines(results: list[CheckResult], baseline: str, candidate: str) -> list[str]:
    lines = [f"{'':6}{'check':<42} {baseline:>12} {candidate:>12}  limit"]
    for result in results:
        check = result.check
        lines.append(f"{'PASS' if result.passed else 'FAIL':<6}{check.name:<42} {show(check.metric, result.baseline):>12} "
                     f"{show(check.metric, result.candidate):>12}  {check.limit_text()}")
    failed = [result for result in results if not result.passed]
    lines.append(f"decision: {decision(results).upper()}" + (f", {len(failed)} check(s) failed" if failed else ""))
    return lines


def summary_markdown(results: list[CheckResult], baseline: str, candidate: str, cases: int, decided: str,
                     data_sha: str, gate_sha: str) -> str:
    lines = [
        f"## Release gate: {decision(results).upper()}",
        "",
        f"Candidate `{candidate}` against baseline `{baseline}` on {cases} cases. "
        f"Data `{data_sha}`, limits `{gate_sha}` (decided {decided}).",
        "",
        "| Check | Cases | Baseline | Candidate | Limit | Result |",
        "|---|---|---|---|---|---|",
    ]
    for result in results:
        check = result.check
        lines.append(f"| {check.name} | {result.cases} | {show(check.metric, result.baseline)} | "
                     f"{show(check.metric, result.candidate)} | {check.limit_text()} | "
                     f"{'pass' if result.passed else '**fail**'} |")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check a candidate against the release limits.")
    parser.add_argument("results", type=Path)
    parser.add_argument("gate", type=Path)
    parser.add_argument("--baseline", default="current")
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--summary", type=Path, help="append a Markdown table, for example to $GITHUB_STEP_SUMMARY")
    args = parser.parse_args(argv[1:])

    rows, gate = load_cases(args.results), load_gate(args.gate)
    results = evaluate(rows, gate, args.baseline, args.candidate)
    data_sha, gate_sha = fingerprint(args.results), fingerprint(args.gate)
    print(f"{args.candidate} against {args.baseline} on {len(rows)} cases (data {data_sha}, "
          f"limits {gate_sha} decided {gate.decided})")
    for line in report_lines(results, args.baseline, args.candidate):
        print(line)
    if args.summary:
        with args.summary.open("a", encoding="utf-8") as handle:
            handle.write(summary_markdown(results, args.baseline, args.candidate, len(rows), gate.decided,
                                          data_sha, gate_sha))
    return 0 if decision(results) == "ship" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
