# 40-question original mock exam

Set a 60-minute timer (75 minutes if English is not your native language) and answer all 40 before opening the key. These are original practice questions written for this learning path from the CT-GenAI v1.1 syllabus. They are not ISTQB sample questions; take the official v1.1 sample exam as the authoritative example. Like the syllabus, this mock leans heavily on chapter 2, prompt engineering.

## Questions 1–10

**1.** Which type of AI represents knowledge with symbols and logical rules?
A. Classical machine learning, trained on prepared data
B. Deep learning, with neural networks learning features
C. Symbolic AI, which is rule-based
D. Generative AI, which creates new content

**2.** What is an embedding?
A. A numerical vector representing a token's meaning and context
B. The number of tokens a model can consider at one time
C. Splitting text into characters, sub-words or whole words
D. A fine-tuned version of a general foundation model

**3.** Why can an LLM give different answers to the same prompt?
A. It searches a different part of the web on each call
B. Its training data is updated between individual calls
C. Its context window is cleared after every single token
D. Inference is probabilistic and shaped by temperature

**4.** Which type of LLM adds multi-step problem solving and chain-of-thought?
A. A foundation LLM
B. A reasoning LLM
C. An instruction-tuned LLM
D. A small language model

**5.** A tester wants to check a UI screenshot against a written requirement. Which kind of model fits?
A. A rule-based chatbot
B. A vision-language model
C. A symbolic AI system
D. A text-only small model

**6.** "Return the result as a table with the columns ID, condition and priority." Which prompt component is this?
A. Role
B. Context
C. Constraints
D. Output format

**7.** "You are an experienced test automation engineer." Which prompt component is this?
A. Role
B. Instruction
C. Input data
D. Constraints

**8.** "Consider only the payment step and ignore the page layout." Which prompt component is this?
A. Context
B. Output format
C. Constraints
D. Role

**9.** A complex task needs each intermediate result checked and corrected before the next step. Which technique fits best?
A. Zero-shot prompting
B. One-shot prompting
C. Prompt chaining
D. Meta prompting

**10.** You need many outputs in a strict Gherkin format. Which technique fits best?
A. Prompt chaining
B. Few-shot prompting
C. Meta prompting
D. Zero-shot prompting

## Questions 11–20

**11.** A tester asks the LLM to draft a prompt for a new kind of task, then reviews and adjusts it. Which technique is this?
A. Few-shot prompting
B. Prompt chaining
C. System prompting
D. Meta prompting

**12.** What does one-shot prompting mean?
A. The prompt includes exactly one example
B. One prompt covers the whole test project
C. One model is used for every test task
D. One answer is requested per prompt

**13.** Which statement describes a system prompt?
A. Constant across the session and usually hidden from the chatbot user
B. Typed by the user and different on every turn of the conversation
C. Holds only the input data, such as the user story under test
D. Generated automatically by the vector database for each query

**14.** Generating acceptance criteria from a user story and a GUI wireframe in one prompt uses which kind of prompt?
A. A text-only zero-shot prompt
B. A rule-based test script
C. A multimodal prompt
D. A fine-tuned small model

**15.** Which test analysis task can GenAI support?
A. Running performance tests directly in production
B. Identifying defects such as ambiguities in the test basis
C. Signing off the release on behalf of the business owner
D. Replacing the test plan with a general chatbot

**16.** Generating privacy-preserving synthetic test data belongs to which test activity?
A. Test monitoring and control
B. Test completion and reporting
C. Test analysis of the test basis
D. Test design and implementation

**17.** GenAI keeps a list of known anomalies and clusters defects across runs. Which task is this?
A. Test planning for the release
B. Requirements elicitation with users
C. Static analysis of the source code
D. Analysing regression test reports

**18.** Which is a test monitoring and control task for GenAI?
A. Suggesting reprioritisation based on metric trends
B. Writing unit tests for newly created components
C. Generating synthetic customer data for test runs
D. Reviewing user stories for their testability

