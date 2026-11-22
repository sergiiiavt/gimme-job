# How an AI agent works

An **AI agent** is a language model running in a loop with tools. It reads a task, decides on the next action, such as looking up an order or running a test, sees the result and decides again, until it answers or runs out of budget. The model never executes anything itself: it proposes actions, and the application around it runs them.

This section is about building and using agents: how they work, how to give them tools, and how they connect to the systems you already have. Testing an agent is a separate discipline. It has its own chapter in the course [Evaluating agents and tool use](/learn/llm?topic=agent-testing), and this section links to it where testing comes up.

**Prerequisites:** [Generative AI & LLM overview](/learn/llm?topic=generative-ai-overview), [LLM application anatomy and APIs](/learn/llm?topic=llm-application-anatomy).

## The agent loop

Every agent, from a support bot to a coding assistant, runs the same loop:

```diagram
Application sends the model: instructions + conversation so far + tool definitions
        ↓
Model replies with either a final answer or a tool call: {"name": "lookup_order", "arguments": {"order_id": "A-1042"}}
        ↓
Application checks the call (known tool? valid arguments? allowed for this user?) and runs it
        ↓
Application appends the tool result to the conversation
        ↓
Back to the model                                  (repeat until an answer, an error or the step budget)
```

Three things follow from this picture.

- **The application is in charge.** It decides which tools exist, whether a proposed call is allowed, and when the loop stops. A model that "decides to delete a branch" can only do so if the application gave it a tool that deletes branches and then ran the call.
- **Everything the model knows comes from the conversation.** Tool results are just more text in that conversation. If a result is long, noisy or wrong, the next decision is made on long, noisy or wrong input.
- **The loop needs a stop condition that does not depend on the model.** A step budget, a time limit and a cost limit protect you from a model that keeps calling tools without making progress.

This pattern of alternating reasoning and action, with observations fed back in, was described in the ReAct paper. Provider APIs from Anthropic and OpenAI implement the same contract: you send tool definitions, receive structured tool calls, and return tool results.

## Workflows versus agents

Not every system that calls a model several times is an agent. The useful distinction is who decides the next step.

| System | Who decides the next step | Example |
|---|---|---|
| Single model call | Nobody; there is one step | Summarize a bug report |
| Workflow | Your code, along predefined paths | Classify a vacancy, then extract skills, then score the match |
| Agent | The model, at run time | "Find why this test is flaky and propose a fix" |

A workflow can still use a model at every step and can still branch, but the possible paths are written in code. An agent chooses its own path, including how many steps to take. That freedom is what makes agents useful for open-ended tasks, and also what makes them more expensive, slower and harder to predict.

Most production systems are workflows, and a few well-known patterns cover most of them:

| Pattern | How it works | QA example |
|---|---|---|
| Prompt chaining | Fixed sequence of model calls, each using the previous output | Generate test ideas from a requirement, then turn them into test cases |
| Routing | A first call classifies the input and sends it to a specialised path | Route an incoming bug report to UI, API or data triage prompts |
| Parallelization | Independent calls run at once and are combined | Review one pull request for security, test coverage and naming separately |
| Orchestrator-workers | One model splits the task and delegates parts to other calls | Plan a regression run across services, one worker per service |
| Evaluator-optimizer | One call produces a draft, another critiques it, repeat | Draft a test plan, check it against a checklist, revise |

GimmeJob's own Learning Path Advisor is a workflow, not an agent. It is a fixed graph: rewrite the question in context, retrieve learning material, route to one of two answer paths depending on what was found, compose the answer, then check that the answer is grounded in the retrieved sources. The model writes the text, but the code decides the order of steps.

## When an agent is the wrong tool

Start with the simplest design that works and add autonomy only when it measurably helps. An agent is usually the wrong choice when:

- **The steps are known.** If you can write the sequence down, write it as code or as a workflow. It will be cheaper, faster and repeatable.
- **The result must be reproducible.** Audits, release gates and compliance checks need the same input to give the same decision.
- **Mistakes are expensive and hard to undo.** Payments, deletions and messages to customers need deterministic code paths with explicit approval.
- **The task is long and each step can fail.** Errors compound across steps.

The last point is easy to underestimate. If each step of a run succeeds with probability 0.95 and failures are independent, a run of n steps succeeds with probability 0.95 to the power n:

```python
for steps in [1, 5, 10, 20]:
    print(steps, "steps:", round(0.95 ** steps, 2))
```

Twenty steps at 95% each give a run that succeeds about a third of the time. Real failures are not independent, and agents can recover from some of them, so treat this as a warning, not a forecast. Shorter tasks, fewer and better tools, and checks between steps all push the number back up.

## The parts of an agent you own

A model provider gives you the model. Everything else is yours to design, and each part has its own typical failure.

