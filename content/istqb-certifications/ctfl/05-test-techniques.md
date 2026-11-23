# Test analysis and design

Chapter 4 carries the most exam weight and most K3 questions. Work every example below on paper.

## Equivalence partitioning (EP)

Divide data into partitions that the test object is expected to process the same way, including invalid partitions. **Coverage:** partitions exercised divided by total partitions. With several independent parameters, **each choice coverage** requires every partition of every parameter to be exercised at least once.

Example: an age field accepts 18 to 65. Partitions: below 18 (invalid), 18–65 (valid), above 65 (invalid). Three test values give 100% EP coverage.

## Boundary value analysis (BVA)

Applies to ordered partitions. Boundaries are the minimum and maximum of each partition.

- **2-value BVA:** each boundary and its closest neighbour in the adjacent partition. For 18–65: 17, 18, 65, 66.
- **3-value BVA:** each boundary and both neighbours. For 18–65: 17, 18, 19, 64, 65, 66.

Coverage is boundary values exercised divided by boundary values identified.

## Decision table testing

Conditions and actions form the rows; each column is a combination of condition values (a rule) with its resulting actions. **Coverage** is the share of feasible columns exercised. Infeasible combinations are removed, and tables can be collapsed with "–" for irrelevant conditions. Three binary conditions give 2 × 2 × 2 = 8 full columns.

## State transition testing

A state diagram or table shows states, events and transitions, with optional guard conditions and actions.

- **All states coverage:** every state visited.
- **Valid transitions coverage (0-switch):** every valid transition exercised.
- **All transitions coverage:** every valid transition exercised and every invalid transition attempted. This is the strongest of the three.

## White-box techniques

- **Statement coverage:** executed statements divided by all executable statements.
- **Branch coverage:** exercised branches divided by all branches, including both outcomes of every decision.
- 100% branch coverage implies 100% statement coverage, but not the other way round.
- White-box techniques can find defects even where the specification is vague, but cannot find missing functionality.

## Experience-based techniques

- **Error guessing:** anticipate errors, defects and failures from experience; fault attacks are a structured form.
- **Exploratory testing:** simultaneous design, execution and evaluation, often session-based with a test charter.
- **Checklist-based testing:** high-level checklists, kept current from experience.

## Collaboration-based approaches

- **Collaborative user story writing:** the 3 Cs: Card, Conversation, Confirmation. Good stories are INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable.
- **Acceptance criteria:** scenario-oriented (Given/When/Then) or rule-oriented (bullet lists, input-output tables).
- **ATDD:** specification workshop, then test cases from acceptance criteria, written before development, positive cases first.

## Worked calculation

A program has 10 statements and 4 branches (two decisions). One test executes 8 statements and 2 branches. Statement coverage is 80%; branch coverage is 50%. Adding a test that takes the other outcome of both decisions and executes the 2 remaining statements brings both to 100%.
