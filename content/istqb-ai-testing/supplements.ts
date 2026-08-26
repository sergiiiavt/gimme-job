export const istqbAiTestingSupplements: Partial<Record<string, string>> = {
  "ai-foundations": String.raw`

## CT-AI terminology checkpoint

For the exam, keep the syllabus distinctions precise:

- **Narrow AI** is the category for deployed task/domain-focused AI systems.
- **Frontier AI** is discussed as advanced state-of-the-art AI while still not being equivalent to general AI.
- **General AI** and **super AI** are distinct concepts from the narrow AI systems deployed today.
- When the syllabus says **ML regression**, it means prediction of continuous values. Do not confuse this with software regression testing after a change.

Use this vocabulary when a question asks you to classify an AI system rather than substituting looser product-marketing terms.`,

  "ai-quality": String.raw`

## Exact Chapter 2 exam vocabulary

For **AI-2.1.1**, learn the quality-characteristic names used by CT-AI v2.0. The syllabus discusses these new or adapted ISO/IEC 25059 characteristics:

- **AI functional correctness** — acceptable correctness must be expressed with measurable error/performance criteria for probabilistic behavior.
- **Functional adaptability** — the system's ability to adapt to changes in its operational environment where adaptation is part of the design.
- **User controllability** — a human or external agent can influence/control the AI system appropriately.
- **Transparency** — stakeholders receive appropriate information about the system, its data, behavior, limitations, or decisions.
- **AI robustness** — acceptable behavior is maintained under relevant variations, disturbances, defects, or hostile conditions.
- **Intervenability** — authorized intervention can stop, alter, or constrain operation when required.
- **Societal and ethical risk mitigation** — the system mitigates unacceptable societal/ethical risks such as discriminatory or harmful behavior.

**Safety** is also a Chapter 2 keyword and has its own learning objective about the special considerations of safety-related AI systems.

Fairness, data quality, explainability, privacy and similar concerns are important test topics, but in an exam question asking specifically for the Chapter 2 / ISO/IEC 25059 quality-characteristic classification, do not replace the syllabus names above with a generic AI-trustworthiness list.

### Classification drill

Classify the primary quality characteristic in each case before looking at any notes:

1. A human operator must be able to cancel an AI-proposed critical action before execution.
2. An adaptive control system must continue meeting agreed behavior after a supported environmental change.
3. A classifier may make errors, but class-specific error rates must remain within approved limits.
4. Documentation must expose the model version, intended use, known limitations and data provenance.
5. Small supported input perturbations must not cause unacceptable behavior changes.

Then explain why one scenario can involve more than one characteristic even when the question asks for the **best** classification.`,

  "machine-learning": String.raw`

## Syllabus taxonomy you must be able to name

For **AI-3.1.1**, the core forms are supervised, unsupervised and reinforcement learning. Within them, remember the syllabus examples:

- supervised → **classification** and **ML regression**;
- unsupervised → **clustering** and **association**;
- reinforcement learning → an agent learns through interaction, rewards and penalties.

## Exact neural-network coverage measures

For **AI-3.4.3**, know what each named measure is trying to exercise:

- **Neuron coverage:** proportion of neurons whose activation/output exceeds the chosen activation threshold during testing.
- **k-multisection neuron coverage (kMNC):** divide a neuron's observed activation range into k sections and measure how many sections tests exercise.
- **Neuron boundary coverage (NBC):** exercise neuron activations outside the lower/upper activation boundaries observed during training.

They are structural adequacy indicators, not proof of functional correctness or generalization.

## Hands-on objective checklist for Chapter 3

The practical work in this guide maps to all Chapter 3 hands-on areas:

- create an ML model;
- perform data preparation supporting model creation;
- evaluate a model with selected functional-performance metrics;
- compare how different model/dataset combinations affect training and behavior;
- experience a simple perceptron implementation.

Add one experiment to Lab 1: train at least two different model configurations or use two different train/test samples, compare their evaluation results, and explain why stochastic/data choices can change the observed behavior.`,

  "testing-ai-systems": String.raw`

## Exact ML test-level distinction

CT-AI v2.0 identifies **two specialized test levels for ML-specific risks**:

1. **Input data testing** — testing the data used for training, testing and prediction, including data quality, representativeness, bias, constraints, labels and pipeline concerns.
2. **ML model testing** — testing the generated ML model itself, including functional performance, robustness and model-specific risks.

Conventional levels still apply where appropriate: **component, component integration, system, system integration, and acceptance testing**. A likely exam trap is to discard conventional levels because the product contains ML.

Examples:

- test a transformation script in isolation → component testing;
- verify the data pipeline feeds the model the intended feature representation → component integration;
- confirm embedding/compression did not degrade model performance in the complete product → system testing;
- verify exchanges with an external AI service → system integration / relevant API integration testing;
- determine whether a third-party AI service is suitable for the intended product → acceptance testing.

## Syllabus hands-on: exploratory LLM + boundary value analysis

In addition to the broader LLM charter earlier in this chapter, perform the syllabus-aligned exercise:

1. Give an LLM a clear requirement containing one or more numeric boundaries.
2. Ask it to generate test cases using **2-value boundary value analysis**.
3. Repeat using **3-value boundary value analysis**.
4. Verify the generated cases manually against the BVA rules.
5. Record missing, duplicate, invalid or misclassified boundary cases.
6. Change the requirement wording and see whether correctness/completeness changes.

The point is not “use AI to test” as a certification scope. The test object in this exercise is the **LLM's ability to perform the requested task correctly and completely**.`,

  "input-data-testing": String.raw`

## Chapter 5 exam techniques to recognize

A complete answer to an input-data-risk scenario may involve more than schema assertions. CT-AI v2.0 includes approaches such as:

- review of data sources, provenance and preparation;
- exploratory data analysis (EDA);
- static analysis/review of preparation or pipeline code;
- dynamic testing of model outcomes across sensitive groups;
- **disparate impact analysis** using realistic counterfactual changes to sensitive attributes and statistical comparison of outcomes;
- data-pipeline testing at component, integration and system levels;
- dataset constraint testing;
- data representativeness testing;
- label correctness testing;
- **multiple annotation** and inter-annotator agreement as evidence about label reliability.

### Disparate-impact drill

For a loan-decision model, create pairs of otherwise-valid applications where a relevant sensitive attribute changes while other decision-relevant facts remain controlled. Run enough cases to evaluate whether the outcome distribution changes materially. Before drawing a bias conclusion, verify the counterfactuals are realistic and that the sample is large enough to support the comparison.

This is stronger than changing one attribute in one record and declaring the system biased from a single output.`,

  "model-testing": String.raw`

## Complete model-risk test toolbox

When **AI-6.1.1** asks for test approaches that mitigate model risks, be ready to recognize the broader toolbox, not only metric testing:

- testing for bias / ethical-system concerns;
- adversarial testing;
- overfitting and underfitting testing;
- drift testing;
- side-effect testing;
- reward-hacking testing where reinforcement/reward behavior is relevant;
- API/interface testing;
- ML functional-performance testing;
- metamorphic testing;
- back-to-back and A/B testing;
- requirements and model-documentation review;
- exploratory and fuzz testing for unexpected inputs;
- performance testing;
- smoke/regression tests around model updates;
- red teaming for security, safety, privacy, or harmful-output risks.

The exam skill is to match the **risk** to the most appropriate **test approach**, not to select every technique.

## Metamorphic K3 drill

Given: an OCR model should recognize a supported printed invoice independently of harmless image metadata.

Derive a source test case and at least three follow-up cases by:

1. defining the source input;
2. defining a valid transformation;
3. stating the metamorphic relation between source and follow-up outputs;
4. specifying any tolerance;
5. explaining what a violation means.

Repeat for a second scenario where the expected relation is **monotonic** rather than invariant. This directly practices the K3 requirement to derive metamorphic test cases from a scenario.`,

  "ml-development-testing": String.raw`

## Deployment-testing taxonomy to memorize

For **AI-7.1.2**, recognize the named deployment test types and the risk each addresses:

- **Installability testing:** installation, configuration, dependencies and supported environments.
- **Rollback testing:** prove the model/system can return to a known stable version after a bad rollout.
- **Canary testing:** expose a small controlled portion of real traffic to the new deployment and watch agreed metrics before expansion.
- **Shadow testing:** send live requests to the new model in parallel without letting its result affect the live response; compare it with the current model.
- **Model conversion testing:** after converting/compressing/quantizing to a deployment format, re-check predictive behavior and operational efficiency.
- **Cross-device / device-compatibility testing:** verify intended devices/edge/cloud targets behave acceptably.
- **API testing:** verify the deployed ML service contract, input/output handling, errors and integration behavior.

### Canary vs shadow vs A/B vs back-to-back

- **Canary:** small live exposure to the new deployment; it can affect those selected users.
- **Shadow:** duplicate live traffic to the candidate model, but its answer does not control the user-facing result.
- **A/B:** controlled live experiment comparing alternatives as treatments and outcomes.
- **Back-to-back:** feed comparable/same inputs to implementations and analyze output differences to detect defects/regressions.

These techniques can be combined in a rollout, but they answer different questions.`,
};

export default istqbAiTestingSupplements;