| Part | What it is | What typically goes wrong |
|---|---|---|
| Instructions | The system prompt: role, goal, rules, when to stop | Vague goals, rules that contradict tool descriptions |
| Tools | The actions the agent can take, with schemas | Too many overlapping tools, unclear descriptions, noisy results |
| Context | What the model sees: conversation, tool results, retrieved documents | Context grows until the important part is lost |
| Limits | Step, time and cost budgets | No budget, so a stuck agent loops until a timeout |
| Permissions | What each tool may touch and for which user | A read task given a tool that can write |
| Approvals | Points where a human must confirm | Consequential actions run without confirmation |
| Traces | A record of every model call, tool call and result | Failures that nobody can reconstruct afterwards |

The next chapters take these one at a time: [tools](/learn/agentic?topic=tool-design) and [the protocol that connects them](/learn/agentic?topic=model-context-protocol) first.

## A minimal agent loop in code

The loop is small enough to write without a framework. In the example below a scripted function stands in for the model, so the code runs without an API key, but the control flow is the one a real agent uses: ask the model, run the proposed tool, feed the result back, stop on an answer or on the budget.

```python
import json

ORDERS = {"A-1042": {"status": "shipped", "carrier": "Nova Post"}}

def lookup_order(order_id):
    order = ORDERS.get(order_id)
    if order is None:
        return {"error": f"No order {order_id}. Ask the user to check the number."}
    return {"order_id": order_id, **order}

TOOLS = {"lookup_order": lookup_order}

def scripted_model(messages):
    # Stands in for the LLM: first asks for a tool, then answers from the tool result.
    last = messages[-1]
    if last["role"] == "user":
        return {"type": "tool_call", "name": "lookup_order", "arguments": {"order_id": "A-1042"}}
    result = json.loads(last["content"])
    return {"type": "answer", "text": f"Order {result['order_id']} is {result['status']} with {result['carrier']}."}

def run_agent(task, max_steps=5):
    messages = [{"role": "user", "content": task}]
    for step in range(1, max_steps + 1):
        reply = scripted_model(messages)
        if reply["type"] == "answer":
            print(f"step {step}: answer")
            return reply["text"]
        tool = TOOLS.get(reply["name"])
        result = tool(**reply["arguments"]) if tool else {"error": f"Unknown tool {reply['name']}"}
        print(f"step {step}: {reply['name']}({reply['arguments']}) -> {result}")
        messages.append({"role": "tool", "content": json.dumps(result)})
    return "Stopped: step budget exhausted."

print(run_agent("Where is my order A-1042?"))
```

Notice what the application does that the model cannot: it looks up the tool by name, refuses unknown tools, turns a missing order into an error message the model can act on, and stops after `max_steps` whatever the model wants. With a real model, `scripted_model` becomes an API call that sends `messages` and the tool definitions and parses the reply. Nothing else changes.

## Reading an agent run

When an agent gives a wrong answer, the final text rarely tells you why. The run does. A useful trace records, for every step, what the model saw, what it proposed, what the application did and what came back:

```text
step 1  model    -> tool_call lookup_order {"order_id": "A-1042"}
step 1  app      -> allowed, executed in 84 ms
step 1  tool     -> {"order_id": "A-1042", "status": "shipped", "carrier": "Nova Post"}
step 2  model    -> answer "Order A-1042 is shipped with Nova Post."
total   2 model calls, 1 tool call, 1,930 input tokens, 0.9 s
```

Read a failed run from the first step where the agent's picture of the world became wrong. Typical causes are a tool the model chose for the wrong reason (often a vague description), a tool result that was misread (often too long or badly structured), an error message that gave no way forward, or a loop with no progress that only the budget stopped. Each of these points back to one of the parts in the table above.

The same habit applies to workflows. The Learning Path Advisor on this site streams a trace of its graph nodes, retrieval results and model calls next to the answer, so you can see which step produced which part of it. How to turn traces into systematic checks of outcomes and trajectories is covered in [Evaluating agents and tool use](/learn/llm?topic=agent-testing).

## Common mistakes

- **Building an agent for a fixed process.** If you can draw the flowchart, you need a workflow.
- **Letting the model decide when to stop.** Always enforce a step, time and cost budget in code.
- **Trusting tool calls because they are well formed.** A syntactically valid call can still be the wrong action, with the wrong arguments, for the wrong user.
- **Feeding raw tool output back into the loop.** Large, noisy results crowd out the task and lead to worse next steps.
- **Adding tools to fix behaviour.** More overlapping tools usually make choices worse; better descriptions and fewer tools make them better.
- **Keeping no trace.** Without a record of each step, failures cannot be explained or reproduced.

## Summary

An agent is a model in a loop that proposes actions while the application decides what actually runs. The difference between a workflow and an agent is who chooses the next step: your code or the model. Choose the simplest design that works, because autonomy costs money, time and predictability, and errors compound across steps. You own everything around the model: instructions, tools, context, limits, permissions, approvals and traces. When a run goes wrong, read it step by step from the first point where the agent's picture of the world became wrong.
