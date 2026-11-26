# Hands-on lab: a vacancy-research agent

Begin with the no-network fixture baseline below. Live SDK exercises are optional and need an authorized account/key, supported model/SDK, network and usage budget. Use synthetic inputs and low task/spend limits.

## 1. First call and model choice

1. Send one request that classifies a job title as QA, development or other, and print content, stop_reason and usage.
2. Run the same 15 real job titles through a Haiku-tier and a Sonnet-tier model. Record accuracy, latency and tokens in a small table, and pick the cheaper model if it is accurate enough.

## 2. A hand-written agent loop

1. Define a search_vacancies tool with a clear description, an input_schema with role, remote and posted_within_days, and a stub that returns sample data.
2. Write the loop: run tools while stop_reason is tool_use, send each tool_result with the matching tool_use_id, and distinguish model end_turn from validated task completion. Keep an eight-step cap plus explicit error/incomplete states.
3. Make the stub fail once and return is_error with a reason. Check that Claude retries or explains instead of reporting "no vacancies".

## 3. Tool Runner

Compare the current SDK Tool Runner with your explicit loop. Check equivalent contracts and independent expected outcomes, not identical stochastic prose. Identify the supported extension points for approval, logging, cancellation and recovery before deciding which orchestration to use.

## 4. Extend it

1. Add web search as a built-in tool and ask about a company you might apply to. Check the citations.
2. Turn on extended thinking for "rank these five vacancies for a QA lead moving into AI testing" and compare the answer with thinking off.

## 5. Optional: managed agent

Recreate the agent as a managed agent, start a session, send a user message event and stream the events back. Compare the code you did not have to write with section 2.

## Executable baseline and independent oracle

Use the [offline practice package](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice). Requires Python 3.10+, no model or API key. Run `python examples/certification-practice/practice.py platform`: every reference case should pass. Copy `starter.py` to a scratch file; `--candidate your_solution.py` should fail until you implement the required functions. Retain fixture IDs, expected/actual outputs and the command exit status.

| Stage | Task | Check |
| --- | --- | --- |
| Derive | Read requirements before the reference code | Explain the expected outputs independently |
| Implement | Fill only your track’s starter functions | All selected cases pass; the unfinished starter fails |
| Challenge | Introduce an incorrect boundary, source claim or error state | At least one relevant oracle rejects it |
| Review | Explain a plausible mistake and missing production controls | Record limits, not just a green status |

Check tool-result validation, exact simulated approvals, retries and done/error/incomplete/budget. A real API integration still needs account authorization, persistent state and safe recovery. Optional live-tool practice requires authorized access and a usage budget; production writes are outside this sandbox.
