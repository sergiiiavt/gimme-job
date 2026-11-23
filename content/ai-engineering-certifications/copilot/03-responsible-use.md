# Responsible use

15–20% of GH-300. The answer is almost always that the developer stays accountable and validates what Copilot produces.

## Risks and limitations of generative AI

- **Hallucination:** plausible but wrong or outdated APIs, parameters and behaviour.
- **Insecure patterns:** suggestions can repeat vulnerable code seen in training data.
- **Non-determinism:** the same prompt can give different answers.
- **Limited context:** Copilot sees what the editor gives it, not your intranet or unstated requirements.
- **Bias and harmful content:** filters reduce but do not remove it.

## Validate AI output

Treat every suggestion like a colleague's code: read it, test it, and scan it. When Copilot suggests a library method you have never seen, check the documentation or source; asking Copilot to confirm its own suggestion can simply confirm the hallucination.

## Operating Copilot responsibly

- Keep humans in the loop for agentic actions: review agent plans and approve terminal commands.
- Run the same security scanning, code review and testing on AI-generated code as on any other code.
- Do not assume licence compliance; use the public-code filter and code referencing.
- Keep secrets out of files Copilot can read.

## Ownership of outputs

The developer and organization that accept and ship a suggestion own the result, as with any code. Copilot does not take responsibility for correctness, security or licensing.

## Worked example

A team commits Copilot suggestions whenever they compile. That skips review, testing and scanning, the controls that catch hallucinated APIs and insecure patterns. Responsible use means the same gates as human-written code.
