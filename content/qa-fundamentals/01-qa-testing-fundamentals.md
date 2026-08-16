<!-- concepts: quality-vs-testing, qa-qc-testing, error-defect-failure, verification-validation, testing-objectives, testing-principles, product-quality-model -->

# QA & Testing Fundamentals

Software testing starts with a simple question: **what evidence do we need before we can trust a product enough for its intended use?** The answer is broader than running test cases. Quality is shaped by requirements, design decisions, implementation, reviews, testing, operations, user feedback and the way a team learns from failures.

## Quality is broader than testing

Testing evaluates a product or work product. Quality management is broader: it includes the organizational processes, responsibilities and practices used to make outcomes consistently meet needs and requirements. ISO 9000 provides general quality-management vocabulary, while ISO/IEC/IEEE 29119 focuses on testing as one part of that larger system.

```diagram
Quality management
├── Quality assurance: confidence in the processes used to create quality
└── Quality control: evaluation of actual outputs
    └── Software testing: one major way to evaluate software behaviour and evidence
```

Companies often use “QA engineer” as a job title for testers. That is common, but the concepts are not synonyms. A tester can contribute to quality assurance by improving requirements, testability, review practices and release criteria, not only by executing tests.

> **Common mistake:** treating QA as a final department that receives finished software and is expected to add quality at the end. Testing can expose information about quality; it cannot manufacture quality after implementation.

## Error, defect and failure

| Term | Practical meaning | Example |
| --- | --- | --- |
| Error | A human action or decision that produces an incorrect result | A tax rule is misunderstood |
| Defect / fault | A flaw in a requirement, design, code or configuration | The implementation uses the wrong tax rate |
| Failure | Observable incorrect behaviour when the defect is activated | Checkout displays the wrong total |

A defect does not always produce a failure. The faulty element may never execute, the relevant state may never occur, or another component may mask the problem.

```diagram
Human error
   ↓
Defect introduced into a work product
   ↓
Triggering condition occurs
   ↓
Incorrect internal state
   ↓
Observable failure
```

“Issue” is usually a workflow term rather than a strict technical category. An issue tracker can contain defects, tasks, questions, incidents and improvements.

## Verification and validation

A useful mnemonic is “verification asks whether we built it right; validation asks whether we built the right thing.” More precisely, verification asks whether an output conforms to the requirements or conditions established for the activity that produced it. Validation asks whether the resulting product satisfies intended use and user needs. IEEE 1012 includes analysis, reviews, inspection, assessment and testing among possible V&V activities.

```diagram
Need / intended use
      ↓
Requirements
      ↓  verification: conformance of downstream work
Design → Code → Integrated system
      ↓
Validation: satisfaction of intended use and user needs
```

## Why testing is necessary

Testing can discover failures and defects, evaluate requirements, expose product risk, build confidence in important behaviour, prevent defects by finding ambiguity early, support acceptance decisions and provide fast feedback during change.

Testing is therefore an **information-producing activity**. A passing test does not prove the product is defect-free. It proves that one observation, under specific conditions, matched an expectation.

## Fundamental testing principles

### Testing shows presence, not absence

A failing test can demonstrate a problem. A passing suite cannot logically prove that no undiscovered defect exists.

### Exhaustive testing is impossible

Input values, states, sequences, configurations and environments create enormous test spaces. Testing therefore depends on selection: partitions, boundaries, risks, representative scenarios and informed exploration.

### Early testing reduces rework

Finding ambiguity during refinement is usually cheaper than finding the same problem after implementation and release.

### Defects cluster

A small number of components often contain a large share of observed defects. History can guide attention, but new change, business impact and usage must still influence risk.

### Tests wear out

Repeatedly running unchanged tests can yield less new information as the product and failure patterns evolve. Regression checks remain useful, but coverage should be refreshed using new changes and escaped defects.

### Testing is context dependent

Two products with similar features may require very different evidence because users, consequences, regulations, environments and business risks differ.

### Absence-of-errors fallacy

A system can contain few discovered defects and still fail if it solves the wrong problem, is unusable or does not satisfy the context in which people need it.

## Software quality has multiple dimensions

ISO/IEC 25010:2023 defines a current product-quality model with nine characteristics. The central lesson is that product quality is multi-dimensional. Functional correctness is only one part of the picture; performance, compatibility, interaction, reliability, security, maintainability, flexibility and safety may also matter depending on the product.

> **Key point:** “Non-functional” never means “optional.” A so-called non-functional characteristic can be the dominant product risk.

## A practical quality mindset

Before writing test cases, ask:

1. What user or business need is this supposed to satisfy?
2. What can go wrong and what would the consequence be?
3. Which quality characteristics matter here?
4. What evidence already exists?
5. What uncertainty remains?
6. What is the cheapest useful way to reduce that uncertainty?

## Summary

- Quality is broader than testing, and QA is broader than test execution.
- Error, defect and failure describe different points in a causal chain.
- Verification focuses on conformance; validation focuses on intended use and user needs.
- Testing produces evidence and reduces uncertainty; it does not prove the absence of defects.
- Exhaustive testing is impossible, so selection and risk are fundamental.
- Product quality has multiple characteristics, not only functional correctness.

## Sources

- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-1:2022](https://www.iso.org/standard/81291.html)
- [ISO 9000:2026](https://www.iso.org/standard/9000)
- [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html)
- [IEEE 1012-2024](https://standards.ieee.org/ieee/1012/7324/)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
