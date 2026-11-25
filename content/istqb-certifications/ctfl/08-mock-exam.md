# 40-question original mock exam

Set a 60-minute timer (75 minutes if English is not your native language) and answer all 40 before opening the key. These are original practice questions written for this learning path from the CTFL v4.0 syllabus. They are not ISTQB sample questions; take the official sample exams A to D as the authoritative examples. Like the real exam, this mock leans on chapters 4 and 5.

## Questions 1–10

**1.** Which is a typical objective of testing?
A. Removing the root cause of every defect that is found
B. Reducing the risk of inadequate software quality
C. Proving that no defects remain in the delivered software
D. Debugging the code to locate the cause of each failure

**2.** A developer misreads a requirement and codes the wrong discount rule. In production, a customer is charged the wrong price. What does the customer experience?
A. A failure of the system in use
B. The root cause of the problem
C. An error made while writing the code
D. A defect in the delivered program

**3.** After many releases, the regression suite finds almost no new defects, although users still report failures. Which principle does this illustrate?
A. Defects cluster together
B. Tests wear out
C. The absence-of-defects fallacy
D. Early testing saves time and money

**4.** Which statement best describes the relationship between quality assurance and testing?
A. Testing is preventive and process-oriented; QA is corrective
B. Testing may only be performed by a separate QA department
C. QA is process-oriented and preventive; testing is product-oriented
D. QA and testing are two names for exactly the same activity

**5.** In which test activity are test conditions identified and defects in the test basis found?
A. Test planning, which sets objectives and approach
B. Test completion, which archives the testware
C. Test analysis, which decides what to test
D. Test implementation, which prepares test procedures

**6.** What is a key benefit of traceability between the test basis and testware?
A. Evaluating coverage and the impact of a requirement change
B. Removing the need to write a test plan for the project
C. Guaranteeing that all defects are found before release
D. Making every automated test run faster than before

**7.** Which is a potential drawback of independent testing?
A. Independent testers recognise different kinds of failures
B. Independent testers can verify assumptions developers made
C. Testers bring different cognitive biases from the authors
D. Developers may lose their sense of responsibility for quality

**8.** What does the whole-team approach mean?
A. Testers work apart from developers to remain independent
B. Business representatives join the team only for acceptance
C. Only testers are responsible for the quality of the product
D. Anyone with the right skills can do any task; quality is shared

**9.** Which practice is an example of shift left?
A. Running performance tests only after system testing
B. Reviewing user stories before development begins
C. Postponing test design until the code is stable
D. Adding more manual regression tests before each release

**10.** Which test level focuses on the interface between the system and an external payment service?
A. Component testing of a single module
B. Component integration testing
C. System integration testing
D. User acceptance testing

## Questions 11–20

**11.** After a fix, the tester reruns the test that failed, and it passes. What kind of testing is this?
A. Confirmation testing of the fix
B. Regression testing of the whole system
C. Smoke testing of a new build
D. Maintenance testing after migration

**12.** Which situation triggers maintenance testing?
A. Migrating an operational system to a new database platform
B. Designing component tests for code that is still being written
C. Writing the first user story for a brand-new product
D. Reviewing the requirements before any development starts

**13.** Which approach writes a failing unit test first, then the code, then refactors?
A. Test-driven development (TDD)
B. Session-based exploratory testing
C. Acceptance test-driven development (ATDD)
D. Behaviour-driven development (BDD)

**14.** A requirement states that pages load in under 2 seconds with 500 concurrent users. Which test type covers it?
A. White-box testing of the page code
B. Functional testing of what the page content shows
C. Confirmation testing of a defect fix
D. Non-functional testing of performance efficiency

**15.** Which is an advantage of static testing over dynamic testing?
A. It causes failures that reveal defects while the code runs
B. It measures response times of the system under heavy load
C. It removes the need for any dynamic testing later in the project
D. It finds defects directly, such as unreachable code, before execution

**16.** Which review type is the most formal and collects metrics?
A. Informal review
B. Inspection
C. Technical review by peers
D. Walkthrough led by the author

**17.** Which review role collects anomalies and records decisions?
A. Scribe (recorder)
B. Author of the work product
C. Manager of the review
D. Moderator (facilitator)

**18.** In which step of the review process do reviewers examine the work product and log anomalies?
A. Fixing and reporting
B. Review initiation
C. Individual review
D. Planning the review