**19.** Which metric measures the share of generated scripts that run as they are?
A. Accuracy of the content
B. Diversity of scenarios
C. Execution success rate
D. Time efficiency gained

**20.** Which metric measures whether all valid and invalid partitions were covered?
A. Precision
B. Recall
C. Relevance
D. Accuracy

## Questions 21–30

**21.** Why do GenAI evaluation metrics need statistically relevant data?
A. The metrics are only valid for small language models
B. Output is non-deterministic, so a single run proves little
C. Each model counts tokens in a slightly different way, so totals vary
D. The syllabus does not allow manual review of output

**22.** Comparing two prompt versions on the same tasks to see which performs better is called what?
A. Prompt chaining
B. Meta prompting
C. A/B testing of prompts
D. Few-shot prompting

**23.** Which combination of techniques matches the syllabus?
A. Meta prompting drafts, few-shot fixes format, chaining validates steps
B. Use only one prompting technique per project to keep results consistent
C. Few-shot examples remove the need for any human review of the output
D. Prompt chaining is reserved for prompts that include image inputs

**24.** A generated test case refers to a field that does not exist in the specification. What is this?
A. Bias
B. Reasoning error
C. Context manipulation
D. Hallucination

**25.** The LLM orders tests wrongly because it misreads a dependency between conditions. What is this?
A. Reasoning error
B. Hallucination
C. Bias
D. Data leakage

**26.** Generated test suites contain almost no non-functional tests. What is this most likely?
A. Hallucination
B. Reasoning error
C. Request manipulation
D. Bias

**27.** What is the effect of lowering the temperature?
A. More creative and more diverse output
B. More consistent output with less diversity
C. A larger context window for the model
D. Guaranteed reproducibility of every answer

**28.** What is the best way to detect reasoning errors in generated tests?
A. Ask the same LLM whether it is confident in its own answer
B. Raise the temperature and compare several answers
C. Review the logic and run the tests against the test object
D. Shorten the prompt until the answer becomes shorter

**29.** An attacker overloads the context window to expose fragments of training data. Which attack is this?
A. Request manipulation
B. Prompt chaining
C. Context manipulation
D. Data minimisation

**30.** Which privacy mitigation replaces personal data with non-identifiable values?
A. Cross-evaluation with several models
B. Anonymisation and pseudonymisation
C. Fine-tuning the model on test data
D. Retrieval-augmented generation

## Questions 31–40

**31.** What is ISO/IEC 42001?
A. An EU regulation with risk-based classification
B. A US framework for managing AI risk
C. A framework for ML-based AI systems
D. A standard for AI management systems

**32.** What is the first runtime step of retrieval-augmented generation?
A. Retrieve the chunks semantically closest to the query
B. Fine-tune the model on the retrieved documents
C. Raise the temperature for more diverse answers
D. Split the query into tokens and stop without generating

**33.** In RAG, what is stored in the vector database?
A. Test execution logs from CI runs
B. The model's weights after training
C. Embeddings of document chunks
D. User credentials for the test tool

**34.** Which agent works toward user-defined goals with periodic human oversight?
A. A semi-autonomous agent
B. An autonomous agent
C. A rule-based chatbot
D. A foundation LLM

**35.** A fine-tuned model performs well on its training data but poorly on new tasks. Which challenge is this?
A. Hallucination
B. Shadow AI
C. Context manipulation
D. Overfitting

**36.** What is LLMOps?
A. A prompting technique that chains tasks together
B. Practices to develop, deploy and maintain LLMs in production
C. A regulation that requires transparency for AI systems
D. A metric for the execution success rate of generated scripts

**37.** What is Shadow AI?
A. AI models running on an internal company server
B. GenAI tools used without formal approval or oversight
C. AI features that only work in a dark-mode interface
D. Agents that run in the background without a GUI

**38.** Which is the first phase of GenAI adoption in a test organisation?
A. Utilisation and iteration
B. Initiation and usage definition
C. Discovery
D. Decommissioning

