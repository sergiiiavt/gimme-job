# Final review & exam-day checklist

Use this after the chapters, the labs and the mock exam.

## Distinctions the exam tests

| Pair | Remember |
| --- | --- |
| CT-AI vs CT-GenAI | Testing AI-based systems; using GenAI to test |
| LLM vs SLM | Relative size; evaluate quality, latency and cost on the task |
| Foundation vs instruction-tuned vs reasoning | Base training; instruction alignment; reasoning-oriented capability. These can overlap |
| AI chatbot vs LLM-powered test tool | Conversational; integrated through APIs for defined tasks |
| System vs user prompt | Application instructions that can change; user task and data |
| Prompt chaining vs few-shot vs meta prompting | Checked steps; examples for format; the LLM writes the prompt |
| Hallucination vs reasoning error vs bias | Invented content; wrong logic; skewed coverage |
| Context vs request manipulation | Untrusted-context manipulation; adversarial input. Neither guarantees training-data extraction |
| Autonomous vs semi-autonomous agent | Minimal human input; periodic oversight |
| RAG vs fine-tuning | Provide retrieved context at inference; adapt the model with training data. Neither guarantees truth |

## Lists worth memorising

- **Six prompt components:** role, context, instruction, input data, constraints, output format.
- **Evaluation metrics:** accuracy, precision, recall, relevance and contextual fit, diversity, execution success rate, time efficiency.
- **Adoption phases:** discovery; initiation and usage definition; utilisation and iteration.
- **Model selection:** performance, fine-tuning potential, recurring cost, community and support.
- **Standards and frameworks:** ISO/IEC 42001, ISO/IEC 23053, EU AI Act, NIST AI RMF.

## Readiness checklist

- [ ] CTFL held, since it is required to sit the exam
- [ ] All five chapters read, chapter 2 twice
- [ ] At least four of the six labs done with non-sensitive data
- [ ] Mock exam score of 32 or more, with every wrong answer explained
- [ ] Official v1.1 sample exam taken under a 60-minute timer

## Exam day

- 60 minutes for 40 questions: about 90 seconds each.
- Scenario questions on choosing a prompting technique are the K3 core: decide first whether the task needs checked steps, a fixed format, or a new prompt.
- There is no negative marking: answer every question.

## Readiness evidence

Before the mock, derive precision/recall from distinct IDs, repair a hallucinated deadline without inventing a replacement, and identify risks under GenAI-3.1.2. Keep a short record of the prompt version, source, expected outcome and observed failure. This makes weak concepts visible; a score from one deterministic quiz cannot measure stochastic reliability or be converted directly to the official weighted score.
