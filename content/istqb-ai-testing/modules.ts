const PYTHON = "```python";
const TEXT = "```text";
const END = "```";

export interface LearningVideoReference {
  channel: string;
  channelUrl: string;
  title: string;
  videoId: string;
}

export interface IstqbAiTestingModule {
  id: string;
  label: string;
  navLabel: string;
  level: string;
  count: number;
  description: string;
  sourceIds: string[];
  videos?: LearningVideoReference[];
  markdown: string;
}

export const istqbAiTestingModules: IstqbAiTestingModule[] = [
  {
    id: "exam-plan",
    label: "Exam map & study plan",
    navLabel: "Exam map",
    level: "Start here",
    count: 8,
    description: "Know exactly what CT-AI v2.0 covers, how the exam is scored, what is examinable, and how to turn this guide into a study plan.",
    sourceIds: ["istqb-ctai-page", "istqb-ctai-syllabus-v2", "istqb-ctai-sample-questions-v22", "istqb-ctai-sample-answers-v22", "istqb-ctai-faq", "istqb-glossary"],
    videos: [
      {
        channel: "iSQI Group",
        channelUrl: "https://www.youtube.com/@iSQIGroup",
        title: "The ISTQB Certified Tester AI Testing (CT-AI v2.0) is now available!",
        videoId: "06yTuv7jA9k",
      },
    ],
    markdown: String.raw`# Exam map & study plan

This learning path targets **ISTQB Certified Tester AI Testing (CT-AI) v2.0**, the current syllabus. It prepares you to test AI-based systems. It is deliberately **not** a course about using ChatGPT or other generative-AI tools to perform ordinary software testing; ISTQB moved that topic into the separate CT-GenAI certification.

## Exam facts to memorize before studying

- **Prerequisite:** ISTQB Certified Tester Foundation Level (CTFL).
- **Questions:** 40 multiple-choice questions.
- **Total points:** 44.
- **Pass score:** 29 points, equivalent to 65% of the available points.
- **Time:** 60 minutes.
- **Non-native language allowance:** 25% additional time where applicable.
- **Syllabus version:** CT-AI v2.0, General Availability 17 April 2026.
- **Self-study:** explicitly supported by ISTQB using the syllabus, sample exam, and related material.

Do not convert “29 points” into “29 correct questions.” Some exam items can have different point values; use the official exam structure rather than assuming every question is worth exactly one point.

## What is actually examinable

The syllabus learning objectives use cognitive levels **K1–K4**. Treat them differently:

- **K1 — Remember:** terminology, definitions, lists, recognition.
- **K2 — Understand:** explain, distinguish, classify, interpret.
- **K3 — Apply:** calculate, select, use a technique in a scenario.
- **K4 — Analyze:** reason across a scenario, compare evidence, identify consequences or the best test approach.

The exam is based on these learning objectives and the syllabus sections supporting them. The hands-on objectives are there to build skill and understanding, but are not directly examined as practical computer tasks. This guide still includes every hands-on area because doing the work makes K2–K4 questions substantially easier.

## Official chapter map

The current syllabus has seven chapters. Recommended accredited-training time is **1,170 minutes (19.5 hours)** before revision and mock exams:

1. **Introduction to Artificial Intelligence — 120 min**
2. **Quality Characteristics for AI-Based Systems — 45 min**
3. **Machine Learning — 375 min**
4. **Testing AI-Based Systems — 195 min**
5. **Input Data Testing — 180 min**
6. **Model Testing — 225 min**
7. **Machine Learning Development Testing — 30 min**

The distribution tells you where to spend effort. Machine learning, model testing, system testing, and input-data testing deserve much more revision time than the short final chapter.

## Coverage matrix for this guide

Nothing in the seven syllabus chapters is intentionally skipped. The learning path maps them as follows:

- **Chapter 1:** conventional vs AI systems; narrow/general/super AI; AI technologies; generative AI; AI hardware; developing and hosting models; ML frameworks; regulations and standards → **AI foundations**.
- **Chapter 2:** AI-specific quality characteristics; AI and safety; measurable acceptance criteria → **AI quality & acceptance**.
- **Chapter 3:** ML forms; workflow; creating a model; pretrained models, fine-tuning and RAG; data preparation; classification metrics; neural networks and neural-network coverage → **Machine learning**.
- **Chapter 4:** locked/adaptive systems; statistical testing; oracle problem; GenAI/LLM testing; red teaming; exploratory LLM testing; ML-specific test levels; risk-based strategy → **Testing AI systems**.
- **Chapter 5:** input-data risks; bias; pipeline testing; representativeness; constraints; label correctness; hands-on data checks → **Input data testing**.
- **Chapter 6:** model risks; model documentation/reviews; probabilistic performance; adversarial testing; metamorphic testing; drift; over/underfitting; A/B; back-to-back → **Model testing**.
- **Chapter 7:** ML-development risks and deployment testing → **ML development & deployment**.

The final two sections add **hands-on labs**, a **40-question original mock exam**, and an **exam-day review sheet**.

## Recommended study sequence

Use a three-pass method instead of reading the syllabus repeatedly.

**Pass 1 — Build the mental model.** Read each chapter in this guide, then skim the matching official syllabus section. Your goal is comprehension, not memorization.

**Pass 2 — Make it executable.** Complete the practical task at the end of every chapter. For calculations, work without looking at the formula first. For test-design topics, write actual test cases, oracles, properties, and risks.

**Pass 3 — Exam mode.** Take the official sample exam under time pressure, review every wrong answer against the syllabus, then take the original mock in this guide. A correct guess counts as a weakness until you can explain why the distractors are wrong.

## A practical 14-day plan

- **Days 1–2:** AI foundations + quality characteristics.
- **Days 3–6:** machine learning, including all metric calculations and neural-network basics.
- **Days 7–8:** testing AI systems and LLMs.
- **Days 9–10:** input-data testing.
- **Days 11–12:** model testing + ML development/deployment.
- **Day 13:** hands-on labs + terminology review.
- **Day 14:** official sample exam, original mock exam, targeted revision.

If you already work with ML systems, compress the introductory chapters but do not skip ISTQB terminology. Certification questions often test distinctions that experienced engineers understand informally but name differently.

## Readiness rule

You are ready when you can do all four of these without notes:

1. Explain the lifecycle from data acquisition to deployed-model monitoring and name the main test risks at each stage.
2. Calculate and interpret classification metrics from a confusion matrix and choose the metric that matches the business risk.
3. Design tests for a probabilistic or generative system where exact expected outputs are unavailable.
4. Distinguish input-data testing, model testing, component/system testing, deployment testing, and production monitoring.

**Practice:** create a one-page progress sheet with the seven chapters, K-level weaknesses, lab status, official sample score, and mock-exam score. Re-study by weakness, not by chapter order.`
  },
  {
    id: "ai-foundations",
    label: "1. Introduction to Artificial Intelligence",
    navLabel: "1. AI foundations",
    level: "Syllabus chapter 1 · 120 min",
    count: 8,
    description: "Build the AI vocabulary and system context needed to reason correctly about later testing questions.",
    sourceIds: ["istqb-ctai-syllabus-v2", "istqb-glossary", "google-ml-crash-course", "nist-ai-rmf"],
    markdown: String.raw`# 1. Introduction to Artificial Intelligence

The exam does not require you to become a data scientist. It does require a tester to understand what makes an AI-based system materially different from conventional deterministic software and how those differences change test strategy.

## AI-based systems versus conventional systems

Conventional software usually implements behavior explicitly through code and rules. Given the same state and input, deterministic code should normally produce the same output. AI-based behavior may instead be learned from data and may be probabilistic. The implementation therefore includes more than source code: **training data, validation data, model architecture, learned parameters, preprocessing, configuration, inference runtime, and often external foundation models**.

Testing consequence: a passing unit test for application code does not establish that the learned behavior is correct, representative, robust, safe, or stable after data changes.

A useful decomposition is:

- **Conventional part:** routing, API contracts, permissions, persistence, UI, deterministic calculations.
- **AI part:** feature extraction, model inference, ranking/classification/generation, confidence or probability outputs.
- **Integration boundary:** how deterministic application logic interprets uncertain model output.

**Example:** an expense app uses a model to classify receipt images. “File upload accepts JPEG” is conventional behavior. “A restaurant receipt is categorized as meals with acceptable error rates across languages and lighting conditions” is AI behavior.

## Narrow, general and super AI

For exam purposes, distinguish scope rather than marketing claims:

- **Narrow AI:** designed for a bounded task or domain, such as fraud scoring, object detection, translation, or recommendation.
- **Artificial General Intelligence (AGI):** hypothetical/general capability across a broad range of cognitive tasks comparable to general human intelligence.
- **Super AI:** hypothetical capability exceeding human intelligence broadly.

Most real systems you test today are narrow AI, even when a foundation model can perform many tasks.

## Families of AI technology

Recognize common technology families and the testing implications they introduce:

- **Machine learning:** behavior learned from data rather than encoded entirely as rules.
- **Deep learning / neural networks:** multi-layer learned representations; can be powerful but difficult to explain and highly data-dependent.
- **Natural-language processing:** text understanding or generation; introduces ambiguity, language variation, semantic equivalence, and harmful-content risks.
- **Computer vision:** image/video inputs; sensitive to lighting, viewpoint, occlusion, resolution, and adversarial perturbation.
- **Robotics/autonomous systems:** perception plus action; safety, real-time constraints, environment interaction, sensors, and fallback behavior become central.
- **Knowledge/rule-based approaches:** more explicit logic; often easier to inspect but still can combine with learned components.

Do not equate “AI” with “LLM.” CT-AI covers both traditional ML and generative AI.

## Generative AI

Generative AI produces new content such as text, images, audio, video, or code. Large language models generate sequences probabilistically from learned patterns. Important testing consequences include:

- different valid outputs for the same prompt;
- hallucination or unsupported claims;
- sensitivity to prompt wording and context;
- safety-policy bypasses;
- prompt injection and untrusted retrieved content;
- quality that is multidimensional rather than a single right/wrong result.

A tester therefore needs properties, rubrics, statistical samples, reference sets, human or model-assisted evaluation, and red-team scenarios rather than only exact-string assertions.

## Hardware matters

Model training and inference can depend on CPUs, GPUs, TPUs/AI accelerators, memory, storage bandwidth, and device-specific runtimes. The hardware choice can affect latency, throughput, energy use, numerical precision, supported operations, and sometimes model outputs.

**Testing example:** a vision model validated on a datacenter GPU is converted to a lower-precision mobile format. Re-test functional performance, latency, memory, thermal behavior, and representative devices after conversion. Treat the converted artifact as a new test object, not merely a deployment detail.

## Developing and hosting AI models

A model can be:

- built and trained internally;
- fine-tuned from a pretrained model;
- consumed as a third-party hosted API;
- deployed to your own cloud/runtime;
- executed on-device or at the edge.

Each option changes controllability and observability. With a third-party API you may not control model weights or update timing, so contract testing, version pinning where available, monitoring, fallback behavior, and regression datasets become more important.

## ML development frameworks

Frameworks such as TensorFlow, PyTorch, scikit-learn and related tooling provide model construction, training, evaluation and serialization. A tester does not need to memorize APIs, but should understand that framework/runtime/library versions are part of reproducibility and deployment risk.

Two model files with identical names are not enough evidence of identical behavior if preprocessing code, dependency versions, random seeds, hardware kernels, or data snapshots differ.

## Regulations, standards and governance

AI systems can be subject to legislation, sector rules, contractual controls and technical standards. The tester’s role is not to give legal advice; it is to translate applicable obligations and quality expectations into **testable acceptance criteria, evidence, traceability, monitoring, and release controls**.

For this syllabus, ISO/IEC 25059 is especially important because it provides an AI-system quality model. NIST AI RMF is a useful practical companion for risk thinking. Regulations may evolve faster than certification syllabi, so separate “what the exam expects” from “what the current law requires in a specific deployment.”

## Exam traps

- Assuming every AI system is adaptive in production. Many deployed models are **locked** until deliberately replaced.
- Calling an LLM “general AI” simply because it supports many tasks.
- Testing only application code and ignoring data/model artifacts.
- Treating a hosted model API as risk-free because another company owns the model.
- Confusing a probabilistic result with a random or untestable result.

**Practice:** choose one AI feature you know. Draw its boundary with four boxes: input/data processing, model, application logic, external dependencies. Under each box list two risks and one test. Then state whether the model is locked or adaptive and what evidence would prove your answer.`
  },
  {
    id: "ai-quality",
    label: "2. AI quality & acceptance criteria",
    navLabel: "2. AI quality",
    level: "Syllabus chapter 2 · 45 min",
    count: 3,
    description: "Turn AI-specific quality characteristics and safety concerns into measurable acceptance criteria.",
    sourceIds: ["istqb-ctai-syllabus-v2", "iso-25059", "nist-ai-rmf"],
    markdown: String.raw`# 2. AI quality & acceptance criteria

A model can be highly accurate and still be an unacceptable product. CT-AI expects you to reason about **quality characteristics** that become especially important for AI systems and to turn vague statements such as “the model must be fair” into measurable test conditions.

## AI-specific quality characteristics

Learn the characteristics in the wording and grouping used by the current syllabus/ISO model. More importantly, understand how each becomes observable evidence. Typical AI-specific concerns include behavior around:

- **functional adaptability / ability to cope with changing conditions** where relevant;
- **transparency and explainability** of behavior and decisions;
- **controllability** and the ability for authorized humans/systems to direct, constrain, stop, or override behavior;
- **robustness** against variations, noise, unusual inputs, and attacks;
- **fairness / freedom from inappropriate bias** across relevant groups or conditions;
- **data quality and representativeness** because learned behavior depends on data;
- **safety** where model behavior can contribute to harm.

Use the official syllabus as the exam vocabulary source. Standards evolve, so do not substitute a newer terminology list for the version the exam is based on.

## Quality characteristics interact

Quality goals can conflict. Maximizing one measure in isolation may reduce another.

**Example:** a fraud model can lower the decision threshold to catch more fraud. Recall rises, but false positives may block legitimate customers. The correct acceptance criteria depend on business loss, customer harm, review capacity, and safety/compliance constraints.

**Example:** an LLM may be constrained to refuse uncertain medical advice. That can reduce harmful responses but can also reduce usefulness. Test both safety and task effectiveness; neither metric alone proves acceptable quality.

## AI and safety

Safety analysis starts with consequences, not model architecture.

Ask:

1. What hazardous outcome can the AI contribute to?
2. Who or what can be harmed?
3. Under which operational conditions does risk increase?
4. What preventive, detective and recovery controls exist?
5. Which controls are outside the model itself?

For safety-related systems, test the complete control loop: model output, application interpretation, human override, safe-state behavior, alarms, logging, and recovery. A high model score cannot compensate for an unsafe integration decision.

## Write measurable acceptance criteria

Bad criterion: **“The model should be accurate and unbiased.”**

Better criterion:

- On the frozen acceptance dataset, emergency-case recall shall be at least 0.97.
- Recall shall be measured separately for each clinically relevant subgroup with at least the agreed sample size.
- No subgroup recall shall be more than 0.03 below the overall recall without documented risk acceptance.
- The 95th-percentile inference latency on the target device shall stay below 250 ms.
- When confidence is below the operational threshold, the system shall route the case to manual review rather than auto-decide.

Now every statement points to a test object, dataset, metric, threshold, environment, and expected behavior.

## Acceptance-criteria checklist

For each criterion identify:

- **population / operating domain** being claimed;
- **dataset or live sample** used for measurement;
- **metric** and exact calculation;
- **threshold** and confidence/tolerance where relevant;
- **subgroups / slices** that need separate evidence;
- **hardware/runtime/model version** under test;
- **fallback behavior** outside the acceptable region;
- **owner** who accepts residual risk.

## Exam traps

- “Accuracy ≥ 95%” without specifying the dataset or population is not enough.
- A global metric can hide failures in rare classes or subgroups.
- Explainability is not the same as correctness.
- Fairness is not automatically proven by equal overall accuracy.
- Safety is a system property; do not restrict safety testing to the model component.

**Practice:** rewrite these three requirements as measurable criteria: “recommendations must be fair,” “the chatbot must be safe,” and “the detector must be reliable.” For each, include dataset/population, metric, threshold, slice, fallback, and environment.`
  },
  {
    id: "machine-learning",
    label: "3. Machine Learning",
    navLabel: "3. Machine learning",
    level: "Syllabus chapter 3 · 375 min",
    count: 7,
    description: "Understand ML forms, the workflow, data preparation, pretrained models/RAG, classification metrics, neural networks, and coverage well enough to solve K3 questions.",
    sourceIds: ["istqb-ctai-syllabus-v2", "google-ml-crash-course", "sklearn-model-evaluation", "sklearn-confusion-matrix"],
    videos: [
      {
        channel: "StatQuest with Josh Starmer",
        channelUrl: "https://www.youtube.com/@statquest",
        title: "Machine Learning Fundamentals: The Confusion Matrix",
        videoId: "Kdsp6soqA7o",
      },
      {
        channel: "3Blue1Brown",
        channelUrl: "https://www.youtube.com/@3blue1brown",
        title: "But what is a neural network? | Deep learning chapter 1",
        videoId: "aircAruvnKk",
      },
    ],
    markdown: String.raw`# 3. Machine Learning

This is the largest syllabus chapter. The exam expects both conceptual understanding and application: you should be able to reason about the workflow, select data and evaluation approaches, and calculate classification metrics.

## Forms of machine learning

**Supervised learning** learns from labeled examples. Typical tasks:

- classification: spam/not spam, defect class, disease category;
- regression: price, remaining useful life, demand.

**Unsupervised learning** works without target labels to discover structure, for example clustering or dimensionality reduction.

**Reinforcement learning** learns actions through interaction and rewards. Test design must consider policy behavior, exploration, environment assumptions, reward specification, and potentially long sequences of actions.

**Semi/self-supervised approaches** may use a mixture of limited labels and large unlabeled datasets. For the exam, focus on the distinctions and consequences described in the syllabus rather than collecting every modern ML taxonomy term.

## The ML workflow

A practical lifecycle is:

1. define the problem and measurable success criteria;
2. acquire/select data;
3. inspect and prepare data;
4. split data appropriately;
5. choose features/model/architecture;
6. train;
7. validate and tune;
8. evaluate on held-out evidence;
9. package and integrate;
10. deploy;
11. monitor data, model and system behavior;
12. retrain or replace under controlled change.

Testing is not a final box. Test activities exist around data, pipeline code, model behavior, integrations, deployment, and monitoring.

## Train, validation and test data

- **Training set:** used to fit learned parameters.
- **Validation set:** used during development for model selection, tuning and decisions.
- **Test set:** held back for an unbiased final evaluation of the selected model.

A crucial failure is **data leakage**: information from the target, future, validation/test population, or duplicates leaks into training and creates unrealistic performance.

**Example:** randomly splitting rows from the same patient across train and test can let the model recognize patient-specific patterns. A group-aware split by patient may be required.

## Pretrained models, fine-tuning and RAG

A **pretrained/foundation model** has already learned from a large source dataset. You can use it directly, adapt it through fine-tuning, or augment its input with retrieved information.

**Fine-tuning** changes model parameters using additional training data. Regression testing must cover the intended improvement and unintended capability/safety degradation.

**Retrieval-Augmented Generation (RAG)** retrieves external documents/chunks and supplies them as context to a generative model. Testing must separate:

- retrieval quality: was relevant evidence found?
- context construction: was the right content passed and safely delimited?
- generation: did the model use the evidence correctly?
- end-to-end answer quality: is the final response correct, grounded and appropriate?

Do not call RAG “training.” Retrieval changes runtime context; it does not by itself update model weights.

## Data preparation

Common steps include validation, cleaning, deduplication, missing-value treatment, normalization/standardization, encoding categorical values, feature engineering, balancing/sampling, augmentation, and labeling.

Every transformation can introduce defects. Therefore the pipeline itself needs tests: schema, types, ranges, row counts, null rates, category mappings, deterministic transformations where expected, and train/serve consistency.

## Confusion matrix

For a binary classifier:

- **TP:** positive case predicted positive.
- **TN:** negative case predicted negative.
- **FP:** negative case incorrectly predicted positive.
- **FN:** positive case incorrectly predicted negative.

From those values:

- **Accuracy** = (TP + TN) / (TP + TN + FP + FN)
- **Precision** = TP / (TP + FP)
- **Recall / sensitivity** = TP / (TP + FN)
- **Specificity** = TN / (TN + FP)
- **F1** = 2 × precision × recall / (precision + recall)

### Worked example

Suppose TP=36, FP=9, FN=4, TN=51. Total = 100.

- Accuracy = (36 + 51) / 100 = **0.87**.
- Precision = 36 / 45 = **0.80**.
- Recall = 36 / 40 = **0.90**.
- Specificity = 51 / 60 = **0.85**.
- F1 = 2 × 0.80 × 0.90 / 1.70 ≈ **0.847**.

The correct metric depends on consequences. If a missed positive is dangerous, recall may dominate. If false alarms are extremely costly, precision or specificity may matter more. “Highest accuracy” is not an automatic answer.

### Class imbalance trap

If only 1% of transactions are fraudulent, a classifier that predicts “not fraud” for every row is 99% accurate and useless. Always inspect class-specific metrics and business impact.

## Thresholds change trade-offs

Many classifiers output a score/probability and use a threshold to produce a class. Moving the threshold changes FP/FN behavior. A threshold is therefore part of the product decision and test configuration, not just an internal model detail.

Test threshold behavior against explicit risk and acceptance criteria.

## Neural networks

A simple artificial neuron combines inputs and weights, adds a bias, then applies an activation function. Training adjusts weights to reduce a loss/error signal.

${TEXT}
inputs x weights -> weighted sum + bias -> activation -> output
${END}

Layers of neurons can learn progressively useful representations. Key testing implications include sensitivity to data, non-linear behavior, large input spaces, limited explainability, stochastic training, and the possibility that two training runs differ.

### Perceptron intuition

For inputs x1 and x2 with weights w1 and w2 and bias b:

${TEXT}
z = x1*w1 + x2*w2 + b
output = 1 if z >= 0 else 0
${END}

If x1=1, x2=0, w1=0.8, w2=-0.3, b=-0.2, then z=0.6 and the output is 1. You do not need deep calculus to solve this kind of reasoning task.

## Neural-network coverage

Traditional code coverage does not tell you how broadly a neural network’s internal behavior has been exercised. Neural-network coverage criteria attempt to measure activation or structural behavior inside the network. They can help reveal unexercised behavior but do **not** prove correctness, safety, or complete input-space coverage.

Treat coverage as one signal for test adequacy, not a quality guarantee.

## Hands-on: build and evaluate a tiny classifier

The point is to make the lifecycle concrete, not to memorize scikit-learn syntax.

${PYTHON}
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.model_selection import train_test_split

X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)

model = LogisticRegression(max_iter=500)
model.fit(X_train, y_train)
pred = model.predict(X_test)

print(confusion_matrix(y_test, pred))
print(classification_report(y_test, pred))
${END}

For the lab, identify which artifacts correspond to data, preprocessing, model, learned parameters, evaluation data and metric output. Then deliberately make one bad change—remove stratification, duplicate test rows into training, or reduce training data—and explain why the new score is or is not trustworthy.

**Practice:** without notes, calculate accuracy, precision, recall and F1 for TP=42, FP=14, FN=8, TN=136. Then write which metric you would prioritize for (a) cancer screening and (b) auto-blocking legitimate bank transfers, with one sentence explaining the cost of the relevant error.`
  },
  {
    id: "testing-ai-systems",
    label: "4. Testing AI-Based Systems",
    navLabel: "4. Testing AI",
    level: "Syllabus chapter 4 · 195 min",
    count: 8,
    description: "Design tests when outputs are probabilistic, exact oracles are weak, LLMs are involved, or model risk must drive the strategy.",
    sourceIds: ["istqb-ctai-syllabus-v2", "nist-ai-rmf", "nist-genai-profile", "istqb-glossary"],
    markdown: String.raw`# 4. Testing AI-Based Systems

AI does not remove the need for ordinary software testing. It adds new failure modes and makes some traditional techniques insufficient on their own.

## Locked versus adaptive AI systems

A **locked** model does not change its learned behavior during normal production operation. It may later be retrained and redeployed as a controlled release.

An **adaptive** system can update behavior after deployment based on new data, feedback, or online learning.

Testing consequence: adaptive behavior increases the importance of continuous monitoring, change detection, rollback, online guardrails, updated acceptance evidence, and controls over what data can influence learning.

Do not assume an externally hosted model is locked merely because your application code is unchanged; the provider may change the model behind an alias unless versioning guarantees say otherwise.

## Why statistical testing is necessary

A deterministic function can often be checked input-by-input against exact outputs. ML behavior is evaluated over **populations and distributions**. You therefore need representative samples and aggregate evidence such as error rates, confidence intervals, per-slice performance, and repeated runs where non-determinism matters.

A single successful AI example is anecdotal. A single failure can still be important, especially for safety or security, but general quality claims require population-level evidence.

## The test-oracle problem

A **test oracle** determines whether observed behavior is acceptable. AI makes oracles difficult when:

- multiple outputs are valid;
- ground truth is expensive or subjective;
- outputs are probabilistic;
- the expected result changes with context;
- a generative output is semantically correct but not textually identical.

Useful alternatives include:

- reference datasets with trusted labels;
- human expert review;
- invariants and business rules;
- metamorphic relations;
- differential/back-to-back comparison;
- statistical thresholds;
- rubrics with multiple quality dimensions;
- consensus or adjudication among reviewers.

An LLM-as-judge can be a tool, but it is not automatically ground truth. Validate the judge, monitor bias/position effects, and use human review for high-risk decisions.

## Testing generative AI and LLMs

Separate test dimensions rather than asking “is the chatbot good?”

- **Task effectiveness:** does it solve the intended task?
- **Groundedness/factuality:** are claims supported by allowed evidence?
- **Relevance:** does it address the user request?
- **Instruction following:** does it respect system/business constraints?
- **Safety:** does it refuse or safely handle prohibited/high-risk requests?
- **Robustness:** does behavior survive paraphrases, noise, long context, multilingual input, and adversarial prompts?
- **Consistency:** how much does output quality vary across repeated samples?
- **Security/privacy:** prompt injection, data leakage, tool misuse, untrusted content.
- **Performance/cost:** latency, token use, rate limits, fallback behavior.

Exact-string comparison is appropriate only when the requirement itself is exact, such as a strict JSON enum or mandatory literal token.

## Red teaming

Red teaming is adversarial exploration designed to expose harmful, unsafe, insecure or policy-violating behavior. It is broader than ordinary positive/negative functional testing.

A useful red-team campaign varies:

- attacker intent;
- prompt framing and encoding;
- multi-turn escalation;
- indirect prompt injection through retrieved/web content;
- role-play and authority claims;
- tool access and permissions;
- sensitive-data requests;
- language and obfuscation;
- boundary cases between allowed and disallowed behavior.

Record both **attack success rate** and the quality of safe behavior. A model that refuses every request may be safe against one metric but useless.

## Exploratory testing of an LLM

Use a charter instead of random chatting.

**Example charter:** “Explore whether the customer-support assistant reveals hidden account information when a user changes identity claims across a long conversation.”

Define:

- mission and risk;
- personas and prompt families;
- what evidence counts as a failure;
- variations to try;
- session notes and reproducible transcripts;
- model/configuration/version;
- follow-up automated regression cases for important discoveries.

### Hands-on LLM exercise

Pick a public or sandbox LLM and test a narrow requirement: “Answer questions only from the supplied policy text and say when evidence is absent.” Create at least 20 prompts across:

1. directly answerable questions;
2. paraphrases;
3. questions whose answer is absent;
4. misleading user assumptions;
5. instructions to ignore the policy;
6. conflicting text inside the supplied context;
7. multilingual variants;
8. long-context distractions.

Create a rubric with **groundedness, correctness, refusal/abstention correctness, and instruction following**. Run important prompts more than once. Summarize failure rate by category rather than reporting one overall “accuracy.”

## ML-specific test levels

ML systems introduce test objects that deserve explicit separation. At minimum reason about **model-level testing** and broader **system/integration-level testing** alongside conventional component testing.

Model-level evidence asks whether the learned component satisfies functional-performance and robustness expectations on appropriate data. System-level evidence asks whether the entire product uses that model safely and correctly, including preprocessing, postprocessing, fallback, UI/API behavior, permissions, logging and operational conditions.

A model can pass while the system fails—for example, the application swaps class labels or uses the wrong threshold.

## Risk-based test strategy for ML

Start with product risks, then map them to lifecycle controls.

**Example: resume-screening model**

- Risk: discriminatory ranking → representative data checks, subgroup metrics, fairness analysis, human review controls.
- Risk: irrelevant adversarial text manipulates ranking → robustness/adversarial tests.
- Risk: model performance degrades as job market changes → production drift monitoring and periodic labeled evaluation.
- Risk: wrong model version deployed → artifact/version verification and deployment smoke tests.
- Risk: private CV data leaks to third party → privacy/security tests and data-flow review.

The strategy should state scope, risks, test levels, datasets, metrics, thresholds, environments, monitoring, ownership and residual risk—not just a list of test techniques.

## Exam traps

- “AI is non-deterministic, therefore exact tests are impossible” is false. Deterministic contracts around the AI still have exact expectations.
- One human reviewer is not a robust oracle for subjective quality.
- Red teaming is not only security penetration testing; it can target harmful or policy-violating model behavior.
- Passing model metrics does not prove system quality.
- Statistical testing does not mean accepting any individual severe failure.

**Practice:** design a risk-based strategy for an AI meeting-summary product. Include at least five risks, a test level for each, oracle/evaluation method, dataset/sample approach, metric or evidence, and release/monitoring criterion.`
  },
  {
    id: "input-data-testing",
    label: "5. Input Data Testing",
    navLabel: "5. Input data",
    level: "Syllabus chapter 5 · 180 min",
    count: 7,
    description: "Test the data and data pipeline that shape learned behavior: risks, bias, representativeness, constraints, labels, and transformations.",
    sourceIds: ["istqb-ctai-syllabus-v2", "nist-ai-rmf", "google-ml-crash-course"],
    markdown: String.raw`# 5. Input Data Testing

For ML systems, input data is part of the implementation. Bad data can produce a model that is perfectly trained to do the wrong thing.

## Major input-data risks

Look for:

- missing, malformed, corrupted or duplicated records;
- wrong units, timestamps, encodings or categories;
- target leakage or future information;
- sampling bias and underrepresented operating conditions;
- label noise or systematically wrong labels;
- train/validation/test overlap;
- data that is stale relative to production;
- pipeline transformations that differ between training and serving;
- personally identifiable or prohibited data included unexpectedly;
- poisoned or adversarially inserted training data;
- provenance/licensing/consent problems where relevant.

Mitigation is not only “clean the dataset.” It can include collection changes, stratification, re-labeling, constraints, pipeline tests, human review, weighting, augmentation, monitoring, access controls, and explicit limitation of the model’s operating domain.

## Bias in data

Bias can enter through selection, measurement, historical processes, labels, proxies, missingness, or feedback loops.

A dataset can be numerically balanced and still biased. Example: equal counts by age group do not help if one group’s labels were generated by a systematically different process.

Test bias by asking:

- Who/what is represented and who/what is missing?
- Does measurement quality differ by group or condition?
- Are protected or sensitive attributes used directly or through proxies?
- Are labels based on past decisions that already contain bias?
- Are subgroup sample sizes sufficient to support claims?
- Does performance differ materially by slice?

## Data pipeline testing

Treat ingestion and transformation as production code.

Test boundaries such as:

${TEXT}
source -> ingestion -> schema validation -> cleaning -> feature transformation
       -> split -> training artifact
       -> serving transformation -> model input
${END}

Checks include:

- schema and required fields;
- type and range constraints;
- allowed categorical values;
- uniqueness and duplicate rate;
- null/missing-value rate;
- row counts before/after transformations;
- distribution changes;
- deterministic transformation where expected;
- training/serving feature parity;
- lineage/version metadata;
- failure behavior when constraints are violated.

**Classic defect:** training divides a monetary field by 100 to convert cents to currency units, but serving sends cents directly. The model may appear defective when the real bug is pipeline inconsistency.

## Representativeness

A dataset is representative when it adequately reflects the intended operational population and conditions for the claim being made.

Representativeness is contextual. A road-sign dataset collected only on sunny daytime roads is not representative for a system intended for night, rain and snow—even with millions of images.

Define operational dimensions such as geography, device, language, time, environment, subgroup, class, rarity and expected edge conditions. Then compare the dataset distribution against those dimensions.

## Data constraints

Data constraints turn assumptions into executable checks.

Examples:

- age between 0 and 120;
- timestamp not in the future;
- image width/height above minimum;
- currency in supported set;
- category belongs to the trained vocabulary;
- no duplicate entity across train and test groups;
- required field present for at least 99.9% of records;
- class distribution within an agreed range.

A constraint violation does not always mean “delete the row.” It means the system should handle the condition deliberately.

## Label correctness

Labels are ground truth only if the labeling process deserves trust.

Test label quality through:

- random and risk-based sample review;
- multiple annotators and agreement analysis;
- expert adjudication for ambiguous cases;
- clear labeling guidelines;
- gold/reference examples;
- targeted review of classes with low model performance;
- checks for systematic disagreement by source or subgroup.

High disagreement can mean the labels are poor, but it can also expose an ambiguous requirement. That is product evidence, not just a data-cleaning problem.

## Hands-on dataset audit

Create a small CSV with columns:

${TEXT}
id, age, country, device, label
1, 34, UA, android, positive
2, 999, UA, android, positive
2, 28, PL, ios, negative
4, , DE, web, negative
5, 41, XX, android, maybe
${END}

Write checks for:

1. unique id;
2. age range;
3. allowed countries/devices;
4. missing values;
5. label vocabulary;
6. duplicate rows/entities;
7. class balance by country and device.

Then extend the exercise: assume row id is a person and there are multiple observations per person. Explain why a row-level random train/test split may leak identity information and propose a group-level split.

## Exam traps

- Large dataset ≠ representative dataset.
- Balanced classes ≠ unbiased labels.
- Clean training data ≠ safe production inputs.
- A pipeline schema test does not prove semantic correctness.
- Labels should be tested, not blindly treated as truth.
- Train/test leakage can happen through entities, time, duplicates or derived features even when files are separate.

**Practice:** for a speech-recognition model intended for all customers, design a data test matrix with at least six representativeness dimensions. For each dimension state how you would measure coverage and what you would do if the acceptance dataset has a gap.`
  },
  {
    id: "model-testing",
    label: "6. Model Testing",
    navLabel: "6. Model testing",
    level: "Syllabus chapter 6 · 225 min",
    count: 10,
    description: "Test the learned model itself with reviews, performance evidence, adversarial and metamorphic tests, drift checks, generalization analysis, A/B and back-to-back comparison.",
    sourceIds: ["istqb-ctai-syllabus-v2", "sklearn-model-evaluation", "nist-ai-rmf", "nist-genai-profile"],
    videos: [
      {
        channel: "StatQuest with Josh Starmer",
        channelUrl: "https://www.youtube.com/@statquest",
        title: "Machine Learning Fundamentals: Bias and Variance",
        videoId: "EuBBz3bI-aA",
      },
    ],
    markdown: String.raw`# 6. Model Testing

Model testing asks whether the learned component behaves acceptably before and after integration. It should be traceable to risks, data assumptions and measurable acceptance criteria.

## Model risks and mitigations

Typical risks include:

- poor functional performance on important classes/slices;
- instability near decision boundaries;
- sensitivity to irrelevant changes/noise;
- adversarial manipulation;
- overfitting and weak generalization;
- underfitting and insufficient capacity/features;
- drift after deployment;
- inappropriate confidence/calibration;
- undocumented data/usage limitations;
- reproducibility/versioning failures.

Mitigations combine better data/model development with independent testing, robust acceptance criteria, monitoring and safe system controls.

## Model documentation and review

Before executing black-box tests, review evidence. Useful artifacts include:

- intended use and prohibited/out-of-scope use;
- training and evaluation data description;
- model version and architecture/family;
- preprocessing and feature definitions;
- metrics overall and by important slice;
- known limitations;
- threshold choices;
- validation procedure;
- reproducibility information;
- safety/security considerations;
- monitoring and retraining triggers.

A review can find testability gaps early: no frozen acceptance dataset, no model version ID, missing subgroup metrics, or an undocumented threshold.

## Functional performance of probabilistic models

Do not judge a probabilistic model using a few exact cases alone. Evaluate over a dataset that matches the intended population and calculate suitable metrics.

Questions to ask:

- Is the acceptance dataset independent of training/tuning?
- Is it representative and sufficiently large?
- Are rare/high-risk classes analyzed separately?
- Are thresholds fixed before final evaluation?
- Are confidence intervals or repeated samples needed?
- Do metrics match the product’s error costs?

For generative models, use repeated samples and multidimensional rubrics where output variability is relevant.

## Adversarial testing

Adversarial testing deliberately searches for inputs that cause incorrect or unsafe behavior. Depending on the system, attacks can be tiny image perturbations, crafted feature values, prompt injection, malicious retrieved documents, evasion patterns, poisoning attempts, or sequences of actions.

The purpose is not merely to demonstrate that an attack exists. Characterize preconditions, impact, success rate, detectability, mitigations and residual risk.

## Metamorphic testing

Metamorphic testing is powerful when exact expected outputs are unavailable. Instead of asserting one exact answer, define a **relation** between outputs for related inputs.

Examples:

- Slightly increase image brightness within the supported range → traffic-sign class should remain unchanged.
- Reorder independent items in a set → aggregate prediction should remain equivalent where order has no semantics.
- Translate a simple supported-language intent → semantic classification should remain the same.
- Add irrelevant whitespace to a structured text field → result should not materially change.
- Increase a clearly risk-increasing feature while holding everything else constant → risk score should not decrease, if that monotonic relation is a valid domain requirement.

Metamorphic relations must come from real requirements/domain properties. Do not invent invariants the model was never intended to satisfy.

### Hands-on metamorphic test

Suppose a model exposes:

${PYTHON}
def predict(image) -> tuple[str, float]:
    ...
${END}

Create transformations for brightness +5%, JPEG recompression, one-pixel translation, and harmless metadata removal. For each transformation define:

- applicability precondition;
- expected relation (same class, confidence delta within tolerance, etc.);
- number/type of seed images;
- failure evidence;
- whether one failure is critical or should be evaluated statistically.

## Drift

**Data drift** means the input distribution changes. **Concept drift** means the relationship between inputs and the target changes. Model performance may degrade even if code and model files are unchanged.

Monitor leading indicators (input distributions, missingness, category changes) and outcome indicators (performance on newly labeled production data). Define thresholds that trigger investigation, re-evaluation or retraining.

Drift detection does not automatically prove performance degradation; it tells you an assumption changed and evidence should be refreshed.

## Overfitting and underfitting

**Overfitting:** excellent training performance but weaker performance on unseen data. The model learned training-specific patterns/noise.

**Underfitting:** poor performance even on training data; the model/features/capacity/training are insufficient for the problem.

A common diagnostic pattern:

${TEXT}
training high, validation much lower -> suspect overfitting
training low, validation similarly low -> suspect underfitting
${END}

Do not diagnose from one number alone; verify dataset quality, split strategy, leakage and metric choice.

## A/B testing

A/B testing compares alternatives with different users/traffic under controlled assignment. It is useful when offline metrics do not fully predict product outcomes.

Key test concerns:

- randomization/assignment is correct;
- populations are comparable;
- experiment duration/sample size is adequate;
- primary and guardrail metrics are pre-defined;
- exposure does not create unsafe treatment;
- results are not cherry-picked after many metrics/segments are inspected.

A/B is an online experiment, not merely “run two models on the same file.”

## Back-to-back testing

Back-to-back (differential) testing sends the same or equivalent inputs to two implementations/models and compares outputs. One may be a previous model, reference implementation, simpler model or alternate provider.

This is especially useful when exact oracles are difficult. Differences reveal where investigation is needed, but disagreement alone does not tell you which model is correct.

**Example:** before replacing model A with model B, run both across a frozen regression corpus. Compare class changes, confidence shifts and slice-level metrics. Investigate large regressions even if B’s global accuracy is higher.

## Exam traps

- Metamorphic testing checks relations, not exact known outputs.
- A/B testing uses separate live treatments; back-to-back uses comparable inputs for direct output comparison.
- Drift is not necessarily a code defect.
- Overfitting is not the same as high model complexity in isolation.
- Adversarial tests need threat assumptions and impact, not random malformed inputs only.

**Practice:** for a new version of an image moderation model, write one test each for functional performance, adversarial behavior, metamorphic behavior, drift readiness, overfitting evidence, A/B readiness and back-to-back regression. State the oracle for every test.`
  },
  {
    id: "ml-development-testing",
    label: "7. ML Development & Deployment Testing",
    navLabel: "7. ML development",
    level: "Syllabus chapter 7 · 30 min",
    count: 2,
    description: "Close the lifecycle: test ML development artifacts, reproducibility, packaging and deployment so the validated model is actually the model that runs.",
    sourceIds: ["istqb-ctai-syllabus-v2", "nist-ai-rmf"],
    markdown: String.raw`# 7. ML Development & Deployment Testing

The shortest chapter covers a failure mode that causes expensive incidents: the model that was evaluated is not necessarily the model that is packaged, configured and serving production traffic.

## ML development risks

Treat the ML build as a versioned system of artifacts:

- source code;
- data snapshot/query and labels;
- preprocessing/feature code;
- training configuration and random seeds;
- framework/library versions;
- model architecture/configuration;
- learned weights/model artifact;
- evaluation dataset and results;
- conversion/quantization step;
- serving container/runtime;
- application thresholds and postprocessing.

Risks include non-reproducible builds, dependency drift, wrong data versions, accidental use of test data for tuning, untracked feature changes, artifact corruption, wrong model/configuration deployed, and train/serve skew.

A robust pipeline records enough lineage to answer: **which code + data + configuration produced this exact model, which tests passed, and what is serving now?**

## Deployment testing

Deployment tests should prove more than “the endpoint returns 200.”

Check:

1. exact model/artifact/version loaded;
2. preprocessing and feature schema match training expectations;
3. postprocessing/threshold/configuration match approved values;
4. representative smoke inputs produce plausible expected behavior;
5. latency, memory and hardware behavior on the target runtime;
6. permissions, secrets, network dependencies and external model endpoints;
7. logging/telemetry include model/version identifiers and useful diagnostics without leaking sensitive data;
8. rollback/fallback path works;
9. canary or staged rollout routes traffic correctly;
10. monitoring for data/model/system health is live before full exposure.

**Example deployment defect:** model B passes offline evaluation, but production loads model A with model B’s threshold. Both artifacts are individually valid; the deployed combination is not.

## Minimal deployment evidence record

${TEXT}
release: 2026.08.26
model_sha256: ...
model_version: fraud-v18
training_data_version: transactions-2026-07-31
preprocessing_commit: abc1234
runtime_image: fraud-serving@sha256:...
threshold: 0.73
acceptance_dataset: fraud-acceptance-v7
acceptance_result: PASS
canary_result: PASS
rollback_target: fraud-v17
${END}

The exact tooling is not important for the exam. The principle is traceability and testability across the ML lifecycle.

**Practice:** write a deployment test for a model served behind an API. Include artifact identity, schema, five fixed smoke cases, latency, monitoring, canary traffic and rollback. Then state which failures should block rollout immediately.`
  },
  {
    id: "hands-on-labs",
    label: "Hands-on labs & practical tasks",
    navLabel: "Practical labs",
    level: "Practice",
    count: 7,
    description: "Complete the practical activities behind the syllabus hands-on objectives and turn them into reusable QA artifacts.",
    sourceIds: ["istqb-ctai-syllabus-v2", "google-ml-crash-course", "sklearn-model-evaluation", "sklearn-confusion-matrix", "nist-genai-profile"],
    markdown: String.raw`# Hands-on labs & practical tasks

These labs are designed to reinforce the syllabus hands-on objectives. The certification exam is multiple-choice, but you should be able to execute the reasoning behind the questions rather than memorize vocabulary.

## Lab 1 — Build the ML workflow

**Goal:** create, train and evaluate a small supervised model.

Use the Iris example from chapter 3 or another small public dataset. Produce:

- problem statement and target;
- train/test split rationale;
- model configuration;
- confusion matrix;
- at least two suitable metrics;
- one limitation;
- one regression test you would keep for the next model version.

**Done when:** another tester can explain what evidence the test set provides and why it must remain separate from tuning.

## Lab 2 — Prepare data and catch leakage

Create a deliberately dirty dataset with nulls, duplicates, invalid ranges, class imbalance and repeated entities. Write automated assertions for the constraints and design a split that prevents entity leakage.

Then introduce a leaked feature strongly correlated with the label. Observe how performance changes and explain why the “better” score is misleading.

**Artifact:** a data-quality checklist plus test code/query output.

## Lab 3 — Classification-metric drill

For each matrix below calculate accuracy, precision, recall and F1 without a library.

**A:** TP=90, FP=10, FN=30, TN=870.

**B:** TP=18, FP=2, FN=2, TN=18.

**C:** TP=4, FP=1, FN=16, TN=979.

Then answer:

- Which case shows why accuracy can be dangerous?
- In which product would false negatives dominate risk?
- How would changing a classification threshold affect precision/recall?

Verify calculations with a library only after doing them manually.

## Lab 4 — Implement a perceptron calculation

Write a function that accepts features, weights and bias and returns a binary step output.

${PYTHON}
def perceptron(features, weights, bias):
    score = sum(x * w for x, w in zip(features, weights)) + bias
    return 1 if score >= 0 else 0

print(perceptron([1.0, 0.0], [0.8, -0.3], -0.2))
${END}

Create boundary cases where the weighted sum is just below, exactly at, and just above zero. Explain why boundary analysis remains useful even inside an AI-focused course.

## Lab 5 — Exploratory LLM session

Test a model against one narrow policy requirement. Build a charter, 20+ prompt variations, a scoring rubric and a session log.

Required prompt groups:

- normal/expected;
- paraphrase;
- missing evidence;
- ambiguous intent;
- prompt injection;
- multi-turn escalation;
- multilingual;
- very long/noisy context.

Run at least five high-risk prompts three times each. Record whether variability changes the risk conclusion.

**Artifact:** test charter, transcript IDs, rubric, result summary, five regression prompts.

## Lab 6 — Input-data test suite

Take a CSV or JSON dataset and implement at least ten checks covering:

- schema;
- types;
- ranges;
- allowed values;
- nulls;
- uniqueness;
- duplicate entities;
- class distribution;
- subgroup coverage;
- label sample review/provenance.

Add a deliberately broken pipeline transformation and prove a test catches it.

## Lab 7 — Metamorphic model testing

Choose a classifier or ranking model where at least one relation should hold across transformed inputs. Define three metamorphic relations.

For each relation document:

${TEXT}
relation:
precondition:
source input generation:
transformation:
expected output relation:
tolerance:
number of samples:
failure triage:
${END}

Execute the tests. A relation that turns out not to be valid is still useful if you can explain why the domain assumption was wrong and refine it.

## Capstone — one complete AI test strategy

Choose one system: fraud classifier, medical triage, document classifier, recommendation engine, vision detector, or RAG assistant.

Your strategy must contain:

1. intended use and boundaries;
2. top ten product risks;
3. AI quality characteristics and measurable acceptance criteria;
4. input-data test plan;
5. model test plan;
6. system/integration tests;
7. oracle strategy;
8. adversarial/red-team tests;
9. deployment evidence;
10. production drift/performance monitoring;
11. rollback/fallback;
12. residual-risk owner.

If you can defend that strategy and explain why every test maps to a risk, you have converted the syllabus into working QA knowledge.`
  },
  {
    id: "mock-exam",
    label: "40-question original mock exam",
    navLabel: "Mock exam",
    level: "Exam practice",
    count: 40,
    description: "A full-length set of original CT-AI-style practice questions spanning all seven chapters, followed by an explanation key.",
    sourceIds: ["istqb-ctai-syllabus-v2", "istqb-ctai-sample-questions-v22", "istqb-ctai-sample-answers-v22"],
    markdown: String.raw`# 40-question original mock exam

Set a **60-minute timer** and answer all 40 before opening the key. These are original practice questions written for this learning path; they are **not ISTQB sample questions** and do not reproduce the official scoring distribution. Use the official v2.2 sample exam as the authoritative example of format and difficulty.

## Questions 1–10

**1.** A receipt application has deterministic upload validation followed by an ML classifier. Which test most directly targets the AI component?  
A. Reject a 30 MB file over the API limit.  
B. Verify OAuth expiry.  
C. Measure category recall across representative receipt types.  
D. Verify the database foreign key.

**2.** Which statement best describes a locked model?  
A. It cannot be retrained.  
B. Its learned behavior does not update during normal production use.  
C. It always returns the same output.  
D. It runs without network access.

**3.** A model achieves 99% accuracy on a dataset containing 99% negative cases but detects none of the positives. What is the best conclusion?  
A. The model is production-ready.  
B. Accuracy is sufficient because it is above 95%.  
C. Class-specific metrics are needed because class imbalance hides failure.  
D. The test dataset is necessarily too small.

**4.** What is the primary purpose of a validation set?  
A. Final unbiased evaluation after all tuning.  
B. Model selection/tuning decisions during development.  
C. Production monitoring only.  
D. Replacing training data.

**5.** Which situation is the clearest example of data leakage?  
A. Training data contains nulls.  
B. The same patient appears in training and test sets through different visits, allowing identity-specific patterns to leak.  
C. A class is rare.  
D. The model uses a GPU.

**6.** For TP=80, FP=20 and FN=20, what is precision?  
A. 0.50  
B. 0.67  
C. 0.80  
D. 0.90

**7.** A cancer-screening model must minimize missed positive cases. Which metric is most directly aligned?  
A. Recall.  
B. Precision.  
C. Specificity only.  
D. Inference throughput.

**8.** Which statement about RAG is correct?  
A. Retrieval automatically updates model weights.  
B. RAG supplies retrieved information as runtime context and should be tested separately for retrieval and generation quality.  
C. RAG eliminates hallucinations.  
D. RAG is a form of hardware acceleration.

**9.** Why might a tester use a metamorphic relation?  
A. To avoid defining any expected behavior.  
B. To test relations between outputs when exact expected outputs are difficult to specify.  
C. To replace all performance metrics.  
D. To prove a model is unbiased.

**10.** A traffic-sign image is made 5% brighter within the supported operating range. The class should stay unchanged. This is primarily:  
A. A/B testing.  
B. Metamorphic testing.  
C. Load testing.  
D. Static analysis.

## Questions 11–20

**11.** Which is the strongest acceptance criterion?  
A. “The model should be fair.”  
B. “The model should be highly accurate.”  
C. “Recall shall be ≥0.97 on acceptance dataset v5 and no defined subgroup shall be more than 0.03 below overall recall.”  
D. “Users should trust the model.”

**12.** A model’s training performance is high and validation performance is substantially lower. What should be investigated first?  
A. Underfitting only.  
B. Overfitting and data/split issues.  
C. Network bandwidth.  
D. UI accessibility.

**13.** Training and validation performance are both poor. Which condition is plausible?  
A. Underfitting.  
B. Perfect generalization.  
C. A/B assignment bias only.  
D. Concept drift after deployment only.

**14.** Which test most directly checks label quality?  
A. Verify container CPU limit.  
B. Review a stratified sample with qualified annotators against labeling guidance.  
C. Increase API timeout.  
D. Compare CSS snapshots.

**15.** Why can a very large dataset still be inadequate?  
A. Large datasets cannot train models.  
B. Size does not guarantee representativeness of the intended operating population.  
C. Large datasets always create overfitting.  
D. ISTQB requires small datasets.

**16.** Which is a data-pipeline defect?  
A. The training path converts cents to dollars but the serving path sends cents unchanged.  
B. Recall is chosen as the primary metric.  
C. A human reviewer rejects an output.  
D. A model is versioned.

**17.** What is an important limitation of an LLM-as-judge?  
A. It cannot process text.  
B. It is automatically ground truth.  
C. It can have its own bias/variance and needs validation for the judging task.  
D. It can only be used for exact strings.

**18.** Which is the best exploratory-test charter?  
A. “Test the chatbot.”  
B. “Try random prompts.”  
C. “Explore whether the support assistant reveals another customer’s account data when identity claims change across a long conversation.”  
D. “Make the LLM fail.”

**19.** What makes red teaming different from ordinary happy-path testing?  
A. It requires production access.  
B. It deliberately explores adversarial, unsafe, insecure or policy-violating behavior.  
C. It only measures latency.  
D. It cannot be repeated.

**20.** A GenAI assistant produces several different but correct summaries for the same source. Which assertion is weakest?  
A. Evaluate factual consistency with the source.  
B. Evaluate required-content coverage.  
C. Require every output to equal one exact reference string.  
D. Evaluate safety and instruction following.

## Questions 21–30

**21.** What is the best distinction between model-level and system-level testing?  
A. Model testing is always manual; system testing is automated.  
B. Model testing evaluates learned behavior; system testing also evaluates preprocessing, integration, postprocessing, controls and product behavior.  
C. They are synonyms.  
D. System testing excludes the model.

**22.** A production population changes from desktop images to mostly low-light mobile images. Which risk is most immediate?  
A. Input/data drift relative to the evaluated population.  
B. SQL injection.  
C. Source-code branch coverage.  
D. Deadlock.

**23.** Which statement about drift is correct?  
A. Any drift proves the model is wrong.  
B. Drift means source code changed.  
C. Drift can invalidate assumptions and trigger renewed evaluation even when model code is unchanged.  
D. Drift affects only adaptive models.

**24.** Two candidate models receive the same frozen regression inputs and their outputs are compared. This is:  
A. A/B testing.  
B. Back-to-back testing.  
C. Mutation testing.  
D. Chaos testing.

**25.** Two model versions are randomly assigned to different live-user groups and product outcomes are compared. This is:  
A. A/B testing.  
B. Back-to-back testing.  
C. Metamorphic testing.  
D. Static testing.

**26.** Which evidence is most useful before deploying a converted/quantized model to a mobile device?  
A. Only the original server model’s accuracy.  
B. Re-evaluation of functional performance plus latency/resource behavior on representative target devices.  
C. The model file name.  
D. A screenshot of the training notebook.

**27.** Which item most improves ML-release reproducibility?  
A. Recording code, data, model, dependency and configuration versions used to build the artifact.  
B. Renaming the model “final-final.”  
C. Increasing the number of UI tests.  
D. Removing random seeds from logs.

**28.** The acceptance-tested model is v18, but production silently loads v17. Which test is most directly designed to catch this?  
A. Artifact/version identity check during deployment.  
B. Dataset balancing.  
C. Label review.  
D. Metamorphic image transformation.

**29.** Which is the strongest reason to monitor production data distributions?  
A. To replace acceptance tests.  
B. To detect changes in operating inputs that can make previous evaluation evidence stale.  
C. To guarantee no defects exist.  
D. To increase training accuracy automatically.

**30.** A recommendation model is safe only if low-confidence cases are routed to human review. Where should this requirement be tested?  
A. Only inside the model notebook.  
B. At system/integration level, including threshold interpretation and fallback routing.  
C. Only by checking source code coverage.  
D. Only through a dataset schema check.

## Questions 31–40

**31.** Which statement about neural-network coverage is most accurate?  
A. 100% neural coverage proves the model is correct.  
B. Neural coverage can indicate exercised internal behavior but is not a proof of quality or complete input coverage.  
C. It is identical to statement coverage.  
D. It removes the need for representative data.

**32.** A perceptron has x=[1,0], w=[0.8,-0.3], b=-0.2 and outputs 1 when the score is ≥0. What is the output?  
A. 0 because -0.2 is negative.  
B. 0 because one input is zero.  
C. 1 because the score is 0.6.  
D. Cannot be determined.

**33.** Which is the clearest example of an adversarial test?  
A. Randomly sample normal invoices.  
B. Deliberately craft small input changes intended to make a classifier evade detection while remaining valid to the user.  
C. Review requirements.  
D. Check database backups.

**34.** What should a tester do when two human experts disagree frequently about “correct” labels?  
A. Ignore disagreement and trust the first label.  
B. Investigate labeling guidance, ambiguity and adjudication because the oracle itself may be unreliable.  
C. Delete all disputed records automatically.  
D. Use accuracy only.

**35.** Which is a valid risk of a third-party hosted AI API?  
A. Model/provider changes can alter behavior even if your application code is unchanged.  
B. Hosted models cannot be tested.  
C. Hosted models are always adaptive.  
D. They eliminate privacy risk.

**36.** Which action best supports testing an adaptive production model?  
A. Run a one-time pre-release test and disable monitoring.  
B. Add monitoring, controlled update rules, renewed evaluation and rollback/override mechanisms.  
C. Assume new data always improves quality.  
D. Remove version tracking.

**37.** In a risk-based ML test strategy, what should drive technique selection?  
A. The tester’s favorite framework.  
B. Product risks, quality characteristics, lifecycle stage and consequences of failure.  
C. Alphabetical order of tools.  
D. The metric that gives the highest score.

**38.** Which statement about safety is best?  
A. Safety is proven once model accuracy exceeds 95%.  
B. Safety should be evaluated across the full system, including controls, fallback and operational context.  
C. Safety applies only to robotics.  
D. Safety and security are always identical.

**39.** Which practice is most likely to keep a final test set unbiased?  
A. Repeatedly inspect it while tuning until results are good.  
B. Freeze it and avoid using its results to make iterative model-selection decisions.  
C. Copy hard test examples into training after each failed run and continue calling it the same test set.  
D. Use only training data for final evaluation.

**40.** You have one hour before the exam. Which revision is highest value?  
A. Memorize a list of AI product brands.  
B. Rework weak learning objectives, metric calculations, distinctions between test techniques, and errors from the official sample exam.  
C. Learn a new ML framework API.  
D. Read unrelated AI news.

## Answer key with explanations

1. **C** — representative performance evidence targets learned behavior.  
2. **B** — locked concerns whether learned behavior changes during operation, not determinism or retrainability.  
3. **C** — imbalance makes overall accuracy misleading.  
4. **B** — validation supports development decisions; the final test set should remain independent.  
5. **B** — entity overlap can leak information even when rows differ.  
6. **C** — precision = 80/(80+20)=0.80.  
7. **A** — recall directly penalizes false negatives.  
8. **B** — RAG is runtime retrieval/context augmentation, with separable retrieval and generation risks.  
9. **B** — metamorphic testing checks a required relation across transformed inputs.  
10. **B** — invariance to a supported brightness change is a metamorphic relation.  
11. **C** — it names metric, threshold, dataset and subgroup tolerance.  
12. **B** — the gap is consistent with overfitting but split/leakage/data issues must also be checked.  
13. **A** — weak performance on both is a classic underfitting signal.  
14. **B** — qualified review against labeling rules directly evaluates labels.  
15. **B** — scale does not guarantee relevant coverage.  
16. **A** — training/serving transformation mismatch is a pipeline defect.  
17. **C** — a judge model is itself an imperfect measurement system.  
18. **C** — a charter states a risk, scope and exploration mission.  
19. **B** — adversarial intent and harmful/policy-violating behavior are central.  
20. **C** — multiple valid generations make exact-string equality a poor oracle unless exact text is the requirement.  
21. **B** — system testing covers the product around the learned component.  
22. **A** — the operating input distribution moved away from the evaluated distribution.  
23. **C** — drift is an assumption/evidence problem, not necessarily a code change.  
24. **B** — same inputs, compare implementations = back-to-back.  
25. **A** — separated live treatments = A/B.  
26. **B** — conversion and target hardware can change both quality and non-functional behavior.  
27. **A** — lineage across code/data/config/dependencies is essential for reproducibility.  
28. **A** — deployment must verify the serving artifact, not infer it from a successful build.  
29. **B** — changing inputs can make old test evidence unrepresentative.  
30. **B** — the fallback is product behavior around model confidence.  
31. **B** — coverage is a test-adequacy signal, not correctness proof.  
32. **C** — 1×0.8 + 0×(-0.3) - 0.2 = 0.6.  
33. **B** — the input is intentionally crafted to evade the model.  
34. **B** — disagreement can reveal a weak oracle or ambiguous requirement.  
35. **A** — provider-side changes create regression and governance risk.  
36. **B** — adaptation requires ongoing evidence and control.  
37. **B** — risk and consequences determine what evidence matters.  
38. **B** — safety is a system/context property, not a single model metric.  
39. **B** — repeated tuning against the final test set leaks test knowledge into development decisions.  
40. **B** — exam-focused active recall and error correction have the highest return.

## Score interpretation

This mock uses one question = one practice mark, so its percentage is **not directly convertible** to the official 44-point exam. Use it diagnostically:

- **36–40:** strong; review every uncertainty and take the official sample under time pressure.
- **32–35:** close; revisit the chapters behind wrong answers.
- **28–31:** material gaps remain; repeat calculations and test-technique distinctions.
- **Below 28:** return to the chapter sequence before doing more mocks.

Most important: for every wrong answer, write why your selected distractor was tempting and which syllabus distinction resolves it.`
  },
  {
    id: "final-review",
    label: "Final review, references & exam-day checklist",
    navLabel: "Final review",
    level: "Revision",
    count: 12,
    description: "Consolidate high-yield distinctions, calculations, official materials, and the final readiness checklist before booking or sitting the exam.",
    sourceIds: ["istqb-ctai-page", "istqb-ctai-syllabus-v2", "istqb-ctai-sample-questions-v22", "istqb-ctai-sample-answers-v22", "istqb-ctai-faq", "istqb-glossary", "iso-25059"],
    markdown: String.raw`# Final review, references & exam-day checklist

Use this section after the learning chapters, not as a substitute for them.

## High-yield distinctions

Be able to explain each pair in one or two sentences:

- conventional deterministic logic **vs** learned/probabilistic behavior;
- locked **vs** adaptive model;
- training **vs** validation **vs** test dataset;
- data cleaning **vs** proving representativeness;
- global performance **vs** subgroup/slice performance;
- precision **vs** recall;
- test oracle **vs** one reference example;
- exact assertion **vs** statistical/rubric/metamorphic oracle;
- input-data testing **vs** model testing **vs** system testing;
- adversarial testing **vs** ordinary negative testing;
- metamorphic **vs** back-to-back testing;
- A/B **vs** back-to-back testing;
- data drift **vs** concept drift;
- overfitting **vs** underfitting;
- fine-tuning **vs** RAG;
- model quality **vs** complete system safety.

## Formula sheet

For binary classification:

${TEXT}
accuracy    = (TP + TN) / (TP + TN + FP + FN)
precision   = TP / (TP + FP)
recall      = TP / (TP + FN)
specificity = TN / (TN + FP)
F1          = 2 * precision * recall / (precision + recall)
${END}

Before calculating, write what the **positive class** means. A formula can be correct while the interpretation is reversed.

## Technique trigger sheet

When the scenario says… think first about:

- **“No exact expected output”** → oracle alternatives, metamorphic, statistical/rubric evaluation.
- **“Small safe transformation should preserve behavior”** → metamorphic testing.
- **“Compare old and new model on same inputs”** → back-to-back testing.
- **“Different live groups receive alternatives”** → A/B testing.
- **“Input distribution changed”** → drift and refreshed evidence.
- **“Training great, validation worse”** → overfitting or split/leakage/data issue.
- **“Both training and validation poor”** → underfitting/data/problem formulation.
- **“Rare positive, missing it is costly”** → recall/false negatives.
- **“False alarms are costly”** → precision/specificity/false positives depending on the requirement.
- **“LLM safety bypass”** → red teaming/adversarial exploration plus regression corpus.
- **“Wrong model in production”** → ML development/deployment artifact traceability.
- **“Overall score looks good, subgroup bad”** → slicing/fairness/representativeness and risk-specific acceptance criteria.

## Official-material sequence

1. Read the **current CT-AI v2.0 certification page** for exam logistics and version status.
2. Keep the **v2.0 syllabus** open while studying; every weakness should map back to a learning objective.
3. Use the **ISTQB glossary** for terminology disputes.
4. Take the **official Sample Exam Questions v2.2** under timed conditions.
5. Use the **official Sample Exam Answers v2.2** to review reasoning.
6. Re-study weak objectives, then take this guide’s original mock.

Never rely on an old CT-AI v1.0 course without checking the version. v2.0 reorganized the syllabus into seven chapters, adds dedicated GenAI/LLM testing and removes the “using AI for testing” scope.

## 24-hour checklist

- I can calculate accuracy, precision, recall and F1 by hand.
- I can explain why accuracy can fail on imbalanced data.
- I can identify leakage scenarios.
- I can turn a vague AI quality claim into a measurable acceptance criterion.
- I can distinguish locked and adaptive systems.
- I can name oracle strategies for non-deterministic output.
- I can design a red-team charter for an LLM.
- I can propose representative data slices and label-quality checks.
- I can create at least two valid metamorphic relations.
- I can distinguish A/B and back-to-back testing.
- I can explain drift, overfitting and underfitting.
- I can describe deployment evidence tying the approved model to the serving artifact.

If any item is “no,” revise that topic instead of re-reading everything.

## Exam execution

- Read the qualifier words: **best, most appropriate, first, directly, likely**.
- Identify the lifecycle stage and test object before choosing a technique.
- For numeric questions, write TP/TN/FP/FN explicitly before applying a formula.
- Eliminate answers that claim one metric or technique “proves” overall quality.
- Flag uncertain items and return; do not spend a large fraction of the exam on one question.
- Reserve final minutes to review flagged answers and accidental misreads.

## After certification

CT-AI is a knowledge baseline, not the end state. Keep the capstone strategy from this guide and apply it to a real AI feature. Add production monitoring, evaluation datasets, red-team regressions, and deployment traceability. That work turns a certificate into demonstrable AI-testing capability.

**Final practice:** explain the complete lifecycle aloud in five minutes: requirements/quality → data → model training/evaluation → system testing → deployment → monitoring/change. If you cannot connect a technique to the risk it reduces, revisit that section before the exam.`
  },
];

export default istqbAiTestingModules;
