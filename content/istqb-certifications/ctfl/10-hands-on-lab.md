# CTFL hands-on practice lab

Apply the techniques to fixed rules and check your work with an independent oracle. Requires Python 3.10+ and the repository; no AI tool is required.

## Requirements and expected coverage

The age domain is all integers; valid age is 18–65 inclusive. Derive three partitions and 2-value BVA 17,18,65,66; 3-value BVA 16,17,18,19,64,65,66,67. Repeat for 1–1 to see overlap and deduplication.

Discount rules: member and subtotal >=100 →20%; member only →10%; subtotal >=100 only →5%; otherwise →0%. Cover all four rules and negative input rejection. Use 99 and 100 for both membership values.

State model: draft/submit →submitted, submitted/approve →approved, submitted/reject →draft, approved/archive →archived. Derive a valid sequence covering all transitions and attempt archived/approve independently as an invalid event.

## Run, challenge and explain

Use the [practice package](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice). Run `python examples/certification-practice/practice.py ctfl`. The reference passes. Copy the intentionally unfinished starter, implement boundary_values, discount_percent and transition, then pass its path with --candidate. It should fail until implemented.

Do not read the reference before deriving expected values. Change >=100 to >100 and show the oracle catching the defect. Retain the requirement-to-case coverage table, expected/actual values and exit status. A green fixture run covers those rules, not every possible software behavior or the entire CTFL syllabus.
