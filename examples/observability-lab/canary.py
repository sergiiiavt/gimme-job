"""Canary analysis: compare the canary with the control group on the same user-visible signals."""

from __future__ import annotations

from dataclasses import dataclass

from slo import Verdict


@dataclass(frozen=True)
class CanaryDecision:
    action: str  # "promote", "rollback" or "wait"
    reasons: tuple[str, ...]

    def line(self) -> str:
        return f"{self.action.upper()}: " + "; ".join(self.reasons)


def judge(control: list[Verdict], canary: list[Verdict], min_requests: int = 50, tolerance: float = 0.02) -> CanaryDecision:
    """Promote only when the canary has served enough traffic and is no worse than the control.

    The comparison is with the control group over the same period, not with yesterday's numbers:
    traffic, time of day and dependencies change, and both groups see the same changes.
    """
    baseline = {verdict.objective.name: verdict for verdict in control}
    too_little = [verdict for verdict in canary if verdict.count < min_requests]
    if too_little:
        served = int(min(verdict.count for verdict in too_little))
        return CanaryDecision("wait", (f"the canary served {served} requests; at least {min_requests} are needed to judge it",))

    worse = []
    for verdict in canary:
        reference = baseline[verdict.objective.name]
        if verdict.ratio < reference.ratio - tolerance:
            worse.append(f"{verdict.objective.name} {verdict.ratio:.1%} on the canary vs {reference.ratio:.1%} on the control")
    if worse:
        return CanaryDecision("rollback", tuple(worse))
    return CanaryDecision("promote", (f"every objective within {tolerance:.0%} of the control",))
