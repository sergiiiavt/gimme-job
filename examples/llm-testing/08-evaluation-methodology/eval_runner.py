"""An evaluation runner: generation separated from scoring, a response cache, a run manifest, and a
scorecard that compares a candidate with the baseline case by case.

Chapter: Evaluation methodology and datasets (running evaluations; reading results)
https://gimme-job.com/learn/llm?topic=evaluation-fundamentals

Usage:
    python eval_runner.py data/golden.jsonl --baseline v2 --candidate v3 --cache .eval-cache
The system under test is FakeSupportModel, a deterministic stand-in for a model behind two prompt
versions; a real project passes its own client with the same generate(prompt_version, text) method.
"""

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

SCORER_VERSION = "expected-facts-1"


class FakeSupportModel:
    """Answers like a support model would under two prompt versions. Version v3 adds the delivery
    rule to the prompt, which fixes English answers but makes Ukrainian answers switch to English."""

    model_id = "fake-support-model-2026-10"

    def __init__(self) -> None:
        self.calls = 0

    def generate(self, prompt_version: str, text: str) -> str:
        self.calls += 1
        ukrainian = any("\u0400" <= ch <= "\u04ff" for ch in text)
        lowered = text.lower()
        if "return" in lowered or "поверн" in lowered:
            answer = ("Повернення приймаємо протягом 30 днів від доставки." if ukrainian
                      else "Returns are accepted within 30 days of delivery.")
        elif "deliver" in lowered or "доставк" in lowered:
            if prompt_version == "v3":
                answer = "Standard delivery takes 3-5 business days."
            else:
                answer = "Стандартна доставка триває 3-5 робочих днів." if ukrainian else "Delivery is usually quick."
        elif "refund" in lowered or "гроші" in lowered:
            answer = ("Гроші повернуться на той самий спосіб оплати протягом 5 робочих днів." if ukrainian
                      else "Refunds go to the original payment method within 5 business days.")
        else:
            answer = "I can help with returns, refunds and delivery."
        return answer


def score(case: dict, output: str) -> tuple[bool, str]:
    """Every expected fact (a lowercase phrase) must appear in the output."""
    missing = [fact for fact in case["expected_facts"] if fact.lower() not in output.lower()]
    return not missing, f"missing {missing}" if missing else ""


def _cache_key(model_id: str, prompt_version: str, text: str) -> str:
    return hashlib.sha256(json.dumps([model_id, prompt_version, text]).encode()).hexdigest()


def dataset_version(cases: list[dict]) -> str:
    return hashlib.sha256(json.dumps(cases, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


@dataclass
class Run:
    manifest: dict
    results: dict[str, dict] = field(default_factory=dict)  # case id -> {"output", "passed", "reason", "tags"}


def run(cases: list[dict], system, prompt_version: str, cache_dir: Path | None = None) -> Run:
    """Generate (through the cache) and then score. Outputs are stored, so a new scorer can re-score them."""
    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)
    result = Run(manifest={
        "dataset_version": dataset_version(cases),
        "cases": len(cases),
        "model_id": system.model_id,
        "prompt_version": prompt_version,
        "scorer_version": SCORER_VERSION,
        "cache_hits": 0,
    })
    for case in cases:
        cached = cache_dir / f"{_cache_key(system.model_id, prompt_version, case['input'])}.txt" if cache_dir else None
        if cached and cached.exists():
            output = cached.read_text(encoding="utf-8")
            result.manifest["cache_hits"] += 1
        else:
            output = system.generate(prompt_version, case["input"])
            if cached:
                cached.write_text(output, encoding="utf-8")
        passed, reason = score(case, output)
        result.results[case["id"]] = {"output": output, "passed": passed, "reason": reason, "tags": case["tags"]}
    return result


@dataclass(frozen=True)
class Scorecard:
    baseline_rate: float
    candidate_rate: float
    fixed: list[str]
    broken: list[str]
    slices: dict[str, tuple[int, int, int]]  # slice -> (baseline passed, candidate passed, cases)


def scorecard(baseline: Run, candidate: Run) -> Scorecard:
    for key in ("dataset_version", "scorer_version"):
        if baseline.manifest[key] != candidate.manifest[key]:
            raise ValueError(f"runs differ in {key}; compare runs of the same dataset scored by the same scorers")
    ids = list(baseline.results)
    slices = defaultdict(lambda: [0, 0, 0])
    for case_id in ids:
        old, new = baseline.results[case_id], candidate.results[case_id]
        for tag, value in old["tags"].items():
            counts = slices[f"{tag}={value}"]
            counts[0] += old["passed"]
            counts[1] += new["passed"]
            counts[2] += 1
    return Scorecard(
        baseline_rate=sum(baseline.results[i]["passed"] for i in ids) / len(ids),
        candidate_rate=sum(candidate.results[i]["passed"] for i in ids) / len(ids),
        fixed=[i for i in ids if candidate.results[i]["passed"] and not baseline.results[i]["passed"]],
        broken=[i for i in ids if baseline.results[i]["passed"] and not candidate.results[i]["passed"]],
        slices={name: tuple(counts) for name, counts in sorted(slices.items())},
    )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Run the evaluation for two prompt versions and compare them.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--baseline", default="v2")
    parser.add_argument("--candidate", default="v3")
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args(argv[1:])

    cases = [json.loads(line) for line in args.dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    system = FakeSupportModel()
    baseline = run(cases, system, args.baseline, args.cache)
    candidate = run(cases, system, args.candidate, args.cache)
    card = scorecard(baseline, candidate)
    print(f"dataset {baseline.manifest['dataset_version']}, {len(cases)} cases, model {system.model_id}, "
          f"scorer {SCORER_VERSION}, model calls {system.calls}")
    print(f"pass rate: {args.baseline} {card.baseline_rate:.0%}, {args.candidate} {card.candidate_rate:.0%}")
    print(f"fixed: {', '.join(card.fixed) or 'none'}")
    print(f"broken: {', '.join(card.broken) or 'none'}")
    for case_id in card.broken:
        print(f"  {case_id}: {candidate.results[case_id]['reason']}; output: {candidate.results[case_id]['output']}")
    for name, (old, new, total) in card.slices.items():
        print(f"{name:<18} {old}/{total} -> {new}/{total}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
