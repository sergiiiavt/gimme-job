"""A narrow triage agent that uses the lab MCP server through the stdio client.

A scripted policy stands in for the model, so the run is deterministic and needs no API key.
The loop is the one from the "How an AI agent works" chapter: the policy proposes the next tool
call from what it has seen, the application runs it through MCP, and a step budget and a trace
keep the run bounded and explainable. Quarantine is only proposed; a person approves it later.
"""

from __future__ import annotations

import json
import time
from typing import Any

from client import StdioClient



def is_flaky(results: list[str]) -> bool:
    """Flaky means it failed and then passed again on unchanged code; a test that only fails in the
    latest runs is a likely regression and must be investigated, not quarantined."""
    return any(earlier == "fail" and later == "pass" for earlier, later in zip(results, results[1:]))


class ToolFailure(Exception):
    """A tool failure must not be confused with successful task completion."""


def scripted_policy(observations: list[dict[str, Any]], run_id: str) -> dict[str, Any] | None:
    """Return the next tool call, or None when the triage is complete."""
    if any(obs.get("isError") for obs in observations):
        raise ToolFailure("Cannot continue triage after a failed tool")
    if not observations:
        return {"name": "ci_list_failures", "arguments": {"run_id": run_id}}
    failures = observations[0]["structuredContent"]["failures"]
    histories = {obs["structuredContent"]["test"]: obs["structuredContent"] for obs in observations[1:]
                 if obs.get("tool") == "ci_test_history"}
    for failure in failures:
        if failure["test"] not in histories:
            return {"name": "ci_test_history", "arguments": {"test": failure["test"]}}
    proposed = {obs["structuredContent"]["test"] for obs in observations if obs.get("tool") == "ci_propose_quarantine"}
    for test, history in histories.items():
        if is_flaky(history["results"]) and test not in proposed:
            reason = f"Failed {history['results'].count('fail')} of {len(history['results'])} recent runs on unchanged code."
            return {"name": "ci_propose_quarantine", "arguments": {"test": test, "reason": reason}}
    return None


def run_triage(run_id: str, max_steps: int = 8) -> dict[str, Any]:
    trace: list[dict[str, Any]] = []
    observations: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    with StdioClient() as client:
        client.discover()
        for step in range(1, max_steps + 1):
            call = scripted_policy(observations, run_id)
            if call is None:
                stop_reason = "done"
                break
            started = time.perf_counter()
            outcome = client.call_tool(call["name"], call["arguments"])
            trace.append({
                "step": step,
                "tool": call["name"],
                "arguments": call["arguments"],
                "is_error": outcome.get("isError", False),
                "ms": round((time.perf_counter() - started) * 1000, 1),
            })
            observations.append({**outcome, "tool": call["name"]})
            if outcome.get("isError"):
                errors.append({"tool": call["name"], "content": outcome.get("content", [])})
                stop_reason = "tool error"
                break
        else:
            stop_reason = "step budget exhausted"
    successful = [obs for obs in observations if not obs.get("isError")]
    proposals = [obs["structuredContent"] for obs in successful if obs["tool"] == "ci_propose_quarantine"]
    regressions = [obs["structuredContent"]["test"] for obs in successful
                   if obs["tool"] == "ci_test_history" and not is_flaky(obs["structuredContent"]["results"])]
    return {"run_id": run_id, "stop_reason": stop_reason, "steps": len(trace), "trace": trace,
            "proposals": proposals, "investigate": regressions, "errors": errors}


if __name__ == "__main__":
    report = run_triage("run-512")
    for entry in report["trace"]:
        print(f"step {entry['step']}: {entry['tool']} {json.dumps(entry['arguments'])} error={entry['is_error']} {entry['ms']} ms")
    print("stop:", report["stop_reason"])
    for error in report["errors"]:
        print("tool error:", error["tool"], error["content"])
    for proposal in report["proposals"]:
        print("needs approval:", proposal["id"], proposal["test"], "-", proposal["reason"])
    for test in report["investigate"]:
        print("investigate (likely regression, not flaky):", test)
