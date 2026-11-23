# Fundamentals of testing

Chapter 1 sets the vocabulary the rest of the exam uses. Many questions are K1 or K2: know the exact terms.

## Why test, and what testing is

Testing evaluates work products to find defects and to assess quality. Typical objectives: evaluating work products such as requirements and code, causing failures and finding defects, ensuring required coverage, reducing the risk of inadequate quality, verifying requirements are fulfilled, validating that the test object works as users expect, providing information for decisions, and building confidence.

- **Testing vs debugging:** testing reveals failures (dynamic) or finds defects directly (static); debugging finds, analyses and removes the cause.
- **Testing vs quality assurance:** QA is process-oriented and preventive; testing is product-oriented and corrective, a form of quality control.

## Errors, defects, failures and root causes

A person makes an **error** (mistake), which introduces a **defect** (fault, bug) in a work product. When defective code executes, it may cause a **failure**. A **root cause** is the fundamental reason the problem happened, such as time pressure or missing training. Not every defect causes a failure, and failures can also come from environmental conditions such as radiation.

## The seven testing principles

1. Testing shows the presence, not the absence, of defects.
2. Exhaustive testing is impossible; use techniques, prioritisation and risk.
3. Early testing saves time and money.
4. Defects cluster together: a few components hold most defects.
5. Tests wear out: repeating the same tests finds fewer new defects, so update tests and data.
6. Testing is context dependent.
7. Absence-of-defects fallacy: a defect-free system can still be the wrong system.

## Test activities and testware

| Activity | Key output |
| --- | --- |
| Test planning | Test plan: objectives and approach |
| Test monitoring and control | Progress reports, control directives |
| Test analysis | Test conditions, defects in the test basis ("what to test") |
| Test design | Test cases, coverage items, test data requirements ("how to test") |
| Test implementation | Test procedures, scripts, suites, environment, data |
| Test execution | Results, logs, defect reports |
| Test completion | Completion report, archived testware, lessons learned |

**Traceability** links the test basis to testware and results, supporting coverage evaluation, impact analysis and audits.

## Roles, skills and independence

CTFL v4.0 names two roles: the **test management role** (process, team, planning, monitoring) and the **testing role** (analysis, design, implementation, execution). One person can hold both. The **whole-team approach** makes quality everyone's responsibility, with testers working closely with business representatives and developers.

**Independence** brings different cognitive biases and fresh eyes, but can isolate testers, create a bottleneck, and lead developers to lose a sense of responsibility for quality. Levels range from the author testing their own work to testers outside the organization.
