<!-- concepts: requirement-testability, requirement-set-quality, requirement-relations, acceptance-criteria, test-condition-case-data, traceability, equivalence-partitioning, boundary-value-analysis, decision-table, state-transition, scenario-testing, white-box-coverage -->

# Requirements & Test Design

Good testing begins before detailed test cases exist. Test design is the discipline of converting requirements, risks, models and other test bases into a deliberate set of observations that can expose important problems efficiently.

## Good requirements: review the requirement and the set

A requirement can be perfectly testable on its own and still be wrong in context. Requirement review therefore has two different scopes:

```diagram
Individual requirement
→ Is this statement good enough by itself?

Requirements set
→ Do all requirements work together as one coherent specification?
```

Both matter. Testing only the wording of individual requirements can miss contradictions, duplication and gaps between them.

## Characteristics of a good individual requirement

Useful requirement characteristics are not just academic labels. Each one gives the tester a concrete review question.

| Characteristic | What it means | Tester question |
| --- | --- | --- |
| **Clear & unambiguous** | The statement has one intended interpretation. | Could two reasonable people read this differently? |
| **Verifiable / testable** | There is observable evidence that can show whether it is satisfied. | What exactly would make this pass or fail? |
| **Complete** | The statement contains the information needed to understand the expected behaviour. | Are inputs, conditions, outcomes, errors or boundaries missing? |
| **Feasible** | The requirement can realistically be implemented within technical and project constraints. | Is this achievable with the available technology, interfaces, time and resources? |
| **Necessary** | It contributes to a real stakeholder, business, regulatory or system need. | What would fail or lose value if we removed it? |
| **Singular / atomic** | It expresses one main obligation or behaviour rather than several unrelated rules joined together. | Would part of this requirement pass while another part fails? |
| **Consistent** | It does not contradict known rules, terminology or related requirements. | Does another requirement say something incompatible? |
| **Traceable** | Its origin and downstream consequences can be identified. | Where did this requirement come from, and what depends on it? |
| **Implementation-independent where appropriate** | It states the required outcome without unnecessarily prescribing a design solution. | Does it say what must be achieved, or accidentally dictate how developers must build it? |

> **Important:** “implementation-independent” is not absolute. Architecture, security, regulatory, protocol or platform requirements may legitimately constrain implementation. The problem is unnecessary design detail masquerading as a business or behavioural requirement.

### Weak vs stronger examples

| Weak requirement | Why it is weak | Stronger requirement |
| --- | --- | --- |
| “The dashboard should load quickly.” | “Quickly” has no measurable meaning. | “Under the defined normal-load profile, 95% of authenticated dashboard requests shall complete within 1.5 seconds.” |
| “Passwords must be secure.” | “Secure” is not a decidable rule. | “Passwords shall contain at least 12 characters and shall reject values present in the configured compromised-password list.” |
| “The user can edit the profile and the system sends a notification.” | Two behaviours are coupled into one requirement. | Separate profile-update behaviour from notification behaviour and define their relationship explicitly. |
| “Use Redis to make the page faster.” | It jumps to a solution while the actual required outcome is unclear. | Define the required latency/capacity first; constrain technology separately only if there is a real architectural reason. |

A tester should not ask only “Can I write a test case?” A stronger review asks:

```diagram
Do I understand exactly what is required?
        ↓
Can I observe whether it happened?
        ↓
Are preconditions, inputs and boundaries defined?
        ↓
Are failure and exception behaviours defined where needed?
        ↓
Is this requirement necessary and feasible?
        ↓
Does it agree with related requirements?
        ↓
Can I trace its origin and downstream evidence?
```

> **Key point:** discovering an ambiguous, contradictory or unverifiable requirement is testing work. Runnable software is not required to find these defects.

## Characteristics of a good requirements set

Individual quality is not enough. A collection of individually clear requirements can still form a poor specification.

A useful requirements-set review checks for:

- **Completeness:** important behaviours, states, interfaces, constraints and failure cases are not missing.
- **Consistency:** requirements do not contradict one another.
- **Non-duplication:** the same rule is not repeated in several places with slightly different wording.
- **Coherent terminology:** the same concepts, states, actors and data have the same meaning throughout the set.
- **Traceability:** parent, derived and dependent requirements can be followed in both directions.
- **Correct decomposition:** high-level needs are refined into lower-level requirements without silently losing part of the intent.
- **Modifiability:** one business rule should have a clear authoritative place so that a change does not require hunting through many conflicting copies.
- **Coverage of important quality constraints:** performance, security, reliability, compatibility, accessibility, safety and other relevant concerns are not forgotten just because the functional happy path is documented.

