"""Governance evidence: a risk register linked to tests, checked against the latest results for the
release, with gaps, stale evidence and an evidence report in Markdown.

Chapter: Benchmarks, human evaluation and governance (governance and evidence)
https://gimme-job.com/learn/llm?topic=pro-practice

Usage:
    python governance_evidence.py data/risk_register.json data/test_results.json --release 2.4.0 --date 2026-10-10
    python governance_evidence.py ... --report evidence.md
Exit status: 0 when every high-severity risk has current, passing evidence, 1 otherwise.
"""

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class Result:
    status: str  # pass or fail
    version: str
    ran: date


@dataclass
class RiskStatus:
    risk: dict
    problems: list[str] = field(default_factory=list)

    @property
    def current(self) -> bool:
        return not self.problems


def check(risks: list[dict], results: dict[str, Result], release: str, today: date,
          max_age_days: int = 90) -> tuple[list[RiskStatus], list[str]]:
    """Status of every risk, and the tests that cover no risk."""
    statuses = []
    for risk in risks:
        status = RiskStatus(risk, [] if risk["tests"] else ["no test covers it"])
        for test in risk["tests"]:
            result = results.get(test)
            if result is None:
                status.problems.append(f"{test} never ran")
                continue
            if result.status != "pass":
                status.problems.append(f"{test} {result.status}s")
            if result.version != release:
                status.problems.append(f"{test} tested {result.version}")
            age = (today - result.ran).days
            if age > max_age_days:
                status.problems.append(f"{test} is {age} days old")
        statuses.append(status)
    linked = {test for risk in risks for test in risk["tests"]}
    return statuses, sorted(set(results) - linked)


def blocking(statuses: list[RiskStatus]) -> list[str]:
    return [status.risk["id"] for status in statuses if status.risk["severity"] == "high" and not status.current]


def report(statuses: list[RiskStatus], unlinked: list[str], release: str, today: date) -> str:
    gaps = blocking(statuses)
    lines = [f"# Evidence report for release {release}", "",
             f"Generated {today.isoformat()} from the risk register and the latest test results.", "",
             f"**Decision:** {'no-go, high risks without current evidence: ' + ', '.join(gaps) if gaps else 'evidence complete'}",
             "", "| Risk | Severity | Description | Tests | Evidence |", "|---|---|---|---|---|"]
    for status in statuses:
        risk = status.risk
        lines.append(f"| {risk['id']} | {risk['severity']} | {risk['risk']} | {', '.join(risk['tests']) or '-'} | "
                     f"{'; '.join(status.problems) or 'current'} |")
    lines += ["", f"Tests that cover no risk: {', '.join(unlinked) or 'none'}", ""]
    return "\n".join(lines)


def load(register: Path, results: Path) -> tuple[list[dict], dict[str, Result]]:
    risks = json.loads(Path(register).read_text(encoding="utf-8"))["risks"]
    raw = json.loads(Path(results).read_text(encoding="utf-8"))["results"]
    return risks, {name: Result(row["status"], row["version"], date.fromisoformat(row["ran"])) for name, row in raw.items()}


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check that every risk has current evidence.")
    parser.add_argument("register", type=Path)
    parser.add_argument("results", type=Path)
    parser.add_argument("--release", required=True)
    parser.add_argument("--date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--max-age-days", type=int, default=90)
    parser.add_argument("--report", type=Path, help="write the evidence report in Markdown")
    args = parser.parse_args(argv[1:])

    risks, results = load(args.register, args.results)
    statuses, unlinked = check(risks, results, args.release, args.date, args.max_age_days)
    for status in statuses:
        risk = status.risk
        print(f"{risk['id']} {risk['severity']:<6} {risk['risk']:<38} {'; '.join(status.problems) or 'evidence current'}")
    print("tests that cover no risk:", ", ".join(unlinked) or "none")
    gaps = blocking(statuses)
    print(f"release {args.release}:", f"no-go, high risks without current evidence: {', '.join(gaps)}" if gaps
          else "evidence complete")
    if args.report:
        args.report.write_text(report(statuses, unlinked, args.release, args.date), encoding="utf-8")
    return 1 if gaps else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
