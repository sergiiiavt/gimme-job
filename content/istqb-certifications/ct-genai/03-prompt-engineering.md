# Prompt engineering for effective software testing

Chapter 2 is the heart of the exam: 365 of 815 training minutes and every K3 objective.

## The six components of a structured prompt

1. **Role:** the persona the LLM adopts, such as a test automation engineer.
2. **Context:** background, the test object and the functionality under test.
3. **Instruction:** a clear, imperative, concise task.
4. **Input data:** user stories, acceptance criteria, screenshots, code, existing test cases, output examples.
5. **Constraints:** restrictions on how the instruction applies to the input.
6. **Output format:** the expected structure of the response.

Example: "You are a senior tester (role). We are testing the checkout of a web shop (context). Derive test conditions (instruction) from this user story (input data). Cover only the payment step and ignore the UI layout (constraints). Return a numbered list with a priority for each item (output format)."

## Core prompting techniques

- **Prompt chaining:** split a task into steps and check and refine each output before the next. Best for complex tasks that need human verification.
- **Zero-, one- and few-shot prompting:** no example, one example, or several examples in the prompt. Best for repetitive or tightly formatted output such as Gherkin, keyword-driven scripts or report templates.
- **Meta prompting:** the LLM generates or improves prompts, and the tester evaluates them. Best for new or flexible tasks and for drafting a first prompt.

Techniques combine: meta prompting drafts the prompt, few-shot examples fix the format, and chaining validates each subtask.

## System prompt vs user prompt

The **system prompt** is set by the developer or tester, stays constant across the session, is usually not visible to the chatbot user, and defines behaviour, tone and rules. The **user prompt** is the per-turn input from the user and changes each time.

## Applying prompts to test tasks (K3)

| Test task | What GenAI does |
| --- | --- |
| Test analysis | Finds defects in the test basis, generates and prioritises test conditions, supports coverage analysis, suggests techniques |
| Test design and implementation | Generates test cases and privacy-preserving test data, drafts automated scripts, helps schedule and prioritise |
| Automated regression testing | Drafts keyword-driven scripts, supports impact analysis and self-healing tests, analyses reports, clusters defects, suggests root causes |
| Test monitoring and control | Analyses metrics and trends, suggests reprioritisation, drafts completion reports and natural-language dashboards |

## Evaluating results

| Metric | Measures |
| --- | --- |
| Accuracy | Correctness against expert output or standards |
| Precision | Correctness for a specific objective, such as anomalies correctly flagged |
| Recall | Whether all relevant instances were found, such as every partition covered |
| Relevance and contextual fit | Fit with the context and the test basis |
| Diversity | Range of inputs and scenarios, including edge cases |
| Execution success rate | Share of generated artefacts that run as they are |
| Time efficiency | Time saved compared with manual work |

Because output is non-deterministic, metrics need statistically relevant samples, not a single run.

## Refining prompts

Iterate on prompts, A/B test prompt versions, analyse error types in the output, integrate user feedback, tune prompt length and specificity, and share prompt libraries across teams.