### Example: individually testable, collectively contradictory

```text
REQ-21: Guest users shall be able to complete checkout without creating an account.

REQ-37: Every checkout shall require an authenticated customer account.
```

Both statements are clear. Both are testable. The defect exists **between the requirements**.

This is why “testable requirements” and “a testable requirements set” are not the same thing.

## Requirements-to-requirements relationships

Requirements rarely exist as a flat list. They usually form a network of relationships.

Common relationships include:

| Relationship | Meaning | Example |
| --- | --- | --- |
| **Derived from / refines** | A lower-level requirement makes a higher-level need more concrete. | A business need for account protection is refined into password, MFA and session requirements. |
| **Parent / child** | A broad requirement is decomposed into smaller requirements. | “Support checkout” → payment, address, tax and confirmation requirements. |
| **Depends on / prerequisite** | One requirement only makes sense or can operate when another is satisfied. | Refund processing depends on a completed payment. |
| **Constrains** | One requirement limits how another may behave. | A security rule constrains how customer data may be displayed. |
| **Interacts with** | Two requirements affect the same state, data or workflow and must be reviewed together. | Cancellation interacts with payment settlement and inventory reservation. |
| **Conflicts with** | Two requirements cannot both be true under the same conditions. | Guest checkout allowed vs authentication required for every checkout. |
| **Overlaps / duplicates** | Two requirements express the same or nearly the same rule. | Password length is defined differently in two separate security sections. |

A practical requirements graph can look like this:

```diagram
User / stakeholder need
          ↓
Business requirement
          ↓
System requirement
          ↓
Software / feature requirement
          ↓
Acceptance criteria
          ↓
Test condition
          ↓
Test case
          ↓
Execution result / defect / evidence
```

But the useful model is not only vertical. Requirements also connect sideways:

```diagram
REQ-12 ──depends on────→ REQ-07
REQ-12 ──refines──────→ REQ-04
REQ-15 ──interacts with→ REQ-18
REQ-21 ──conflicts with→ REQ-37
```

These links make requirement review and change-impact analysis much stronger than treating every requirement as an isolated row in a document.

## Acceptance criteria

Acceptance criteria describe conditions that must be satisfied for a feature, story or capability to be considered acceptable. They should clarify business rules and observable outcomes rather than merely restate the implementation.

Good acceptance criteria can become part of the test basis, but they are not a complete test strategy. A tester still considers boundaries, negative paths, interactions, quality characteristics and risks that the acceptance criteria may not mention.

Acceptance criteria also do not repair a contradictory requirement set. If two parent requirements conflict, writing precise Given/When/Then examples for both simply makes the conflict easier to see.

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

## Bidirectional traceability

Traceability should work in both directions.

**Forward traceability** asks what happened to a requirement:

```diagram
Need / requirement
      ↓
Derived requirements / acceptance criteria
      ↓
Test conditions
      ↓
Test cases
      ↓
Results / defects / release evidence
```

It helps answer:

- Has this requirement been decomposed and implemented?
- Which tests provide evidence for it?
- Does it have execution results?
- Which defects currently affect it?

**Backward traceability** asks why an artifact exists:

```diagram
Test / implementation / lower-level requirement
      ↑
Which requirement or risk justified it?
      ↑
Which business or stakeholder need justified that?
```

It helps detect unnecessary functionality, orphan tests, undocumented behaviour and lower-level requirements with no valid origin.

Traceability is also useful **between requirements themselves**:

- Which lower-level requirements refine this business requirement?
- If REQ-12 changes, which dependent requirements must be reviewed?
- Does every derived requirement still preserve the parent intent?
- Are two requirements defining the same rule differently?
- Does a new requirement conflict with an existing constraint?

A traceability matrix can be useful, but a giant spreadsheet is not the goal. The implementation can be IDs, links, issue relationships, model references or automated metadata. What matters is that the important relationships can be recovered reliably when coverage or change-impact questions arise.

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

For the valid integer interval 18–120:

```diagram
invalid        valid range                       invalid
 ... 16  17 | 18  19 ................ 119  120 | 121  122 ...
             ↑                                 ↑
          lower edge                        upper edge
```

CTFL v4.0.1 distinguishes two common BVA variants:

- **2-value BVA:** exercise the boundary value and the nearest value in the adjacent partition. Around the lower boundary that gives 17 and 18; around the upper boundary, 120 and 121.
- **3-value BVA:** exercise the boundary plus the nearest value on both sides. Around the lower boundary that gives 17, 18 and 19; around the upper boundary, 119, 120 and 121.

