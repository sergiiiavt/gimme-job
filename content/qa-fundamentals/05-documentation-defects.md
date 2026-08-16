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

## Test case, checklist and charter

Different work products support different kinds of testing.

| Artifact | Best suited to | Typical content |
| --- | --- | --- |
| Test case | Repeatable, explicit checks | preconditions, inputs, steps when needed, expected result |
| Checklist | Known coverage areas with flexible execution | short prompts or conditions to remember |
| Exploratory charter | Time-boxed investigation with a mission | target, risks, focus, constraints, useful data |

Detailed test cases are valuable when reproducibility, delegation or regulated evidence matters. They are expensive when every minor UI action is documented even though the real test intent fits in one sentence.

> **Key point:** choose the smallest artifact that preserves the information the team actually needs.

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

## Severity and priority

These dimensions answer different questions.

- **Severity:** how serious is the effect of the defect on the product, user, system or business?
- **Priority:** how urgently should the organization address it relative to other work?

| Example | Severity | Possible priority |
| --- | --- | --- |
| Rare crash in an admin-only migration screen | High | Medium if migration is months away |
| Typo on the homepage during a major campaign | Low | High because millions of users will see it today |
| Payment charged twice | Critical | Critical |

Priority incorporates timing, exposure, workaround, business commitments and other context. Severity alone cannot determine scheduling.

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
- Test cases, checklists and exploratory charters serve different purposes.
- Data and environment context are essential for reproducibility.
- Reporting should communicate evidence, gaps and uncertainty rather than only pass percentages.
- Severity describes impact; priority describes urgency relative to other work.
- Defect triage is a shared evidence and prioritization process.
- Root-cause thinking distinguishes the visible symptom from the underlying technical and systemic causes.

## Sources

- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-3:2021 — Test documentation](https://www.iso.org/standard/79429.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
