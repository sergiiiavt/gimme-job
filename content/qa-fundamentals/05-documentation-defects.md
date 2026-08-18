<!-- concepts: test-documentation-model, test-policy-strategy-plan, test-plan-purpose, test-plan-content, test-approach-schedule, test-plan-reporting-loop, test-case-checklist-charter, test-suite-data-environment, test-reporting, good-defect-report, severity-priority, defect-lifecycle, root-cause-symptom -->

# Test Documentation & Defects

Documentation is useful when it preserves decisions, makes work reproducible, supports traceability or communicates evidence. It is waste when it exists only because a template says a document must exist.

The important question is not “which documents must QA create?” but **which information must survive so that testing can be planned, performed, understood and used for decisions?** That information may live in a formal document, a test-management tool, tickets, a wiki, version-controlled files or a combination of them.

## Test documentation across the test process

Testware is broader than test cases. Different test activities create and consume different work products.

```diagram
PLANNING
├── test plan
├── estimates and schedule
├── risk information
└── entry / exit or completion criteria

MONITORING & CONTROL
├── progress / status information
├── updated risks and forecasts
└── control decisions and plan changes

ANALYSIS
├── test conditions
├── coverage targets
└── defects or ambiguities found in the test basis

DESIGN
├── test cases
├── exploratory charters
├── coverage items
├── test-data requirements
└── environment requirements

IMPLEMENTATION
├── test procedures / scripts
├── automated tests
├── test suites
├── prepared test data
├── execution order
└── environment configuration

EXECUTION
├── test results / logs / evidence
└── defect reports

COMPLETION
├── test completion report
├── residual risks and unresolved items
├── lessons learned
└── maintained / archived testware
```

These do **not** have to be separate files. A small team may keep most of them in one project space. A regulated or safety-critical project may require controlled, reviewed and versioned artifacts. The information need stays similar even when the packaging changes.

## Test policy, strategy, plan, approach and schedule

These terms are often collapsed into “the test plan,” which makes planning difficult to reason about.

| Term | Main purpose | Typical scope |
| --- | --- | --- |
| **Test policy** | Defines organizational principles, expectations or governance for testing. | Organization / product family |
| **Test strategy** | Defines a reusable higher-level approach to obtaining quality evidence. | Organization, product, programme or long-lived initiative |
| **Test plan** | Defines how testing objectives will be achieved for a specific test effort. | Project, release, iteration, migration or major change |
| **Test approach** | Describes the selected levels, types, techniques, priorities and other methods used by the plan. | Part of a specific plan, possibly derived from strategy |
| **Test schedule** | Places testing activities, dependencies and milestones in time and execution order. | Specific test effort |

Organizations use these labels differently. The useful distinction is the **decision being documented**.

```diagram
Organizational direction
Test policy / reusable strategy
            ↓
Specific release or test effort
          TEST PLAN
            ├── scope and objectives
            ├── risks
            ├── test approach
            ├── responsibilities
            ├── environments and data
            ├── criteria and metrics
            └── estimates / schedule
                       ↓
                 execution
```

> **Common mistake:** calling a list of browsers, test types and tools a “test plan.” That list may describe part of the **test approach**, but a plan also establishes scope, objectives, responsibilities, risks, resources, criteria and coordination.

## Test plan: purpose

A **test plan** describes how and when the objectives of a defined test effort will be achieved. Its value is not the existence of a document; its value is that important testing decisions are made explicitly before execution consumes most of the available time.

A useful test plan should help the team:

- agree what is **in scope and out of scope**;
- define the **test objectives** and evidence required;
- connect testing depth and priority to **product and project risks**;
- identify required **people, environments, tools and test data**;
- assign **responsibilities and decision ownership**;
- expose **assumptions, dependencies and constraints**;
- define when testing can start and what constitutes sufficient completion;
- define what will be measured and reported;
- provide a baseline for **monitoring and control** when reality differs from the plan.

A plan is therefore both a coordination artifact and a decision baseline.

## What belongs in a test plan

There is no useful reason to force every project into one rigid template. The following structure captures the information that a practical plan normally needs.