**19.** An integer age field accepts 18–65 inclusive; the domain is all integers. Which set covers 2-value BVA?
A. 17, 18, 65 and 66
B. 18 and 65 only
C. 18, 41 and 65
D. 17, 18, 19, 64, 65 and 66

**20.** A field accepts integers from 1 to 100; values below 1 and above 100 are rejected. What is the minimum number of tests for 100% equivalence partition coverage?
A. One test
B. Two tests
C. Six tests
D. Three tests

## Questions 21–30

**21.** A discount requires member=true and subtotal>=100 for 20%; member only gives 10%, high subtotal only 5%, otherwise 0%. How many feasible decision rules must be covered?
A. 2
B. 8
C. 3
D. 4

**22.** The model has draft-submit-submitted, submitted-approve-approved, submitted-reject-draft and approved-archive-archived. A sequence visits every state and valid transition. What is still required for all-transitions coverage?
A. Attempt each invalid transition independently
B. Visit each state a second time
C. Only repeat submit-approve-archive
D. Repeat the longest valid sequence unchanged

**23.** Which statement about white-box coverage is true?
A. 100% statement coverage guarantees 100% branch coverage
B. Branch coverage cannot be measured for code with loops
C. 100% branch coverage guarantees 100% statement coverage
D. Statement coverage and branch coverage are always equal

**24.** Code has 20 executable statements, and the tests execute 15 of them. What is the statement coverage?
A. 80%
B. 75%
C. 15%
D. 25%

**25.** A tester explores a feature for 90 minutes guided by a charter, then reports findings. Which technique is this?
A. Error guessing based on past failures
B. Session-based exploratory testing
C. Checklist-based testing against a team checklist
D. Decision table testing

**26.** A member has subtotal 100; when checkout applies the rule, then discount must be 20%. Which form should an acceptance test preserve?
A. Only the name of the checkout use case
B. A checklist without inputs or outcomes
C. A list of unrelated implementation details
D. The Given/When/Then condition, action and expected result

**27.** In the INVEST criteria for user stories, what does T stand for?
A. Technical
B. Testable
C. Timeboxed
D. Traceable

**28.** Which description fits error guessing?
A. Deriving tests from the states and events of a system
B. Dividing input data into groups processed the same way
C. Deriving tests from the internal structure of the code
D. Anticipating defects from past failures and experience

**29.** The input domain is all integers; 1–100 inclusive is valid. How many distinct values cover 3-value BVA around both shared partition borders?
A. 6
B. 8
C. 3
D. 4

**30.** Using three-point estimation with an optimistic estimate of 4 hours, a most likely estimate of 7 hours and a pessimistic estimate of 16 hours, what is the estimate?
A. 9.5 hours
B. 9 hours
C. 7 hours
D. 8 hours

## Questions 31–40

**31.** Which describes Wideband Delphi?
A. Applying a historical ratio of development to test effort
B. One senior expert gives the estimate for the whole team
C. Experts estimate alone, discuss the differences, then re-estimate
D. Measuring early progress and extrapolating it to the end

**32.** In Agile development, which concept plays the role of exit criteria?
A. Definition of Ready
B. Product backlog
C. Definition of Done
D. Test charter

**33.** Which is a product risk?
A. The checkout may calculate tax incorrectly
B. A supplier may miss an agreed delivery date
C. A key tester may leave in the middle of the project
D. The test environment may be delivered late

**34.** What determines the level of a risk?
A. Cost and schedule
B. Severity and priority
C. Likelihood and impact
D. Coverage and defect density

**35.** In the testing quadrants, where do exploratory testing and usability testing belong?
A. Q2, business-facing tests that support the team
B. Q1, technology-facing tests that support the team
C. Q4, technology-facing tests that critique the product
D. Q3, business-facing tests that critique the product

**36.** What does the test pyramid recommend?
A. The same number of tests at every level of the stack
B. Many slow end-to-end tests and only a few unit tests
C. Many fast low-level tests and fewer high-level tests
D. Manual tests at both the top and the bottom levels

**37.** A member receives 10% at subtotal 100, where R1 specifies 20%. Which report most directly supports reproduction?
A. The number of tests passed on the previous release and a screenshot
B. Tester name, closure date and the total number of open defects
C. Build, role, input=100, exact steps, expected 20%, actual 10%, evidence
D. A severity label and a request to investigate checkout immediately

**38.** The highest-priority test T3 needs data that test T1 creates. In what order should they run?
A. Run T1 first, then T3
B. Skip T3 entirely because of the dependency
C. T3 first, because it has the highest priority
D. Run T3 and T1 in parallel to save time

