# Managing the test activities

Chapter 5 is the second heaviest chapter and includes K3 calculation and defect-report questions.

## Test planning

A test plan describes objectives, resources and processes: context (scope, objectives, constraints, test basis), assumptions and constraints, stakeholders, communication, risk register, test approach (levels, types, techniques, deliverables, entry and exit criteria, independence, metrics, data and environment requirements), budget and schedule.

Testers contribute to **release planning** (writing testable stories and acceptance criteria, risk analysis, effort estimates, test approach) and **iteration planning** (story refinement, risk analysis, testability, task breakdown, estimates, functional and non-functional aspects).

## Entry and exit criteria

**Entry criteria** define preconditions for starting an activity, such as available resources, testware and an initial quality level. **Exit criteria** define what must be achieved to declare it done, such as coverage, defect density and completed automation. In Agile, exit criteria are the **Definition of Done** and entry criteria for a user story are the **Definition of Ready**.

## Estimation techniques

- **Estimation based on ratios:** use historical ratios, such as development-to-test effort.
- **Extrapolation:** measure early in the project and extrapolate.
- **Wideband Delphi:** experts estimate in isolation, discuss outliers and re-estimate; Planning Poker is a variant.
- **Three-point estimation:** E = (a + 4m + b) / 6, with standard deviation SD = (b − a) / 6, where a is optimistic, m most likely and b pessimistic.

Example: a = 6, m = 9, b = 18 hours. E = (6 + 36 + 18) / 6 = 10 hours; SD = (18 − 6) / 6 = 2 hours.

## Test case prioritisation

- **Risk-based:** order by the result of risk analysis.
- **Coverage-based:** order by coverage achieved, possibly additional coverage.
- **Requirements-based:** order by priority of the requirements, set by stakeholders.

Dependencies can force a lower-priority test to run first.

## The test pyramid and the testing quadrants

The **test pyramid** has many small, fast, isolated tests at the bottom and fewer, slower end-to-end tests at the top.

The **testing quadrants** group tests by business-facing or technology-facing, and supporting the team or critiquing the product:

| Quadrant | Facing / purpose | Examples |
| --- | --- | --- |
| Q1 | Technology, supporting the team | Component and component integration tests |
| Q2 | Business, supporting the team | Functional tests, examples, story tests, prototypes |
| Q3 | Business, critiquing the product | Exploratory testing, usability testing, user acceptance testing |
| Q4 | Technology, critiquing the product | Smoke tests and non-functional tests |

## Risk management

Risk level is determined by **likelihood** and **impact**. **Project risks** threaten the project (organisational, people, technical, supplier issues). **Product risks** threaten product quality (missing functionality, poor performance, security vulnerabilities). Product risk analysis has **identification** and **assessment**; product risk control has **mitigation** and **monitoring**. Testing responds to risk through test levels, types, techniques, coverage and effort.

## Monitoring, control, completion and reporting

Metrics cover progress, defects, risk, coverage and cost. **Progress reports** go out during testing; a **completion report** summarises at the end. Configuration management identifies, controls and tracks testware and test objects.

## Defect reports

A defect report typically contains: a unique identifier, title and summary, date, author, test object and environment, context, description with steps to reproduce, expected and actual results, severity, priority, status, and references such as the test case. Its objectives: give enough information to resolve the defect, track quality, and suggest process improvements.

## Estimate, prioritise and report

For optimistic 2, most likely 4 and pessimistic 12 hours, three-point estimate = (2 + 4×4 + 12)/6 = 5 hours. This is an estimate with assumptions, not a deadline promise. A prerequisite setup test may run before a higher-risk dependent test. Prioritise the next executable test by risk and additional coverage; 100% statement coverage alone is not a release criterion. A useful defect report includes R1, build, role, subtotal=100, exact steps, expected 20%, actual 10%, evidence and severity rationale. Retesting and risk acceptance need owners.
