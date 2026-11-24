# Managing risks of generative AI in software testing

Chapter 3 covers what goes wrong and how a test team keeps control.

## Hallucinations, reasoning errors and biases

- **Hallucination:** output that is factually incorrect or irrelevant to the task, such as fictitious test cases, scripts that do not run, or acceptance criteria that do not exist.
- **Reasoning error:** misinterpreted logic, such as cause and effect, conditions or step order, leading to wrong conclusions. It matters most in test planning and prioritisation.
- **Bias:** a skew from training data that favours certain information or approaches, such as underrepresenting non-functional tests or non-English perspectives.

## Detecting them

| Problem | Detection |
| --- | --- |
| Hallucination | Cross-check against documentation, ask a domain expert, check consistency |
| Reasoning error | Review the logic; run generated tests against the test object |
| Bias | Check that testware reflects the test strategy and a balanced mix of test types |

## Mitigation

Provide complete context, split prompts into steps (chaining), use clear data formats, choose a model suited to the task, and compare results across models. RAG and fine-tuning, in chapter 4, also improve results.

## Non-determinism

Lower **temperature** reduces randomness and improves consistency, at the cost of creativity and diversity. A fixed **random seed**, where supported, helps reproducibility. Full reproducibility cannot be guaranteed, so automate parts of output verification.

## Data privacy and security

- **Privacy risks:** sensitive data exposed in outputs, no control over how data is stored and used, compliance violations such as GDPR.
- **Security risks:** vulnerabilities in LLM-powered test infrastructure, exploitation of LLM weaknesses, malicious input data.
- **Attack vectors:** context manipulation (overloading the context window to expose training data fragments) and request manipulation (inputs such as images that steer the model into a different context).

**Mitigations:** data minimisation; anonymisation and pseudonymisation; secure storage and transmission; training and policies; systematic human review of output; cross-evaluation across several LLMs; a secure operating environment (commercial secure offering, secure cloud or in-house); regular security audits; keeping up with best practice. Involve security engineers, legal counsel, the CTO or the CISO.

## Energy consumption

Task complexity and model size drive energy use, and small interactions add up across millions of users. Generating one image with a powerful model can use as much energy as fully charging a smartphone; generating text uses a small share of that. Limit unnecessary model interactions.

## Regulations, standards and frameworks

| Name | Type |
| --- | --- |
| ISO/IEC 42001:2023 | Standard for AI management systems |
| ISO/IEC 23053:2022 | Framework for ML-based AI systems |
| EU AI Act | Regulation with risk-based classification |
| NIST AI RMF | US framework for fairness, transparency and security |
