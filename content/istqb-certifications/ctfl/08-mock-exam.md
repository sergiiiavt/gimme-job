# 40-question original mock exam

Set a 60-minute timer (75 minutes if English is not your native language) and answer all 40 before opening the key. These are original practice questions written for this learning path from the CTFL v4.0 syllabus. They are not ISTQB sample questions; take the official sample exams A to D as the authoritative examples. Like the real exam, this mock leans on chapters 4 and 5.

## Questions 1–10

**1.** Which is a typical objective of testing?
A. Proving that no defects remain in the delivered software
B. Reducing the risk of inadequate software quality
C. Removing the root cause of every defect that is found
D. Debugging the code to locate the cause of each failure

**2.** A developer misreads a requirement and codes the wrong discount rule. In production, a customer is charged the wrong price. What does the customer experience?
A. An error made while writing the code
B. A defect in the delivered program
C. The root cause of the problem
D. A failure of the system in use

**3.** After many releases, the regression suite finds almost no new defects, although users still report failures. Which principle does this illustrate?
A. Tests wear out
B. Defects cluster together
C. Early testing saves time and money
D. The absence-of-defects fallacy

**4.** Which statement best describes the relationship between quality assurance and testing?
A. Testing is preventive and process-oriented; QA is corrective
B. QA and testing are two names for exactly the same activity
C. QA is process-oriented and preventive; testing is product-oriented
D. Testing may only be performed by a separate QA department

**5.** In which test activity are test conditions identified and defects in the test basis found?
A. Test planning, which sets objectives and approach
B. Test implementation, which prepares test procedures
C. Test analysis, which decides what to test
D. Test completion, which archives the testware

**6.** What is a key benefit of traceability between the test basis and testware?
A. Evaluating coverage and the impact of a requirement change
B. Making every automated test run faster than before
C. Removing the need to write a test plan for the project
D. Guaranteeing that all defects are found before release

**7.** Which is a potential drawback of independent testing?
A. Testers bring different cognitive biases from the authors
B. Independent testers can verify assumptions developers made
C. Independent testers recognise different kinds of failures
D. Developers may lose their sense of responsibility for quality

**8.** What does the whole-team approach mean?
A. Only testers are responsible for the quality of the product
B. Anyone with the right skills can do any task; quality is shared
C. Testers work apart from developers to remain independent
D. Business representatives join the team only for acceptance

**9.** Which practice is an example of shift left?
A. Reviewing user stories before development begins
B. Running performance tests only after system testing
C. Adding more manual regression tests before each release
D. Postponing test design until the code is stable

**10.** Which test level focuses on the interface between the system and an external payment service?
A. Component testing of a single module
B. Component integration testing
C. System integration testing
D. User acceptance testing

## Questions 11–20

**11.** After a fix, the tester reruns the test that failed, and it passes. What kind of testing is this?
A. Regression testing of the whole system
B. Confirmation testing of the fix
C. Maintenance testing after migration
D. Smoke testing of a new build

**12.** Which situation triggers maintenance testing?
A. Writing the first user story for a brand-new product
B. Reviewing the requirements before any development starts
C. Designing component tests for code that is still being written
D. Migrating an operational system to a new database platform

**13.** Which approach writes a failing unit test first, then the code, then refactors?
A. Acceptance test-driven development (ATDD)
B. Behaviour-driven development (BDD)
C. Session-based exploratory testing
D. Test-driven development (TDD)

**14.** A requirement states that pages load in under 2 seconds with 500 concurrent users. Which test type covers it?
A. Non-functional testing of performance efficiency
B. Functional testing of what the page content shows
C. White-box testing of the page code
D. Confirmation testing of a defect fix

**15.** Which is an advantage of static testing over dynamic testing?
A. It causes failures that reveal defects while the code runs
B. It measures response times of the system under heavy load
C. It finds defects directly, such as unreachable code, before execution
D. It removes the need for any dynamic testing later in the project

**16.** Which review type is the most formal and collects metrics?
A. Walkthrough led by the author
B. Inspection
C. Technical review by peers
D. Informal review

**17.** Which review role collects anomalies and records decisions?
A. Scribe (recorder)
B. Moderator (facilitator)
C. Author of the work product
D. Manager of the review

