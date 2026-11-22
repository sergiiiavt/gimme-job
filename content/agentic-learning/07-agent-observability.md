# Evaluating and observing agents

An agent that worked in a demo can fail in production in ways you never see: it takes six steps where two were enough, retries a failing tool until the budget runs out, or quietly costs ten times more on some inputs. Observability is how you find out. It means recording what the agent did, step by step, in a form you can search, measure and turn into tests.

This chapter covers what to record when you build an agent, which metrics belong to a whole task rather than a single call, recording decisions as well as calls, keeping traces safe and cheap, and turning traces into evaluation. The general fields of an LLM trace and production quality checks are covered in [Tracing and observability](/learn/llm?topic=production-quality&section=tracing-and-observability), and systematic evaluation of agents in [Outcome and trajectory evaluation](/learn/llm?topic=agent-testing&section=outcome-and-trajectory-evaluation).

**Prerequisites:** [How an AI agent works](/learn/agentic?topic=how-agents-work), [Human approval and action boundaries](/learn/agentic?topic=human-approval).

## What makes agents harder to observe

A single model call has one input and one output. An agent run has a variable number of steps, each of which can call the model, a tool or a person, and the interesting failures are in the sequence:

| Failure | What a single-call log shows | What a task trace shows |
|---|---|---|
| Loop without progress | Many normal-looking calls | The same tool called repeatedly until the budget stopped it |
| Wrong tool chosen | A valid call | The step where the plan went wrong, and what the model saw before it |
| Silent cost blow-up | Normal per-call cost | One task using twenty calls instead of three |
| Hidden tool failures | Errors in a tool's own log | Errors the agent received, and whether it recovered or pretended success |
| Approval friction | Nothing | How often people reject or edit proposed actions |

So the unit of observation is the task: everything the agent did to answer one request, from the first model call to the final answer or stop.

## Instrument the loop

Instrument the agent loop once, in the application, not in each tool. One trace per task; one span per step:

```diagram
Trace: "triage run-512"   outcome=done   steps=4   cost=$0.012   2.9 s
 ├─ span: model call 1      1,900 in / 120 out tokens    820 ms   → proposes ci_list_failures
 ├─ span: tool ci_list_failures   ok                       45 ms
 ├─ span: model call 2      2,300 in / 90 out tokens     760 ms   → proposes ci_test_history
 ├─ span: tool ci_test_history    ok                       38 ms
 ├─ span: approval request  proposal-1   approved by a person after 4 min
 └─ stop: answer (reason: no failures left to triage)
```

For an agent, record these on top of the usual model-call fields:

- **The task**: who asked, what was asked, which agent version and which tool set.
- **Every step in order**: the model's proposal, the tool name and arguments, the result or error, timing.
- **Budgets**: steps, tokens and cost used against the limits you set.
- **Approvals**: what was shown, who decided, how long it took, and whether the action was edited.
- **The stop reason**: final answer, budget exhausted, error, refusal, or a person stopping it.

The stop reason is the field teams most often forget, and the most useful one for finding runs that ended badly without raising an error. Name spans and attributes after the OpenTelemetry semantic conventions for generative AI, so the same traces work in Langfuse, Phoenix or any other compatible backend.

## Measure the task, not the call

Per-call averages hide most agent problems. Report metrics per task, and watch distributions rather than means; as Google's SRE practice puts it for latency, the tail is what users feel:

| Metric | Why |
|---|---|
| Task success rate | The number that matters to users; needs a definition of success per task type |
| Steps per task | Rising steps mean worse planning or worse tools |
| Tool error rate, and recovery rate | How often tools fail, and how often the agent recovers honestly |
| Latency per task, p50 and p95 | Users feel the slow tail, not the average |
| Cost per successful task | Cost per call looks cheap until failed runs are counted |
| Budget exhaustion rate | Runs that stopped because of limits rather than an answer |
| Approval rejection and edit rate | How often the agent proposes things people would not do |

The code below turns a handful of traces into these numbers. Prices are illustrative.

```python
import statistics

PRICE_PER_MILLION = {"input": 3.0, "output": 15.0}

runs = [
    {"outcome": "done", "spans": [{"kind": "model", "ms": 820, "in": 1900, "out": 120}, {"kind": "tool", "ms": 45, "error": False},
                                   {"kind": "model", "ms": 760, "in": 2300, "out": 90}, {"kind": "tool", "ms": 38, "error": False}]},
    {"outcome": "done", "spans": [{"kind": "model", "ms": 900, "in": 2000, "out": 140}, {"kind": "tool", "ms": 50, "error": False}]},
    {"outcome": "budget", "spans": [{"kind": "model", "ms": 700, "in": 1800, "out": 80}, {"kind": "tool", "ms": 4000, "error": True}] * 4},
    {"outcome": "done", "spans": [{"kind": "model", "ms": 950, "in": 2600, "out": 200}, {"kind": "tool", "ms": 60, "error": True},
                                   {"kind": "model", "ms": 640, "in": 2900, "out": 110}, {"kind": "tool", "ms": 55, "error": False}]},
    {"outcome": "error", "spans": [{"kind": "model", "ms": 300, "in": 1500, "out": 20}]},
    {"outcome": "done", "spans": [{"kind": "model", "ms": 870, "in": 2100, "out": 130}, {"kind": "tool", "ms": 41, "error": False}]},
]

def task_metrics(run):
    model = [span for span in run["spans"] if span["kind"] == "model"]
    tools = [span for span in run["spans"] if span["kind"] == "tool"]
    tokens_cost = sum(span["in"] * PRICE_PER_MILLION["input"] + span["out"] * PRICE_PER_MILLION["output"] for span in model)
    return {
        "success": run["outcome"] == "done",
        "steps": len(tools),
        "tool_errors": sum(1 for span in tools if span["error"]),
        "latency_ms": sum(span["ms"] for span in run["spans"]),
        "cost": tokens_cost / 1_000_000,
    }

metrics = [task_metrics(run) for run in runs]
successes = [item for item in metrics if item["success"]]
latencies = sorted(item["latency_ms"] for item in metrics)
print("task success rate:", round(len(successes) / len(metrics), 2))
print("median steps:", statistics.median(item["steps"] for item in metrics))
print("p50 / p95 latency ms:", statistics.median(latencies), round(statistics.quantiles(latencies, n=20, method="inclusive")[18]))
print("budget exhausted:", sum(1 for run in runs if run["outcome"] == "budget"))
print("cost per call:", round(sum(item["cost"] for item in metrics) / sum(len(run["spans"]) for run in runs), 4))
print("cost per successful task:", round(sum(item["cost"] for item in metrics) / len(successes), 4))
```

