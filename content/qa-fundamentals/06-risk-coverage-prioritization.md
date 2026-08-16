<!-- concepts: product-project-risk, likelihood-impact, risk-based-testing, coverage-meaning, prioritization, completion-criteria, estimation, residual-risk -->

# Risk, Coverage & Prioritization

Because exhaustive testing is impossible, every testing effort allocates attention. Risk-based testing makes that allocation explicit: spend more evidence-gathering effort where failure is more plausible or more consequential, while maintaining enough breadth to notice unexpected change.

## Product risk and project risk

**Product risk** concerns undesirable outcomes in the product: wrong calculations, data loss, unsafe behaviour, security exposure, unavailable service, regulatory failure or poor usability.

**Project risk** concerns the ability to deliver or test effectively: missing environments, late dependencies, insufficient skills, unstable builds, unavailable data or unrealistic schedules.

The two interact. An unavailable realistic environment is a project risk that can leave a high-impact product risk insufficiently tested.

## Likelihood and impact

A simple model treats risk exposure as a combination of likelihood and impact.

```diagram
Risk exposure ≈ likelihood × impact

high likelihood + high impact    → investigate deeply and early
high likelihood + low impact     → useful but proportionate coverage
low likelihood  + high impact    → often still deserves strong evidence
low likelihood  + low impact     → lighter evidence may be rational
```

The formula is not a precise prediction. It is a conversation tool. Teams should also consider detectability, exposure, user frequency, legal obligations, reversibility and available mitigations.

## Risk-based testing

Risk-based testing uses risk information to influence test scope, priority, depth, techniques, independence and timing.

For example, a payment total calculation may receive boundary and decision-table coverage at service level, a small UI wiring check, contract tests around the payment provider and production monitoring. A cosmetic preference screen may receive exploratory and regression coverage but not the same depth.

Risk-based testing does **not** mean ignoring everything outside the top risks. Unknown defects exist. Strong strategies combine focused depth with a broad safety net.

## What coverage means

Coverage describes how much of a defined model has been exercised. The model might be:

- requirements;
- risk items;
- equivalence partitions;
- boundaries;
- decision-table rules;
- states and transitions;
- code statements or branches;
- platforms or configurations;
- user journeys.

A coverage number is meaningful only when the denominator is clear.

“80% coverage” is incomplete information. Eighty percent of statements, requirements, browsers, risk items or decision rules are very different claims.

> **Common mistake:** using coverage as a proxy for product quality. Coverage tells you what part of a chosen model received evidence. It does not tell you that the model was complete or that the tests were strong.

## Test prioritization

Prioritization determines what should run or be investigated first when time is limited. Useful factors include:

1. risk and business impact;
2. recent code or configuration change;
3. historical defect concentration;
4. usage frequency;
5. dependency criticality;
6. speed and diagnostic value of the test;
7. whether a failure would block further testing.

This is why smoke tests are usually fast and broad: their purpose is to detect blockers before expensive deeper work begins.

## Entry, exit and completion criteria

Teams use several related labels for conditions governing when testing should start or when enough evidence exists to stop a phase or make a decision.

Examples of useful criteria include:

- required environment and data are available;
- critical interfaces are deployed;
- agreed high-risk scenarios have evidence;
- no unresolved defect exceeds an agreed impact threshold without explicit acceptance;
- planned coverage has been achieved or deviations are documented;
- residual risks are communicated to the decision owner.

Criteria should support a decision, not create false certainty. “100% tests passed” may be meaningless if the wrong tests were selected.

## Estimation basics

Test estimation predicts effort, duration or capacity needs under uncertainty. Common inputs include scope size, complexity, risk, test levels, environment setup, data preparation, automation work, retesting, regression, coordination and historical performance.

Estimates should expose assumptions. Compare:

> “Testing will take five days.”

with:

> “Five days assumes the staging environment and seed data are available Monday, the payment provider sandbox is stable, and no critical defect requires a full regression rerun.”

The second statement is much more useful because it makes uncertainty visible.

## Residual risk

Testing reduces uncertainty; it does not eliminate risk. **Residual risk** is the risk that remains after planned controls, testing and fixes.

Release decisions therefore should not be framed as QA declaring a product “safe” or “bug-free.” A useful release statement communicates:

- what evidence exists;
- which important areas were not covered;
- which defects remain;
- known environment limitations;
- expected consequences if the remaining risks occur;
- available mitigations, rollback or monitoring.

```diagram
Initial risk
   ↓
prevention + reviews + testing + fixes + mitigations
   ↓
Residual risk
   ↓
Business / product decision with explicit ownership
```

## A practical example

Suppose a release changes login styling and payment retry logic on the same day.

The styling change touches many files but has limited business impact. The payment change touches only a few lines but could duplicate charges. File count is therefore a poor proxy for test priority.

A risk-based response might prioritize:

1. idempotency and duplicate-charge scenarios;
2. payment-provider timeout and retry behaviour;
3. confirmation of the fixed defect;
4. regression around order state and refunds;
5. broad login smoke checks;
6. visual and compatibility checks for the styling change.

Risk changes the order and depth of evidence gathering.

## Summary

- Product risks concern undesirable product outcomes; project risks threaten the ability to deliver or test effectively.
- Likelihood and impact are useful starting dimensions, not precise mathematics.
- Risk-based testing directs depth and priority while preserving broad awareness.
- Coverage is always coverage of a defined model, not a universal quality percentage.
- Completion criteria should support decisions rather than create ritual gates.
- Estimates should expose assumptions and uncertainty.
- Residual risk belongs in release communication and must have an explicit decision owner.

## Sources

- [ISO/IEC/IEEE 16085:2021 — Risk management](https://www.iso.org/standard/74371.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-2:2021 — Test processes](https://www.iso.org/standard/79428.html)
- [ISO/IEC/IEEE 29119-4:2021 — Test techniques](https://www.iso.org/standard/79430.html)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
