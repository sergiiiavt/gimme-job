# Prompt engineering for effective software testing

Chapter 2 is the heart of the exam: 365 of 815 training minutes and five applied-prompting K3 objectives. GenAI-3.1.2 in chapter 3 is also K3.

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

The **system prompt** is set by the developer or tester, can be changed by the application across requests, is usually not visible to the chatbot user, and defines behaviour, tone and rules. The **user prompt** is the per-turn input from the user and changes each time.

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
| Precision | TP / (TP + FP): how many predicted positives are correct |
| Recall | TP / (TP + FN): how many actual positives are found |
| Relevance and contextual fit | Fit with the context and the test basis |
| Diversity | Range of inputs and scenarios, including edge cases |
| Execution success rate | Share of generated artefacts that run as they are |
| Time efficiency | Time saved compared with manual work |

Because output is non-deterministic, metrics need statistically relevant samples, not a single run.

## Refining prompts

Iterate on prompts, A/B test prompt versions, analyse error types in the output, integrate user feedback, tune prompt length and specificity, and share prompt libraries across teams.

## Five applied cases with independent checks

Use requirement R1: four discount rules in the CTFL worked example.

1. Structure a prompt: role=test analyst; context=checkout; instruction=derive conditions; input=R1; constraint=no invented rule; output=rule/ID/expected result.
2. Analysis: require the four feasible combinations; challenge an output that omits non-members.
3. Design/implementation: generate 99/100 cases for both membership states; compare with the independently specified fixture table before executing generated code.
4. Regression: compare `>=100` with `>100`; identify the changed boundary and dependent invoice behavior.
5. Monitoring/control: from 200 planned, 160 passed, 24 failed and 16 blocked, report 184 executed, 92% execution completion and 87.0% passed/executed. Blocked is not passed. Ask a person to approve a release recommendation.

For expected IDs D1,D2,D3 and predictions D1,D2,D4,D4: TP=2, FP=1, FN=1; precision=2/3 and recall=2/3. Duplicate IDs do not inflate positives.