| Section | What it answers |
| --- | --- |
| **Context** | What product, release, change or test effort is this plan for? Why does it exist? |
| **Test basis / references** | Which requirements, designs, contracts, standards, risk analyses or other sources define expected behaviour? |
| **Scope** | What test objects, features, interfaces and quality characteristics are included? What is explicitly excluded? |
| **Test objectives** | What evidence must testing provide? Which decisions should that evidence support? |
| **Assumptions and constraints** | What are we assuming? What limits time, budget, access, tools, platforms or depth? |
| **Stakeholders and responsibilities** | Who performs testing, supplies data/environments, fixes blockers, accepts residual risk and makes release decisions? |
| **Risks and priorities** | Which product and project risks drive test depth, order and contingency planning? |
| **Test approach** | Which levels, test types, techniques, exploratory work, automation and independence are appropriate? |
| **Testware / deliverables** | Which cases, charters, scripts, suites, evidence and reports must be created or maintained? |
| **Environment, data and tools** | Which systems, versions, accounts, datasets, devices, browsers, simulators or services are required? |
| **Entry criteria** | What must be true before a planned testing activity can begin usefully? |
| **Exit / completion criteria** | What evidence or conditions are required before the effort can be considered sufficiently complete? |
| **Metrics and reporting** | What will be measured, how often will status be communicated, and to whom? |
| **Communication and escalation** | How are blockers, critical defects, risk changes and decisions communicated? |
| **Estimate, resources and budget** | How much effort/capacity is expected and what resources are required? |
| **Schedule and dependencies** | When will activities happen, in what order, and what external events can block them? |

Not every row needs its own heading in a small plan. For a one-week feature, several may fit into a single page. For a multi-system programme, each may need much more detail.

### A compact real-world test plan example

Suppose a release changes checkout retry behaviour and adds a new payment provider.

| Plan area | Example |
| --- | --- |
| **Scope** | card checkout, retry behaviour, duplicate-payment prevention, new provider integration; gift-card flow unchanged and out of scope |
| **Objectives** | show that successful payment creates exactly one order; failed/time-out payment does not create duplicate charges; provider errors are recoverable and understandable |
| **Main risks** | duplicate charge, order created without confirmed payment, provider timeout leaving unknown state, regression in existing provider |
| **Approach** | API decision-table coverage for payment outcomes; state-transition coverage for retry/recovery; provider contract tests; focused browser E2E happy path; exploratory session around interrupted network states |
| **Environment/data** | staging build, provider sandbox, webhook receiver, test cards for success/decline/timeout, accounts with clean carts |
| **Entry** | provider sandbox reachable; webhook configuration verified; release candidate deployed; seed data available |
| **Completion** | all critical payment risks have evidence; no unresolved critical/high duplicate-charge defect without explicit acceptance; planned provider rules covered; known gaps recorded |
| **Reporting** | daily risk/blocker update during execution; completion report before release decision |
| **Schedule** | contract/API checks first, then integration recovery, then focused E2E/regression after provider configuration stabilizes |

Notice what is **not** useful: listing hundreds of test-case titles inside the plan. The plan defines the testing effort; detailed testware carries the execution detail.

## Entry, exit and completion criteria in the plan

Criteria turn vague statements such as “start testing when ready” or “finish when everything passes” into decision rules.

**Entry criteria** describe conditions that make a testing activity meaningful to start. Examples:

- required environment and build are available;
- critical interfaces are deployed and reachable;
- required test data or accounts can be created;
- the relevant test basis is stable enough to derive expectations;
- blocking prerequisite defects are resolved.

**Exit or completion criteria** describe the evidence expected before the effort can be considered sufficiently complete. Examples:

- agreed high-risk scenarios have been covered;
- defined requirement/risk/technique coverage targets are achieved or deviations are accepted;
- no unresolved defect exceeds an agreed impact threshold without explicit risk acceptance;
- planned test results and known limitations are available to decision-makers;
- residual risks are documented.

A criterion should support a decision. “100% tests passed” is weak when the suite does not represent the important risks.

