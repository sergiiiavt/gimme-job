<!-- concepts: testing-in-sdlc, test-basis-object-testware, planning-monitoring-control, analysis-design-implementation, execution-evaluation-completion, maintenance-testing -->

# Testing Process & Lifecycle

Testing is not a phase that begins after coding. It is a set of activities that starts when the team can first examine useful information and continues while the product changes in production.

## STLC and the modern test process

**STLC (Software Testing Life Cycle)** is a common interview and industry label for the lifecycle of testing work. Different sources group the phases differently. For interview purposes, recognize the popular six-phase wording, but use the more precise ISTQB test activities when explaining how testing actually works.

| Common STLC wording | Closest ISTQB test activities |
| --- | --- |
| Requirement analysis | Test analysis, supported by early reviews of the test basis |
| Test planning | Mainly test planning; test monitoring and control is continuous across the whole test effort |
| Test case development | Test analysis, test design and test implementation |
| Test environment setup | Mainly test implementation |
| Test execution | Test execution |
| Test cycle closure | Test completion |

The mapping is approximate, not a second official ISTQB lifecycle. In particular, environment setup is not a separate ISTQB activity, test case development compresses several distinct activities into one label, and monitoring/control must not be treated as a sub-step that happens only during planning.

The activities are **not a strict waterfall**. A useful simplified working flow is **planning → analysis → design → implementation → execution → completion**. **Test monitoring and control is cross-cutting:** it starts once there is a plan or other baseline to compare against and continues while the other activities happen, feeding changes back into priorities, scope, resources, schedule and planning. In Agile and continuous delivery, the same activities may occur many times inside a sprint or even for a single change.

## Testing throughout the SDLC

Different lifecycle models organize work differently, but the testing problem stays similar: obtain useful evidence early enough to influence decisions. Requirements can be reviewed before code exists. Designs can be challenged for testability. Component tests can run while implementation is still local. Integration and system evidence grows as the product becomes more complete.

```diagram
Idea / need
   ↓
Requirements ── review and testability feedback
   ↓
Design ─────── architecture and interface review
   ↓
Implementation ─ component and integration feedback
   ↓
System ─────── system and acceptance evidence
   ↓
Production ─── monitoring, incidents, user feedback and maintenance testing
```

## Test basis, test object and testware

Three terms remove a lot of ambiguity.

- **Test basis** is the information used to derive tests: requirements, user stories, designs, contracts, risk analysis, regulations, code or existing behaviour.
- **Test object** is what is being tested: a function, service, application, device, document, configuration or integrated system.
- **Testware** is the collection of testing work products: conditions, cases, data, scripts, charters, results, reports and supporting assets.

If a requirement changes, the test basis changed. That should trigger impact analysis on the related testware and possibly the product itself.

## Planning, monitoring and control

Planning defines the intended approach before execution consumes time. Good planning answers what is in scope, which risks matter, what evidence is required, which environments and data are needed, who owns decisions and what conditions define sufficient completion.

Monitoring compares reality with the plan. Control changes the plan or the testing work when reality changes. **Monitoring and control is not a phase between planning and analysis.** Once a usable baseline exists, it continues during analysis, design, implementation, execution and completion.

```diagram
Plan / baseline
      ↓
Analysis → Design → Implementation → Execution → Completion
   ↑          ↑            ↑             ↑          ↑
   └──── continuous monitoring & control ───────────┘
                 ↓
      adjust priority / scope / resources /
           schedule / depth / plan
```

A plan that cannot change is not control; it is documentation of an old assumption.

## Test analysis

Test analysis asks **what should be tested?** The tester studies the test basis, identifies testable features, risks and conditions, and finds problems in the basis itself.

For a checkout discount rule, analysis may identify conditions such as customer type, minimum basket value, coupon state, date range, currency and interactions with other promotions. The output is not yet a long list of button clicks. It is a coverage model.

## Test design

Test design asks **how should those conditions be covered?** This is where techniques such as equivalence partitioning, boundary-value analysis, decision tables, state transitions and structural coverage become useful.

The aim is to select a small set of tests that provides strong evidence about a much larger test space.

## Test implementation

Implementation turns designs into executable testware. Depending on context, this may include detailed cases, checklists, automation scripts, data, environment configuration, test suites, expected results and execution order.

Implementation quality matters. A theoretically good test is weak if the data is impossible to create, the expected result is ambiguous or the environment cannot reproduce the relevant state.

## Test execution

Execution runs the prepared or exploratory checks, compares actual and expected behaviour, records evidence and investigates anomalies. A failed check does not automatically equal a product defect. The test itself, environment, data or expectation may be wrong.

A useful failure investigation asks:

1. Is the observation reproducible?
2. Is the expected result justified by the test basis?
3. Is the environment representative and healthy?
4. Did the test data create the intended state?
5. Is this a product defect, a test defect, or a known limitation?

## Evaluation and completion

Completion is not simply “all cases executed.” Teams evaluate whether the planned evidence was obtained, whether important risks remain, what defects are still open, what coverage gaps exist and what should be communicated to stakeholders.

This produces a release or completion view based on evidence and residual uncertainty, not a ritual percentage.

## Maintenance testing

After release, software continues to change through fixes, dependency updates, configuration changes, migrations, infrastructure changes and new features. Maintenance testing examines the impact of those changes.

Two questions are central:

- Does the changed behaviour now work as intended?
- Did the change damage behaviour that previously worked?

That naturally connects confirmation testing and regression testing, covered in the next chapter.

## Summary

- STLC is a common umbrella term; the exact phase names vary by source.
- For a practical flow, think planning → analysis → design → implementation → execution → completion; test monitoring/control runs continuously across that flow.
- ISTQB still defines monitoring/control as one of the seven test activities, but its position in the syllabus list must not be read as a chronological phase before analysis or design.
- Testing activities overlap and iterate rather than forming a strict waterfall.
- Testing activities exist across the lifecycle, not only after development.
- Test analysis determines what needs evidence; test design determines how to obtain it.
- Testware includes far more than test cases.
- Completion should communicate evidence, gaps and residual risk.
- Production changes create new testing work through maintenance and impact analysis.

## Sources

- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-1:2022](https://www.iso.org/standard/81291.html)
- [ISO/IEC/IEEE 29119-2:2021](https://www.iso.org/standard/79428.html)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)