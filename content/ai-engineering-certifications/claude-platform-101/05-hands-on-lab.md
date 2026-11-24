# Hands-on lab: a vacancy-research agent

One lab that touches every section of Claude Platform 101. It needs an API key from the Claude Console and Python or TypeScript with the official SDK. Set a low spend limit on the workspace before you start.

## 1. First call and model choice

1. Send one request that classifies a job title as QA, development or other, and print content, stop_reason and usage.
2. Run the same 15 real job titles through a Haiku-tier and a Sonnet-tier model. Record accuracy, latency and tokens in a small table, and pick the cheaper model if it is accurate enough.

## 2. A hand-written agent loop

1. Define a search_vacancies tool with a clear description, an input_schema with role, remote and posted_within_days, and a stub that returns sample data.
2. Write the loop: run tools while stop_reason is tool_use, send each tool_result with the matching tool_use_id, and stop on end_turn or after 8 iterations.
3. Make the stub fail once and return is_error with a reason. Check that Claude retries or explains instead of reporting "no vacancies".

## 3. Tool Runner

Replace your loop with the SDK's Tool Runner and confirm that you get the same final answer. Note what you lost, such as a place to ask for approval, and when you would go back to the manual loop.

## 4. Extend it

1. Add web search as a built-in tool and ask about a company you might apply to. Check the citations.
2. Turn on extended thinking for "rank these five vacancies for a QA lead moving into AI testing" and compare the answer with thinking off.

## 5. Optional: managed agent

Recreate the agent as a managed agent, start a session, send a user message event and stream the events back. Compare the code you did not have to write with section 2.

## What to keep

A small repository with the loop, the model comparison table and a README stating what each section taught you. That is a concrete answer to "What have you built with LLM APIs?"