**18.** In which step of the review process do reviewers examine the work product and log anomalies?
A. Planning the review
B. Review initiation
C. Fixing and reporting
D. Individual review

**19.** An age field accepts whole numbers from 18 to 65. Which values does 2-value boundary value analysis require?
A. 18 and 65 only
B. 17, 18, 65 and 66
C. 17, 18, 19, 64, 65 and 66
D. 18, 41 and 65

**20.** A field accepts integers from 1 to 100; values below 1 and above 100 are rejected. What is the minimum number of tests for 100% equivalence partition coverage?
A. One test
B. Two tests
C. Three tests
D. Six tests

## Questions 21–30

**21.** A decision table has three independent conditions, each true or false. How many columns does the full table have?
A. 8
B. 6
C. 3
D. 9

**22.** Which state transition coverage criterion is the strongest?
A. All states coverage
B. Valid transitions coverage
C. 0-switch coverage
D. All transitions coverage

**23.** Which statement about white-box coverage is true?
A. 100% statement coverage guarantees 100% branch coverage
B. Statement coverage and branch coverage are always equal
C. 100% branch coverage guarantees 100% statement coverage
D. Branch coverage cannot be measured for code with loops

**24.** Code has 20 executable statements, and the tests execute 15 of them. What is the statement coverage?
A. 15%
B. 75%
C. 80%
D. 25%

**25.** A tester explores a feature for 90 minutes guided by a charter, then reports findings. Which technique is this?
A. Session-based exploratory testing
B. Checklist-based testing against a team checklist
C. Error guessing based on past failures
D. Decision table testing

**26.** Acceptance criteria are written as Given, When and Then. Which format is this?
A. Rule-oriented
B. Checklist-based
C. Use-case based
D. Scenario-oriented

**27.** In the INVEST criteria for user stories, what does T stand for?
A. Traceable
B. Timeboxed
C. Testable
D. Technical

**28.** Which description fits error guessing?
A. Deriving tests from the states and events of a system
B. Anticipating defects from past failures and experience
C. Deriving tests from the internal structure of the code
D. Dividing input data into groups processed the same way

**29.** A field accepts integers from 1 to 100. How many test values does 3-value boundary value analysis require?
A. 6
B. 4
C. 2
D. 3

**30.** Using three-point estimation with an optimistic estimate of 4 hours, a most likely estimate of 7 hours and a pessimistic estimate of 16 hours, what is the estimate?
A. 7 hours
B. 9 hours
C. 9.5 hours
D. 8 hours

## Questions 31–40

**31.** Which describes Wideband Delphi?
A. Applying a historical ratio of development to test effort
B. Experts estimate alone, discuss the differences, then re-estimate
C. Measuring early progress and extrapolating it to the end
D. One senior expert gives the estimate for the whole team

**32.** In Agile development, which concept plays the role of exit criteria?
A. Definition of Ready
B. Test charter
C. Definition of Done
D. Product backlog

**33.** Which is a product risk?
A. The checkout may calculate tax incorrectly
B. A key tester may leave in the middle of the project
C. The test environment may be delivered late
D. A supplier may miss an agreed delivery date

**34.** What determines the level of a risk?
A. Severity and priority
B. Cost and schedule
C. Coverage and defect density
D. Likelihood and impact

**35.** In the testing quadrants, where do exploratory testing and usability testing belong?
A. Q1, technology-facing tests that support the team
B. Q2, business-facing tests that support the team
C. Q3, business-facing tests that critique the product
D. Q4, technology-facing tests that critique the product

**36.** What does the test pyramid recommend?
A. Many slow end-to-end tests and only a few unit tests
B. Many fast low-level tests and fewer high-level tests
C. The same number of tests at every level of the stack
D. Manual tests at both the top and the bottom levels

**37.** Which element of a defect report most helps a developer reproduce the failure?
A. Steps to reproduce, with expected and actual results
B. The name of the tester who first found the defect
C. The date on which the defect was eventually closed
D. The total number of open defects in the project

**38.** The highest-priority test T3 needs data that test T1 creates. In what order should they run?
A. T3 first, because it has the highest priority
B. Skip T3 entirely because of the dependency
C. Run T3 and T1 in parallel to save time
D. Run T1 first, then T3