The run that hit its budget spent most of the time and a large share of the money while delivering nothing, which per-call averages would never show.

## Record decisions, not only calls

A trace of calls tells you what happened; a trace of decisions tells you why. Wherever your code makes a choice, such as building a retrieval query, routing to a branch, rejecting a tool call or falling back, record the rule, the input it looked at and the branch it took. Deterministic decisions are the easiest to record and the most useful when debugging, because you can replay them exactly.

The Learning Path Advisor on this site does this. Its trace records, for every request, decisions such as "Context method: deterministic, no model call", whether the short follow-up rule fired and with which previous message, which retrieval mode was used, and how many cited sources were removed because they had not been retrieved. When an answer looks wrong, the trace shows whether retrieval, routing or the model was responsible.

## Keep traces safe and cheap

Traces contain prompts, tool arguments and results, which means personal data, secrets and untrusted content. Treat them as production data:

- **Redact before export.** Remove tokens, passwords and personal identifiers at the source, not in the viewer.
- **Separate long-term metrics from short-term diagnostics.** GimmeJob keeps aggregated, payload-free operation data (event, status, duration, counts, a safe reason code) for long-term trends, and full structured diagnostics only in short-retention runtime logs. Raw exception messages, payloads and personal content never go into the long-term store.
- **Sample.** Keep every failed or budget-exhausted run, and a sample of successful ones.
- **Never let observability break the agent.** If the tracing backend is down, the request must still succeed. The Advisor creates its Langfuse handler with errors suppressed and continues without tracing when initialization fails.
- **Treat trace content as untrusted when you display it.** A tool result containing injected text is still untrusted when it appears in a dashboard.

## From traces to evaluation

Traces become most valuable when they feed the evaluation set:

1. Find a bad run: a failure, a budget stop, a rejected approval, a user complaint.
2. Reduce it to a reproducible case: the task, the relevant tool responses (recorded or faked) and what a good run should do.
3. Add it to the evaluation set with checks on the outcome and on the trajectory.
4. Run the set on every change to prompts, tools or models, and repeat agent runs several times, because agents are not deterministic.

The checks themselves, such as outcome versus trajectory, fault injection and pass^k over repeated runs, are covered in [Outcome and trajectory evaluation](/learn/llm?topic=agent-testing&section=outcome-and-trajectory-evaluation) and [Reliability across repeated runs](/learn/llm?topic=agent-testing&section=reliability-across-repeated-runs).

## Case study: the live trace of the Learning Path Advisor

The Advisor streams its trace to the page while it works, so a user can open the execution details next to the answer:

| Event | What it shows |
|---|---|
| `node.start`, `node.complete` | Each step of the workflow graph with its duration and decisions |
| `retrieval.complete` | The retrieval query, mode (semantic or lexical fallback) and the ranked results |
| `llm.start`, `llm.complete` | Each model call with its token usage |

The same request can also be traced in Langfuse, where scores such as the share of grounded items are attached to the trace, as described in [the production quality case study](/learn/llm?topic=production-quality&section=case-study-the-learning-path-advisor-of-this-site). The design choice worth copying is that the trace is built from the same objects the code uses to make decisions, so what you see in the trace is what actually happened, not a separate log that can drift.

## Common mistakes

- **Logging calls without a task identifier.** You cannot reconstruct a run from unrelated call logs.
- **No stop reason.** Runs that ended in a budget stop look like successes in most dashboards.
- **Averages only.** Mean latency and mean cost hide the slow, expensive tail where agents fail.
- **Cost per call instead of cost per successful task.** Failed and looping runs are where the money goes.
- **Recording calls but not decisions.** Without the rule and branch, a wrong answer cannot be explained.
- **Unredacted traces.** Secrets and personal data in a tracing tool are a breach waiting to happen.
- **Tracing that can fail the request.** Observability must degrade silently, not take the agent down with it.

## Summary

Observe agents per task: one trace per request with every step, budget use, approvals and a stop reason. Measure task success, steps, tool errors, latency percentiles, cost per successful task, budget exhaustion and approval rejections, rather than per-call averages. Record the decisions your code makes, not only the calls it makes. Keep traces redacted, sampled and separate from long-term metrics, and make sure tracing can never break the agent. Turn bad runs into evaluation cases, and test changes against them repeatedly.