**39.** Which is a selection criterion for an LLM or SLM?
A. Recurring cost estimated from tokens and task frequency
B. The size of the model vendor's marketing budget
C. Whether it has the largest parameter count available
D. Whether testers already use it privately at home

**40.** How does the tester's role evolve with GenAI?
A. Testers stop reviewing output because AI is accurate
B. Testers only write prompts and no longer design tests
C. Testers hand the test strategy over to AI agents
D. Testers review AI output and maintain prompt libraries

## Answer key with explanations

1. **C** — symbolic AI is rule-based and represents knowledge with symbols and logic.
2. **A** — an embedding is a numerical vector for a token's meaning and context; B describes the context window and C tokenization.
3. **D** — inference predicts the next token probabilistically, and hyperparameters such as temperature add variation.
4. **B** — reasoning LLMs add logical inference, multi-step problem solving and chain-of-thought.
5. **B** — vision-language models combine visual and textual information, such as comparing a screenshot with text.
6. **D** — the expected structure of the response is the output format.
7. **A** — the persona the model adopts is the role.
8. **C** — a restriction on how the instruction applies to the input is a constraint.
9. **C** — prompt chaining splits a task into steps with checks between them.
10. **B** — examples in the prompt fix repetitive or constrained formats such as Gherkin.
11. **D** — in meta prompting the LLM generates or refines prompts and the tester evaluates them.
12. **A** — zero-, one- and few-shot refer to how many examples the prompt includes.
13. **A** — the system prompt sets behaviour and rules for the whole session; the user prompt changes each turn.
14. **C** — combining text and an image in one prompt is multimodal prompting.
15. **B** — GenAI can find defects such as ambiguities in the test basis during test analysis.
16. **D** — test data synthesis is a test design and implementation task.
17. **D** — clustering defects and keeping a known-anomalies list are part of regression report analysis.
18. **A** — analysing trends and suggesting reprioritisation supports test monitoring and control.
19. **C** — execution success rate is the share of generated artefacts that run as they are.
20. **B** — recall measures whether all relevant instances, such as every partition, were found.
21. **B** — non-deterministic output means metrics must rest on enough runs to be meaningful.
22. **C** — A/B testing compares prompt versions on the same tasks.
23. **A** — the syllabus describes combining meta prompting, few-shot examples and chaining.
24. **D** — inventing a field that does not exist is a hallucination.
25. **A** — misinterpreting logic such as conditions or order is a reasoning error.
26. **D** — systematic underrepresentation of a test type is bias.
27. **B** — lower temperature improves consistency but reduces creativity and diversity.
28. **C** — logical review and running the generated tests against the test object reveal reasoning errors.
29. **C** — overloading the context window to expose training data is context manipulation.
30. **B** — anonymisation and pseudonymisation replace or mask sensitive data.
31. **D** — ISO/IEC 42001:2023 is the standard for AI management systems.
32. **A** — RAG retrieves semantically similar chunks first, then generates an answer with them.
33. **C** — chunks are encoded as embeddings and stored in a vector database for semantic retrieval.
34. **A** — semi-autonomous agents run with periodic human oversight.
35. **D** — overfitting reduces generalisation beyond the training data.
36. **B** — LLMOps covers developing, deploying and maintaining LLMs in production.
37. **B** — Shadow AI is GenAI use without formal approval or oversight.
38. **C** — discovery builds awareness and capability before use cases are prioritised.
39. **A** — the criteria are performance, fine-tuning potential, recurring cost, and community and support.
40. **D** — testers become AI-assisted specialists who review output and maintain prompt libraries.

## Score interpretation

This mock uses one question = one mark; the real exam passes at 65%. Treat it as a diagnostic:

- **36–40:** strong; take the official v1.1 sample exam under time pressure.
- **32–35:** close; reread chapter 2 and the chapters behind your wrong answers.
- **28–31:** material gaps remain; redo the hands-on labs before another mock.
- **Below 28:** return to the chapter sequence before doing more mocks.

For every wrong answer, write down which syllabus term or distinction would have resolved it.