**39.** Which is a risk of test automation?
A. More time for testers to design new and deeper tests
B. Faster regression feedback on every new build
C. Unrealistic expectations about what the tool will deliver
D. More objective measurement of the coverage achieved

**40.** Which tool category do virtual machines and containers belong to?
A. Management tools for requirements, tests and defects
B. Tools for scalability and deployment standardisation
C. Static testing tools for reviews and static analysis
D. Collaboration tools for team communication

## Answer key with explanations

1. **B** — testing reduces the risk of inadequate quality; it cannot prove the absence of defects, and debugging is a separate activity.
2. **D** — the customer sees a failure; the misreading was the error and the wrong rule in the code is the defect.
3. **A** — repeating the same tests finds fewer new defects, so tests and data need updating.
4. **C** — QA improves processes to prevent defects; testing evaluates the product, a form of quality control.
5. **C** — test analysis identifies test conditions ("what to test") and finds defects in the test basis.
6. **A** — traceability supports coverage evaluation, impact analysis and audits.
7. **D** — independence can isolate testers and lead developers to feel less responsible for quality.
8. **B** — the whole-team approach shares responsibility for quality and lets skilled members take any task.
9. **A** — reviewing stories before development moves testing earlier in the lifecycle.
10. **C** — system integration testing focuses on interfaces with other systems and external services.
11. **B** — rerunning the failed test after a fix is confirmation testing; regression testing looks for side effects.
12. **D** — migrations, modifications and retirement of operational systems trigger maintenance testing.
13. **D** — TDD drives code with failing unit tests followed by refactoring.
14. **A** — response time under load is a performance efficiency characteristic, tested non-functionally.
15. **C** — static testing finds defects directly and early, including types dynamic testing struggles to find.
16. **B** — inspection follows the full process, collects metrics and is the most formal review type.
17. **A** — the scribe collects anomalies and records decisions.
18. **D** — reviewers examine the work product and log anomalies during individual review.
19. **B** — 2-value BVA tests each boundary and its closest neighbour in the adjacent partition.
20. **C** — there are three partitions (below, inside, above the range), each needing one test.
21. **A** — three binary conditions give 2 × 2 × 2 = 8 combinations.
22. **D** — all transitions coverage includes every valid transition and attempts every invalid one.
23. **C** — branch coverage subsumes statement coverage, not the reverse.
24. **B** — 15 of 20 statements executed is 75% statement coverage.
25. **A** — a timeboxed session guided by a charter is session-based exploratory testing.
26. **D** — Given/When/Then is the scenario-oriented format; rule-oriented uses lists or tables.
27. **C** — INVEST stands for Independent, Negotiable, Valuable, Estimable, Small and Testable.
28. **B** — error guessing anticipates defects from experience; the other options are other techniques.
29. **A** — the values are 0, 1, 2, 99, 100 and 101.
30. **D** — E = (4 + 4 × 7 + 16) / 6 = 48 / 6 = 8 hours.
31. **B** — Wideband Delphi iterates independent expert estimates and discussion of outliers.
32. **C** — the Definition of Done acts as exit criteria; the Definition of Ready acts as entry criteria.
33. **A** — product risks concern product quality; the others threaten the project.
34. **D** — risk level combines likelihood and impact.
35. **C** — Q3 holds business-facing tests that critique the product, such as exploratory and usability testing.
36. **B** — the pyramid favours many small, fast, isolated tests at the bottom.
37. **A** — reproduction steps with expected and actual results let the developer reproduce the failure.
38. **D** — logical dependencies can require a lower-priority test to run first.
39. **C** — unrealistic expectations are a listed risk; the others are benefits.
40. **B** — virtual machines and containers support scalability and deployment standardisation.

## Score interpretation

This mock uses one question = one mark, like the real CTFL exam, where 26 of 40 passes. Treat it as a diagnostic:

- **36–40:** strong; take the official sample exams A to D under time pressure.
- **32–35:** close; revisit the chapters behind your wrong answers.
- **28–31:** material gaps remain; redo the chapter 4 calculations by hand.
- **Below 28:** return to the chapter sequence before doing more mocks.

For every wrong answer, write down which syllabus term or distinction would have resolved it.