The exact values still depend on the data type and business rule. A continuous measurement, date/time boundary or string-length limit needs a model appropriate to that domain.

> **Common mistake:** memorizing “boundary numbers” without identifying where behaviour actually changes. BVA starts from a rule and its partitions, not from a fixed formula.

## Decision table testing

Decision tables are useful when outcomes depend on combinations of conditions. They make hidden combinations visible.

Suppose free shipping is granted when the customer is premium **or** the basket is at least €50:

| Condition / action | Rule 1 | Rule 2 | Rule 3 | Rule 4 |
| --- | --- | --- | --- | --- |
| Premium member? | Yes | Yes | No | No |
| Basket ≥ €50? | Yes | No | Yes | No |
| Free shipping | Yes | Yes | Yes | No |

The table exposes all four combinations. From it we can derive four focused tests instead of writing UI-centric cases first.

```diagram
Rules first
   ↓
Choose one concrete input set for each relevant rule
   ↓
Execute through the cheapest useful interface
   ↓
Confirm the expected action for that rule
```

If the business later says “premium customers get free shipping only inside the EU,” the decision table immediately shows that another condition has entered the model and combinations must be reconsidered.

## State transition testing

Some behaviour depends not only on current input but on **history and state**. State transition models represent allowed states, events and transitions.

Example: an account locks after five consecutive incorrect PIN attempts.

```diagram
[Active]
   │ wrong PIN #1–#4
   └───────────────↺ [Active]
   │ wrong PIN #5
   ↓
[Locked]
   │ successful unlock procedure
   ↓
[Active]
```

Useful test conditions include:

- a valid transition: Active → Locked after the fifth consecutive failure;
- a valid recovery transition: Locked → Active after the approved unlock procedure;
- an invalid transition: a correct PIN must not authenticate while the account remains Locked;
- a sequence rule: a successful login before the fifth failure may reset the consecutive-failure counter if the specification says so.

This is why state models are stronger than isolated input/output cases for authentication, orders, subscriptions, devices and workflow engines.

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

## Useful techniques beyond the CTFL Foundation core

The uploaded course material also contains techniques worth knowing, but they should not be presented as if they are all part of the current CTFL Foundation technique set.

- **Pairwise / combinatorial testing** reduces configuration combinations by covering selected interactions between parameter values.
- **Cause-effect modeling** helps turn logical relationships between conditions and outcomes into test conditions, often feeding a decision table.
- **Use-case/scenario testing** explores meaningful end-to-end interactions.
- **Mutation testing** evaluates test-suite effectiveness by introducing controlled code changes; it belongs at a more advanced engineering level.

Likewise, **positive testing**, **negative testing** and **exhaustive testing** should not be shown as peer test-design techniques. Positive/negative describe the intent of examples; exhaustive testing is generally impossible except for small finite spaces.

## Combining techniques

Good test design usually combines multiple lenses. For a discount engine, you might use:

1. equivalence partitions for customer types and coupon states;
2. 2-value or 3-value BVA for monetary thresholds;
3. decision tables for interacting business rules;
4. state transitions for coupon activation and expiry;
5. scenarios for realistic purchase journeys;
6. structural coverage to find important implementation paths missed by specification-based tests;
7. pairwise coverage when many environment or configuration parameters interact.

The result is stronger than repeating the same happy path at several layers.

## Summary

- Review both **individual requirements** and the **requirements set**.
- Good individual requirements should be clear, verifiable, complete, feasible, necessary, singular, consistent and traceable.
- A requirements set must also be complete, mutually consistent, non-duplicative and coherently structured.
- Requirements-to-requirements relationships expose dependencies, decomposition, overlap and conflicts that isolated review misses.
- Bidirectional traceability connects stakeholder needs, requirements, tests, results and defects in both directions.
- Test conditions should be identified before detailed execution steps.
- Equivalence partitioning reduces large spaces to meaningful representatives.
- CTFL distinguishes 2-value and 3-value boundary value analysis.
- Decision tables model combinations; state transitions model history-dependent behaviour.
- Scenario testing and structural coverage add different evidence rather than replacing black-box techniques.
- Pairwise and cause-effect techniques are useful extensions, while positive/negative labels are not separate formal test-design techniques.

## Sources

- [ISO/IEC/IEEE 29148:2018 — Requirements engineering](https://www.iso.org/standard/72089.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-4:2021 — Test techniques](https://www.iso.org/standard/79430.html)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
