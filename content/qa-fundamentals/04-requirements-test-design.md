<!-- concepts: requirement-testability, acceptance-criteria, test-condition-case-data, traceability, equivalence-partitioning, boundary-value-analysis, decision-table, state-transition, scenario-testing, white-box-coverage -->

# Requirements & Test Design

Good testing begins before detailed test cases exist. Test design is the discipline of converting requirements, risks, models and other test bases into a deliberate set of observations that can expose important problems efficiently.

## Requirement quality and testability

A requirement is easier to test when it is clear enough to determine whether the delivered behaviour satisfies it. Useful qualities include clarity, consistency, feasibility, traceability and verifiability.

Compare:

| Weak requirement | Stronger requirement |
| --- | --- |
| “The dashboard should load quickly.” | “Under the defined normal-load profile, 95% of authenticated dashboard requests shall complete within 1.5 seconds.” |
| “Passwords must be secure.” | “Passwords shall be at least 12 characters and shall reject values present in the configured compromised-password list.” |

The stronger versions do not guarantee that the requirement is correct, but they make the expected evidence much easier to reason about.

> **Key point:** discovering an untestable requirement is itself valuable testing work. You do not need runnable software to find ambiguity.

## Acceptance criteria

Acceptance criteria describe conditions that must be satisfied for a feature, story or capability to be considered acceptable. They should clarify business rules and observable outcomes rather than merely restate the implementation.

Good acceptance criteria can become part of the test basis, but they are not a complete test strategy. A tester still considers boundaries, negative paths, interactions, quality characteristics and risks that the acceptance criteria may not mention.

## From test basis to test cases

A clean design chain separates **coverage intent** from execution details.

```diagram
Test basis
   ↓
Test conditions: what needs evidence?
   ↓
Coverage items / model
   ↓
Test cases: which inputs, states and expected outcomes cover it?
   ↓
Test data and procedures
   ↓
Execution and evidence
```

A **test condition** is something that should be examined: a rule, state, risk, interface, quality characteristic or acceptance criterion. A **test case** specifies inputs, preconditions, expected results and other details needed to perform a particular check. Test data supplies the concrete values and state.

Starting directly with detailed steps often hides gaps because the tester becomes occupied with UI mechanics before establishing what must be covered.

## Traceability

Traceability links test work back to its basis and forward to results. It helps answer questions such as:

- Which requirements have evidence?
- Which high-risk requirements have no tests?
- Which tests must be reconsidered after a requirement changes?
- Which failures affect which business rules?

```diagram
Requirement / risk
      ↓
Test condition
      ↓
Test case
      ↓
Execution result
      ↓
Defect / evidence / release decision
```

Traceability does not require a giant spreadsheet. The implementation can be lightweight, but the relationships should be recoverable when they matter.

## Equivalence partitioning

Equivalence partitioning divides a large input or state space into groups expected to behave similarly. Instead of testing every possible value, the tester selects representatives from meaningful partitions.

Suppose an age field accepts integer values from 18 through 120.

| Partition | Example |
| --- | --- |
| Less than 18 | 17 |
| Valid 18–120 | 35 |
| Greater than 120 | 121 |
| Invalid type / format | text, decimal, empty depending on contract |

The technique is powerful only if the partitions are based on actual behaviour or rules. Arbitrary grouping is not equivalence partitioning.

## Boundary value analysis

Defects frequently occur at edges where behaviour changes. Boundary value analysis focuses on those transition points.

For the valid interval 18–120, useful values include those immediately around the boundaries:

```diagram
invalid        valid range                       invalid
 ... 16  17 | 18  19 ................ 119  120 | 121  122 ...
             ↑                                 ↑
          lower edge                        upper edge
```

The exact set depends on the chosen BVA variant and the data type. The reasoning is more important than memorizing a fixed formula: identify where the rule changes and test around that transition.

## Decision table testing

Decision tables are useful when outcomes depend on combinations of conditions. They make hidden combinations visible.

Example: free shipping depends on membership and basket value.

| Condition / action | Rule 1 | Rule 2 | Rule 3 | Rule 4 |
| --- | --- | --- | --- | --- |
| Premium member? | Yes | Yes | No | No |
| Basket ≥ €50? | Yes | No | Yes | No |
| Free shipping | Yes | Yes | Yes | No |

A decision table forces the team to ask whether each combination is defined and whether some conditions are irrelevant under particular rules.

## State transition testing

Some behaviour depends not only on current input but on **history and state**. State transition models represent allowed states, events and transitions.

```diagram
[Active]
   │ wrong password ×5
   ↓
[Locked]
   │ successful unlock procedure
   ↓
[Active]
```

Testing can cover valid transitions, invalid transitions, important event sequences and state-dependent outputs. This is especially useful for authentication flows, orders, subscriptions, devices and workflow engines.

## Scenario and use-case testing

Scenario-based testing follows meaningful user or business flows across several interactions. It is valuable for checking that separate rules compose into a coherent outcome.

A strong scenario is not simply “click every screen.” It has a purpose and an outcome: for example, “an existing customer changes delivery address after payment authorization but before dispatch.”

Scenarios complement focused techniques. Boundaries and partitions efficiently challenge individual rules; scenarios challenge interactions and workflow continuity.

## White-box coverage basics

White-box or structure-based techniques derive tests from the internal structure of the software.

Two basic measures are:

- **Statement coverage:** which executable statements were exercised?
- **Branch coverage:** which decision outcomes or branches were exercised?

100% statement coverage does not imply 100% branch coverage, and neither proves correctness. Coverage tells you what structure was executed, not whether assertions were meaningful or requirements were complete.

> **Common mistake:** treating code coverage as a quality score. It is a coverage signal that can reveal untested structure; it cannot prove that the exercised behaviour was tested well.

## Combining techniques

Good test design usually combines multiple lenses. For a discount engine, you might use:

1. equivalence partitions for customer types and coupon states;
2. boundary values for monetary thresholds;
3. decision tables for interacting business rules;
4. state transitions for coupon activation and expiry;
5. scenarios for realistic purchase journeys;
6. structural coverage to find important implementation paths missed by specification-based tests.

The result is stronger than repeating the same happy path at several layers.

## Summary

- Testable requirements make expected evidence observable and decidable.
- Test conditions should be identified before detailed execution steps.
- Traceability connects requirements and risks to tests and results.
- Equivalence partitioning reduces large spaces to meaningful representatives.
- Boundary analysis focuses on points where behaviour changes.
- Decision tables model combinations; state transitions model history-dependent behaviour.
- Scenario testing and structural coverage add different evidence rather than replacing black-box techniques.

## Sources

- [ISO/IEC/IEEE 29148:2018 — Requirements engineering](https://www.iso.org/standard/72089.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-4:2021 — Test techniques](https://www.iso.org/standard/79430.html)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
