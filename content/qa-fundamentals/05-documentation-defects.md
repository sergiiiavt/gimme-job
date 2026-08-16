<!-- concepts: test-strategy-plan, test-case-checklist-charter, test-suite-data-environment, test-reporting, good-defect-report, severity-priority, defect-lifecycle, root-cause-symptom -->

# Test Documentation & Defects

Documentation is useful when it preserves decisions, makes work reproducible, supports traceability or communicates evidence. It is waste when it exists only because a template says a document must exist.

## Test strategy and test plan

A **test strategy** describes the higher-level approach to obtaining quality evidence: risks, levels, types, techniques, environments, automation boundaries and decision principles. A **test plan** applies that approach to a particular scope, release, project or test effort.

Organizations use these names differently, so the practical questions matter more than the label:

- What is being tested and what is excluded?
- Which risks matter most?
- What evidence is required?
- Which levels, types and techniques will provide it?
- What environments, tools, data and people are required?
- How will progress and completion be evaluated?

## Test case, checklist and exploratory charter

Different work products support different kinds of testing. None is universally “better.” The useful question is how much prescription, reproducibility and freedom the work needs.

| Dimension | Detailed test case | Checklist | Exploratory charter |
| --- | --- | --- | --- |
| Prescriptiveness | High | Medium to low | Low |
| Reproducibility | High when maintained | Medium | Depends on session notes |
| Executor freedom | Low to medium | Medium to high | High |
| Maintenance cost | Usually high | Usually lower | Usually low |
| Domain knowledge | Context-dependent | Often important | Usually important |
| Best fit | repeatable, delegated or regulated checks | recurring coverage areas | investigation and uncertainty |

A detailed test case may contain preconditions, inputs, steps where needed and expected results. A checklist records prompts such as “minimum/maximum value,” “cancel and retry,” or “permission boundary” without prescribing every action. An exploratory charter defines a mission such as “Explore checkout recovery after network interruption, focusing on duplicate orders and stale totals.”

> **Key point:** choose the smallest artifact that preserves the information the team actually needs.

### One feature, three documentation styles

Suppose a formatting dialog lets the user choose a font family, style and size.

```diagram
Detailed case
Open dialog → choose Arial → choose Bold → size 12 → Apply
Expected: selected text is Arial Bold 12

Checklist
font family / style / size / invalid combination / persistence / reset

Exploratory charter
Explore formatting changes, focusing on combinations, persistence and recovery after undo/redo
```

The feature is the same. The documentation changes according to the purpose of the testing.

## Test suites, data and environments

A test suite groups tests for a purpose: smoke, regression, component area, release gate or another decision. The suite name should communicate that purpose instead of becoming a dumping ground for every historical test.

Test data and environment information are part of reproducibility. Useful records may include:

- account/persona state;
- data creation or reset method;
- application/build version;
- service and dependency versions;
- feature flags and configuration;
- device/browser/OS where relevant;
- external-service assumptions.

Without this context, “cannot reproduce” often means “we no longer know the conditions under which the observation occurred.”

## Test reporting

Reporting exists to support decisions, not to manufacture reassuring numbers. A useful progress report can communicate:

- what has and has not been examined;
- which high-risk areas have evidence;
- important defects and blockers;
- environment or data limitations;
- coverage gaps;
- changes from the plan;
- current residual uncertainty.

A completion report should answer a stakeholder's real question: **what do we know about this product now, and what important uncertainty remains?**

Percent passed can be useful operationally, but 99% passing tests do not imply 99% product quality. A suite can contain many low-value tests and still miss a critical risk.

## What makes a defect report actionable

A good defect report reduces the effort required to reproduce, understand, prioritize and fix a problem.

At minimum it normally needs:

1. a concise title describing the observed failure;
2. the relevant environment/build;
3. clear preconditions and data;
4. minimal reproduction steps or triggering sequence;
5. actual behaviour;
6. expected behaviour and the basis for that expectation;
7. useful evidence such as logs, screenshots, traces or request/response details when appropriate;
8. impact information.

The best report is not necessarily the longest. Remove irrelevant steps and capture the smallest reproducible path.

### From a weak report to an actionable one

Weak report:

> **Title:** Button does not work
>
> **Steps:** Open the site, log in, go to checkout, enter data, click the button.
>
> **Result:** Nothing happens.

That report forces the reader to rediscover the failure condition. A stronger version captures the observation and the state that matters:

