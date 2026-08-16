<!-- concepts: work-product-reviews, review-types-roles, exploratory-testing, error-guessing, checklist-based, collaboration-feedback, oracle-problem -->

# Static, Exploratory & Collaborative Testing

Some of the highest-value testing happens without executing the product and without following a predefined script. Reviews, exploratory investigation and collaborative feedback expose different classes of risk than repeated scripted checks.

## Work-product reviews

Static testing examines work products without executing the software under test. Requirements, user stories, designs, API contracts, architecture decisions, test cases, source code and operational procedures can all be reviewed.

A requirement review can find contradictions before implementation exists. A design review can identify an interface that will be difficult to observe or control in testing. A test-case review can expose missing expected results before execution wastes time.

```diagram
Requirement → review before coding
Design      → review before implementation is fixed
Code        → review / static analysis before runtime failure
Testware    → review before misleading evidence is produced
```

ISO/IEC 20246 provides a generic framework for work-product reviews. The broader lesson is that early examination of information can prevent defects rather than only detect their runtime consequences.

## Review approaches and roles

Reviews vary in formality. A lightweight peer review may involve two people discussing a story. More formal reviews can define roles, entry criteria, individual preparation, issue logging and follow-up.

Common responsibilities include:

- **author:** provides the work product and clarifies intent;
- **reviewer:** examines the work product for defects, risks and improvements;
- **moderator/facilitator:** keeps the review focused and ensures the process works;
- **scribe:** records findings when formal evidence is needed;
- **decision owner:** accepts, rejects or prioritizes actions when that responsibility is required.

The names vary. The important point is to separate evaluating the work product from attacking the person who created it.

> **Common mistake:** turning review meetings into live proofreading sessions where nobody prepares. Individual examination followed by focused discussion is often far more effective.

## Exploratory testing

Exploratory testing integrates learning, test design and execution. The tester forms hypotheses, interacts with the product, observes behaviour, adapts to what is discovered and chooses the next useful experiment.

It is not random clicking. Strong exploratory work has a mission, useful notes, deliberate observations and a reason for each change in direction.

A simple charter might be:

> Explore checkout recovery after network interruption, focusing on duplicate orders, stale totals and user-visible recovery messages.

The charter defines purpose without prescribing every action.

## How an exploratory session evolves

```diagram
Question / charter
      ↓
Experiment
      ↓
Observation
      ↓
New information
   ↙       ↘
refine      follow a surprising clue
model       ↓
   ↘       next experiment
      ↺
```

This adaptive loop is particularly valuable for new features, complex workflows, usability problems and areas where the team does not yet know the likely failure patterns.

## Error guessing

Error guessing is an experience-based technique that uses knowledge of common failures, previous defects, architecture and domain behaviour to select tests.

Examples include trying:

- duplicate submissions after a timeout;
- empty or stale cached data;
- timezone boundaries;
- interrupted uploads;
- expired sessions;
- repeated retries;
- unusual but valid Unicode input;
- concurrent updates to the same record.

Error guessing becomes stronger when the knowledge is explicit. Escaped defects and incident history can be converted into reusable heuristics rather than remaining only in one tester's memory.

## Checklist-based testing

A checklist records important areas or heuristics without specifying a complete procedure. It provides repeatability while preserving room for judgment.

For a file-upload feature, a checklist might include file size boundaries, allowed types, cancellation, duplicate names, network interruption, accessibility of errors, retry behaviour and storage cleanup.

Checklists are useful when detailed cases would be too expensive but important coverage should not depend entirely on memory.

## Collaborative testing

Quality improves when product, development, operations and testing exchange information before decisions become expensive to change.

Useful collaboration can include:

- reviewing examples and acceptance criteria before implementation;
- discussing observability and testability during design;
- pairing on difficult failure investigation;
- reviewing automated checks for whether they protect meaningful risks;
- sharing production incident evidence with the people designing future tests.

A tester's contribution is often a question that changes the design before a test case is ever written.

## Fast feedback beats late handoff

Consider two workflows.

```diagram
Late handoff
Product → Development → QA → defect → Development → QA
                         ↑ expensive feedback loop

Collaborative feedback
Product ↔ Development ↔ Testing ↔ Operations
          frequent questions and evidence
```

The second model does not remove specialist testing skills. It makes those skills available earlier.

## The test oracle problem

A **test oracle** is the mechanism or source used to determine whether an observed result is correct. Requirements, calculations, reference systems, invariants, domain rules and human judgment can all act as oracles.

The oracle problem appears when it is difficult to know the correct answer even though execution is easy.

Examples:

- a recommendation algorithm produces a plausible result, but what result is “correct”?
- a data migration transforms millions of records, but there is no independent reference output;
- a rendering engine produces a complex image where exact pixel equality is inappropriate.

In such cases, testers may use properties, consistency checks, independent calculations, metamorphic relations, sampling, comparison with previous versions or domain-expert review.

> **Key point:** automation does not solve the oracle problem. An automated assertion is only as trustworthy as the expectation behind it.

## Combining structured and exploratory evidence

Strong testing rarely chooses between “documented” and “exploratory” as opposites. A mature approach might use stable automated regression checks for known rules, detailed procedures where evidence must be reproducible, checklists for recurring heuristics and exploratory sessions to investigate uncertainty.

The combination depends on risk and context.

## Summary

- Static testing can find defects in requirements, designs, code and testware before runtime execution.
- Review formality should match context, but roles and focused preparation improve quality.
- Exploratory testing is adaptive, purposeful investigation rather than random clicking.
- Error guessing converts experience and incident history into targeted test ideas.
- Checklists preserve important coverage while leaving execution flexible.
- Collaboration moves testing insight earlier in the decision process.
- Every test depends on an oracle; knowing how to judge correctness is a fundamental testing problem.

## Sources

- [ISO/IEC 20246:2017 — Work product reviews](https://www.iso.org/standard/67407.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-4:2021 — Test techniques](https://www.iso.org/standard/79430.html)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