Some organizations also define **suspension and resumption criteria**: conditions under which testing should stop because continued execution is wasteful, and what must change before it resumes.

## Test approach is part of the plan

The test approach explains **how the planned evidence will be obtained**. It can include:

- test levels and test objects;
- functional and relevant non-functional test types;
- specification-based, structure-based, experience-based and collaborative techniques;
- risk-based prioritization and test depth;
- manual, exploratory and automated execution;
- regression and confirmation approach;
- degree of test independence;
- environment and data strategy;
- automation boundaries and CI/CD placement;
- production or operational evidence where appropriate.

A strong approach is selective. “Run every test type at every level” is not a strategy; it ignores cost and risk.

## Test schedule is not the test plan

The schedule answers **when and in what order** planned activities occur. It should expose dependencies rather than merely give QA a start and end date.

```diagram
API contract stable
       ↓
provider sandbox configured
       ↓
integration tests
       ↓
recovery / retry tests
       ↓
focused E2E regression
       ↓
completion assessment
```

A schedule may also define test execution order. For example, fast build-verification checks can run before expensive regression so a broken environment is detected early.

## Plan → progress report → control → completion report

Planning and reporting form one feedback loop.

```diagram
TEST PLAN
What do we intend to achieve and how?
        ↓
PROGRESS / STATUS REPORT
Where are we compared with the plan?
        ↓
TEST CONTROL
What must change because reality differs?
        ↓
updated scope / priorities / schedule / approach
        ↺
TEST COMPLETION REPORT
What was actually achieved, what deviated, and what risk remains?
```

This relationship explains why a test plan is useful even in an adaptive project: the plan provides the current baseline, while control allows that baseline to change deliberately.

A useful **progress report** can communicate:

- work completed and remaining;
- evidence obtained for important risks;
- defects and blockers;
- environment/data constraints;
- relevant coverage and execution metrics;
- deviations from the current plan;
- changed product/project risks;
- forecast and next activities.

A useful **completion report** can communicate:

- what was tested and what was not;
- whether objectives and completion criteria were achieved;
- important deviations from the plan;
- significant defect status;
- achieved coverage where meaningful;
- unresolved limitations and residual risks;
- lessons or follow-up actions.

Percent passed can be useful operationally, but 99% passing tests do not imply 99% product quality. A suite can contain many low-value tests and still miss a critical risk.

> **Historical note:** the classic IEEE 829 test-documentation templates are still common in old courses and interview material. IEEE 829-2008 has been superseded by the ISO/IEC/IEEE 29119 family. Learn the purpose and information carried by test artifacts rather than memorizing an obsolete rigid template.

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

The same applies to plans. A plan that is never updated when scope, dependencies or risks change becomes historical fiction. Monitoring identifies deviation; control deliberately changes the plan or the work.

Documentation quality is therefore not measured by page count. It is measured by how effectively the artifacts preserve useful knowledge and support decisions.

## Summary

- Test documentation spans planning, analysis, design, implementation, execution, reporting and completion; test cases are only one form of testware.
- Policy, strategy, plan, approach and schedule answer different planning questions even though organizations sometimes use the labels differently.
- A test plan defines how a specific testing effort will achieve its objectives and acts as a baseline for coordination, monitoring and control.
- A useful plan covers context, basis, scope, objectives, assumptions, stakeholders, risks, approach, testware, environments/data, criteria, metrics, communication, resources and schedule.
- Entry and completion criteria should express decision-relevant conditions, not ritual percentages.
- Progress reports compare reality with the current plan; control changes the plan when needed; completion reports summarize achieved evidence, deviations and residual risk.
- Test cases, checklists and exploratory charters trade prescription, maintenance and executor freedom differently.
- Data and environment context are essential for reproducibility.
- A strong defect report separates observation, reproduction, expectation, evidence and impact.
- Severity describes impact; priority describes urgency relative to other work.
- Root-cause thinking distinguishes the visible symptom from the underlying technical and systemic causes.

## Sources

- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-3:2021 — Test documentation](https://www.iso.org/standard/79429.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [IEEE 829-2008 — superseded test documentation standard](https://standards.ieee.org/ieee/829/3787/)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