**39.** Which is a risk of test automation?
A. More objective measurement of the coverage achieved
B. Unrealistic expectations about what the tool will deliver
C. More time for testers to design new and deeper tests
D. Faster regression feedback on every new build

**40.** Which tool category do virtual machines and containers belong to?
A. Management tools for requirements, tests and defects
B. Tools for scalability and deployment standardisation
C. Static testing tools for reviews and static analysis
D. Collaboration tools for team communication

## Answer key with explanations

1. **B** — testing reduces the risk of inadequate quality; it cannot prove the absence of defects, and debugging is a separate activity.
2. **A** — the customer sees a failure; the misreading was the error and the wrong rule in the code is the defect.
3. **B** — repeating the same tests finds fewer new defects, so tests and data need updating.
4. **C** — QA improves processes to prevent defects; testing evaluates the product, a form of quality control.
5. **C** — test analysis identifies test conditions ("what to test") and finds defects in the test basis.
6. **A** — traceability supports coverage evaluation, impact analysis and audits.
7. **D** — independence can isolate testers and lead developers to feel less responsible for quality.
8. **D** — the whole-team approach shares responsibility for quality and lets skilled members take any task.
9. **B** — reviewing stories before development moves testing earlier in the lifecycle.
10. **C** — system integration testing focuses on interfaces with other systems and external services.
11. **A** — rerunning the failed test after a fix is confirmation testing; regression testing looks for side effects.
12. **A** — migrations, modifications and retirement of operational systems trigger maintenance testing.
13. **A** — TDD drives code with failing unit tests followed by refactoring.
14. **D** — response time under load is a performance efficiency characteristic, tested non-functionally.
15. **D** — static testing finds defects directly and early, including types dynamic testing struggles to find.
16. **B** — inspection follows the full process, collects metrics and is the most formal review type.
17. **A** — the scribe collects anomalies and records decisions.
18. **C** — reviewers examine the work product and log anomalies during individual review.
19. **A** — 2-value BVA tests each boundary and its closest neighbour in the adjacent partition.
20. **D** — there are three partitions (below, inside, above the range), each needing one test.
21. **D** — Two independent Boolean conditions yield four feasible rules; each has its own action.
22. **A** — All-transitions coverage includes valid transitions and attempts at invalid transitions; state visitation alone is weaker.
23. **C** — branch coverage subsumes statement coverage, not the reverse.
24. **B** — 15 of 20 statements executed is 75% statement coverage.
25. **B** — a timeboxed session guided by a charter is session-based exploratory testing.
26. **D** — A scenario links a concrete precondition, action and observable expected result; a heading alone cannot verify the rule.
27. **B** — INVEST stands for Independent, Negotiable, Valuable, Estimable, Small and Testable.
28. **D** — error guessing anticipates defects from experience; the other options are other techniques.
29. **B** — The union is -1,0,1,2,99,100,101,102: each boundary of the three partitions plus its neighbours, with duplicates removed.
30. **D** — E = (4 + 4 × 7 + 16) / 6 = 48 / 6 = 8 hours.
31. **C** — Wideband Delphi iterates independent expert estimates and discussion of outliers.
32. **C** — the Definition of Done acts as exit criteria; a team may choose Ready as entry guidance, but it is not a mandatory Scrum artifact.
33. **A** — product risks concern product quality; the others threaten the project.
34. **C** — risk level combines likelihood and impact.
35. **D** — Q3 holds business-facing tests that critique the product, such as exploratory and usability testing.
36. **C** — the pyramid favours many small, fast, isolated tests at the bottom.
37. **C** — A reproducible report connects the requirement, environment, input, steps and expected/actual behavior; metadata alone is insufficient.
38. **A** — logical dependencies can require a lower-priority test to run first.
39. **B** — unrealistic expectations are a listed risk; the others are benefits.
40. **B** — virtual machines and containers support scalability and deployment standardisation.

## Score interpretation

This mock uses one question = one mark, like the real CTFL exam, where 26 of 40 passes. Treat it as a diagnostic:

- **36–40:** strong; take the official sample exams A to D under time pressure.
- **32–35:** close; revisit the chapters behind your wrong answers.
- **28–31:** material gaps remain; redo the chapter 4 calculations by hand.
- **Below 28:** return to the chapter sequence before doing more mocks.

For every wrong answer, write down which syllabus term or distinction would have resolved it.
