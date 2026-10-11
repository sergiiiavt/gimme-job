"""Scoring harness: every scorer on every case, pass rates by slice, comparison of two runs.

Chapter: Code-based scorers and metrics (building a scoring harness)
https://gimme-job.com/learn/llm?topic=code-based-scorers

Usage:
    python harness.py data/outputs_v2.jsonl
    python harness.py data/outputs_v2.jsonl --baseline data/outputs_v1.jsonl
    python harness.py data/outputs_v2.jsonl --save results.json

The dataset (data/cases.jsonl) is separate from the outputs of each system version. A run records
the scorer version, a hash of the scorer source, and runs scored by different versions are never
compared: a fixed scorer would otherwise look like a better or worse model. Code-based scorers
cost nothing to re-run, so the baseline outputs are simply re-scored with the current version.
"""

import argparse
import hashlib
import json
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

from fact_scorer import unknown_facts
from scorers import Score, score_answer

HERE = Path(__file__).parent
SCORER_FILES = (HERE / "scorers.py", HERE / "fact_scorer.py")
SLICE_TAGS = ("lang", "feature")


def scorer_version(files=SCORER_FILES) -> str:
    """Hash of the scorer source. Line endings are normalized, so a Windows checkout gives the same version."""
    digest = hashlib.sha256()
    for path in files:
        digest.update(Path(path).read_bytes().replace(b"\r\n", b"\n"))
    return digest.hexdigest()[:12]


@dataclass(frozen=True)
class CaseResult:
    case_id: str
    tags: dict[str, str]
    scores: tuple[Score, ...]

    @property
    def passed(self) -> bool:
        return all(score.passed for score in self.scores)


@dataclass(frozen=True)
class Run:
    scorer_version: str
    results: tuple[CaseResult, ...]

    def to_json(self) -> dict:
        return {"scorer_version": self.scorer_version, "results": [asdict(result) for result in self.results]}

    @classmethod
    def from_json(cls, data: dict) -> "Run":
        results = tuple(CaseResult(item["case_id"], item["tags"], tuple(Score(**score) for score in item["scores"]))
                        for item in data["results"])
        return cls(data["scorer_version"], results)


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def load_cases(cases_path: Path = HERE / "data" / "cases.jsonl",
               policies_path: Path = HERE / "data" / "policies.json") -> list[dict]:
    """Cases with the text of their retrieved documents. Unknown fact IDs fail loudly here,
    not silently in the middle of a run."""
    policies = json.loads(Path(policies_path).read_text(encoding="utf-8"))
    cases = read_jsonl(cases_path)
    for case in cases:
        unknown = unknown_facts([*case["must_state"], *case["must_not_state"]])
        if unknown:
            raise ValueError(f"case {case['id']} uses unknown facts {unknown}")
        case["sources"] = [policies[doc] for doc in case["retrieved"]]
    return cases


def load_outputs(path: Path) -> dict[str, str]:
    return {row["id"]: row["output"] for row in read_jsonl(path)}


def run(cases: list[dict], outputs: dict[str, str], version: str | None = None) -> Run:
    results = []
    for case in cases:
        raw = outputs.get(case["id"])
        scores = score_answer(case, raw) if raw is not None else [Score("output", False, "no output recorded")]
        results.append(CaseResult(case["id"], {tag: case[tag] for tag in SLICE_TAGS}, tuple(scores)))
    return Run(version or scorer_version(), tuple(results))


def pass_rates(result_run: Run) -> dict[str, tuple[int, int]]:
    """(passed, total) for the whole run and for each tag value."""
    rates: dict[str, tuple[int, int]] = {}
    for result in result_run.results:
        for key in ["all", *(f"{tag}={value}" for tag, value in result.tags.items())]:
            passed, total = rates.get(key, (0, 0))
            rates[key] = (passed + result.passed, total + 1)
    return dict(sorted(rates.items(), key=lambda item: (item[0] != "all", item[0])))


def failures_by_scorer(result_run: Run) -> Counter:
    return Counter(score.scorer for result in result_run.results for score in result.scores if not score.passed)


@dataclass(frozen=True)
class Comparison:
    rates: dict[str, tuple[float, float]]  # slice -> (baseline pass rate, candidate pass rate)
    regressions: list[str]
    fixes: list[str]


def compare(baseline: Run, candidate: Run) -> Comparison:
    if baseline.scorer_version != candidate.scorer_version:
        raise ValueError(f"the runs were scored by different scorer versions ({baseline.scorer_version}, "
                         f"{candidate.scorer_version}); re-score the baseline before comparing")
    before, after = pass_rates(baseline), pass_rates(candidate)
    rates = {key: (before[key][0] / before[key][1], after[key][0] / after[key][1]) for key in after if key in before}
    passed_before = {result.case_id: result.passed for result in baseline.results}
    regressions = [result.case_id for result in candidate.results if passed_before.get(result.case_id) and not result.passed]
    fixes = [result.case_id for result in candidate.results if passed_before.get(result.case_id) is False and result.passed]
    return Comparison(rates, regressions, fixes)


def report_lines(result_run: Run) -> list[str]:
    lines = [f"{'slice':<18} passed  rate"]
    for key, (passed, total) in pass_rates(result_run).items():
        lines.append(f"{key:<18} {f'{passed}/{total}':>6}  {passed / total:>4.0%}")
    counts = failures_by_scorer(result_run)
    lines.append("failures by scorer: " + (", ".join(f"{name} {count}" for name, count in counts.most_common()) or "none"))
    for result in result_run.results:
        for score in result.scores:
            if not score.passed:
                lines.append(f"FAIL {result.case_id} {score.scorer}: {score.reason}")
    return lines


def comparison_lines(comparison: Comparison) -> list[str]:
    lines = [f"{'slice':<18} baseline  candidate  change"]
    for key, (before, after) in comparison.rates.items():
        lines.append(f"{key:<18} {before:>8.0%}  {after:>9.0%}  {round((after - before) * 100):+d} pp")
    lines.append("regressions: " + (", ".join(comparison.regressions) or "none"))
    lines.append("fixed: " + (", ".join(comparison.fixes) or "none"))
    return lines


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Score recorded outputs of the support assistant.")
    parser.add_argument("outputs", type=Path, help="JSONL with {id, output} per case")
    parser.add_argument("--baseline", type=Path, help="outputs of the previous version, re-scored for comparison")
    parser.add_argument("--save", type=Path, help="write the scored run as JSON")
    args = parser.parse_args(argv[1:])

    cases = load_cases()
    candidate = run(cases, load_outputs(args.outputs))
    print(f"scorer version {candidate.scorer_version}, {len(cases)} cases")
    for line in report_lines(candidate):
        print(line)
    if args.baseline:
        print(f"\ncompared with {args.baseline.as_posix()}, re-scored by the same scorer version")
        for line in comparison_lines(compare(run(cases, load_outputs(args.baseline)), candidate)):
            print(line)
    if args.save:
        args.save.write_text(json.dumps(candidate.to_json(), ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