| Field | Example |
| --- | --- |
| Title | Checkout remains on Payment step after successful card authorization |
| Build / environment | staging, build 2026.08.16.3, Chrome 140 |
| Preconditions | cart contains one in-stock item; test card authorizes successfully |
| Minimal steps | 1. Open Payment. 2. Enter valid test-card details. 3. Select **Pay**. |
| Actual | authorization succeeds, spinner disappears, page remains on Payment; no order confirmation appears |
| Expected | after successful authorization, order is created and Confirmation is displayed |
| Evidence | payment request/response ID, console trace, screenshot/video |
| Impact | user may retry payment because the UI gives no confirmation |

```diagram
Symptom in the title
      ↓
Reproducible state and minimal trigger
      ↓
Actual vs expected behaviour
      ↓
Evidence that helps investigation
      ↓
Impact that helps triage
```

Avoid embedding a guessed technical root cause in the title unless it has been demonstrated. “Payment API race condition” is a hypothesis; “Checkout remains on Payment after successful authorization” is an observation.

## Defect, failure and issue are not synonyms

A defect is not limited to code written by a programmer. Defects can exist in requirements, design, code, configuration, data, infrastructure or other work products. A **failure** is observable incorrect behaviour when relevant conditions activate a defect. An **issue** is commonly a workflow container that may represent a defect, question, task, incident or improvement.

This distinction matters because the first visible symptom is not necessarily where the defect was introduced.

## Severity and priority

These dimensions answer different questions.

- **Severity:** how serious is the effect of the defect on the product, user, system or business?
- **Priority:** how urgently should the organization address it relative to other work?

| Example | Severity | Possible priority |
| --- | --- | --- |
| Rare crash in an admin-only migration screen | High | Medium if migration is months away |
| Typo on the homepage during a major campaign | Low | High because millions of users will see it today |
| Payment charged twice | Critical | Critical |

Priority incorporates timing, exposure, workaround, business commitments and other context. Severity alone cannot determine scheduling. Neither dimension inherently “belongs to QA” or “belongs to management”; organizations assign responsibility differently and often decide through triage.

## Defect lifecycle and triage

A defect typically moves through states such as reported, reviewed/triaged, assigned, fixed, verified and closed, with variants such as rejected, duplicate, deferred or cannot reproduce.

The exact workflow varies. The important part is that each transition has a clear meaning.

```diagram
Reported
   ↓
Triage / validate
   ├── duplicate / not a defect / deferred
   ↓
Accepted and assigned
   ↓
Fixed
   ↓
Confirmation testing
   ├── still failing → reopen
   ↓
Closed
```

Triage is not a battle over whether QA or development is “right.” It is a shared decision about the evidence, impact, ownership and next action.

## Symptom, cause and root cause

The visible failure is a **symptom**, not necessarily the cause.

Example:

```diagram
User sees duplicate order
       ↓
API processed the same request twice
       ↓
Client retried after a timeout
       ↓
Server endpoint lacked idempotency protection
```

The defect report may begin with the symptom. Investigation determines the technical cause. Root-cause analysis asks why the system and process allowed the condition to exist or escape.

A useful corrective action often goes beyond fixing one line of code. It may improve requirements, design patterns, test coverage, observability or review practices so the same class of problem becomes less likely.

## Documentation should evolve

Test artifacts are maintained assets. When requirements change, obsolete cases should be updated or removed. When a regression test permanently protects an escaped defect, the original manual case may no longer need the same form. When a checklist becomes too vague, it may need explicit examples.

Documentation quality is therefore not measured by page count. It is measured by how effectively the artifacts preserve useful knowledge and support decisions.

## Summary

- Strategy explains the testing approach; plans apply it to a concrete scope.
- Test cases, checklists and exploratory charters trade prescription, maintenance and executor freedom differently.
- Data and environment context are essential for reproducibility.
- Reporting should communicate evidence, gaps and uncertainty rather than only pass percentages.
- A strong defect report separates observation, reproduction, expectation, evidence and impact.
- Defects are not limited to code, and failures are observable consequences rather than “bugs executed by testers.”
- Severity describes impact; priority describes urgency relative to other work.
- Defect triage is a shared evidence and prioritization process.
- Root-cause thinking distinguishes the visible symptom from the underlying technical and systemic causes.

## Sources

- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-3:2021 — Test documentation](https://www.iso.org/standard/79429.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
