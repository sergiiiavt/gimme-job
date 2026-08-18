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

## Product quality characteristics

Functional correctness is only one dimension of product quality. ISO/IEC 25010:2023 defines a product-quality model with **nine characteristics**. The model is useful not as a list to memorize, but as a set of lenses for reviewing requirements, identifying risks, defining test objectives and deciding what evidence is missing.

```diagram
Product quality
├── Functional suitability
├── Performance efficiency
├── Compatibility
├── Interaction capability
├── Reliability
├── Security
├── Maintainability
├── Flexibility
└── Safety
```

A tester should ask: **which of these characteristics could make this feature unacceptable even if its main functional flow works?**

### Functional suitability

**Meaning:** the product provides the functions needed for the intended tasks, and those functions produce correct and appropriate results.

Think about:

- missing or unnecessary functionality;
- incorrect calculations, decisions or business rules;
- whether the function actually helps the user complete the intended task.

**Example:** checkout calculates the correct tax and total, supports the required payment methods, and produces the expected order state.

**Tester questions:**

- Is every required function present?
- Are outputs correct for valid, invalid and boundary conditions?
- Does the function solve the actual user/business need rather than merely execute without error?

### Performance efficiency

**Meaning:** the product delivers acceptable performance while using time, processing, memory, network and other resources appropriately for the expected load and capacity.

Think about:

- response time and latency;
- throughput;
- resource consumption;
- capacity and behaviour as load grows.

**Example:** a search page may be functionally correct but still unacceptable if normal queries take 12 seconds or memory usage grows until the service crashes.

**Tester questions:**

- What response time is acceptable, and under what load?
- What is the expected peak throughput or data volume?
- What happens when capacity limits are approached or exceeded?
- Does resource usage remain stable over time?

### Compatibility

**Meaning:** the product can coexist with required products or environments and exchange information correctly with other systems.

Think about:

- interoperability between services and external systems;
- protocol and data-format compatibility;
- operating-system, browser, device or platform combinations where relevant;
- coexistence with other software sharing the same environment or resources.

**Example:** an application works correctly with the supported identity provider and payment API, and a client upgrade does not break the agreed API contract.

**Tester questions:**

- Which systems, versions, protocols and environments must work together?
- What happens when one side uses a different supported version?
- Are exchanged data, states and errors interpreted consistently on both sides?

### Interaction capability

**Meaning:** specified users can understand and interact with the product effectively to complete tasks in the intended context of use.

Think about:

- whether users can recognize what actions are available;
- learnability and operability;
- protection from avoidable user errors;
- clear feedback and assistance;
- accessibility and inclusive interaction.

**Example:** a destructive action is clearly identified, accidental activation is difficult, validation messages explain how to recover, and keyboard-only users can complete the same workflow.

**Tester questions:**

- Can a new user understand what to do without hidden knowledge?
- Are states, actions and errors understandable?
- Can users recover from mistakes?
- Can people with relevant accessibility needs complete the workflow?

### Reliability

**Meaning:** the product continues to perform required functions consistently under stated conditions and can tolerate or recover from failures where required.

Think about:

- availability;
- stability over time;
- fault tolerance;
- recovery and continuity after interruption.

**Example:** the payment provider becomes unavailable for 30 seconds. The application does not create duplicate orders, communicates the situation correctly, and can continue or recover safely when the dependency returns.

**Tester questions:**

- What happens if a dependency is slow, unavailable or returns malformed data?
- Can the system recover after restart, network loss or partial failure?
- Is committed data preserved correctly?
- Does repeated operation remain stable over time?

### Security

**Meaning:** the product protects information and operations so that access and change occur only as intended, and relevant actions can be trusted and accounted for.

Think about:

- confidentiality;
- integrity;
- authentication and authorization;
- accountability and auditability;
- resistance to misuse and attack.

**Example:** User A must not read or modify User B's private data even by changing an identifier in an API request.

**Tester questions:**

- Who is allowed to see or change this data?
- Can permissions be bypassed through another interface or object ID?
- Can data be modified without detection?
- Are sensitive actions attributable to the correct actor?

### Maintainability

**Meaning:** the product can be understood, analyzed, modified and tested without unreasonable effort or unintended damage.

This characteristic is partly visible through engineering evidence rather than ordinary end-user UI testing.

Think about:

- modularity and separation of concerns;
- ease of diagnosing a problem;
- ease and safety of modification;
- testability of components and behaviour.

**Example:** changing one pricing rule should not require unrelated changes across many modules, and the rule should be testable through a stable interface.

**Tester questions:**

- Can failures be localized and diagnosed from available evidence?
- Can important behaviour be tested without excessive setup or fragile dependencies?
- Does a small change create unusually broad regression risk?
- Are modules/interfaces structured so they can evolve independently where expected?

### Flexibility

**Meaning:** the product can adapt to different environments, configurations, resources or changing needs without inappropriate redesign.

Think about:

- adaptability to supported environments;
- configuration and replaceable dependencies;
- scalability to different deployment conditions;
- ease of installing, replacing or migrating product components where relevant.

**Example:** the same service can run in supported deployment environments using configuration rather than code forks, or an external provider can be replaced behind an agreed interface.

**Tester questions:**

- Which environments and configurations must be supported?
- Can expected variation be handled through configuration rather than source-code changes?
- What happens during installation, migration, upgrade or component replacement?
- Does the product still behave correctly when supported resources or topology change?

### Safety

**Meaning:** the product avoids creating unacceptable risk of harm to people, property, the environment or other protected assets when it operates or fails.

Safety is especially important in medical, automotive, industrial, aerospace, robotics and other cyber-physical systems, but the principle can matter anywhere software actions can cause real-world harm.

Think about:

- hazardous states;
- safe limits and interlocks;
- fail-safe behaviour;
- warnings and recovery from unsafe conditions.

**Example:** if a sensor reports impossible values, an industrial controller must not blindly issue a command that could move equipment into a dangerous state.

**Tester questions:**

- What harmful outcome could this function contribute to?
- Which combinations of failure can create a hazardous state?
- What must the system do when it cannot determine a safe action?
- Are safety constraints still enforced when components fail or data is corrupted?

## Quality characteristics are not test levels

A quality characteristic describes **what aspect of quality is being evaluated**. A test level describes **where the test object or interaction boundary sits**.

The same characteristic can be evaluated at several levels:

```diagram
Security
├── Component: permission helper rejects unauthorized action
├── Component integration: service and database enforce ownership consistently
├── System: user cannot access another user's data
└── System integration: identity provider claims are validated correctly
```

Likewise, system testing can evaluate functional suitability, performance, reliability, security, interaction capability or several characteristics together.

> **Common mistake:** treating “performance testing,” “security testing,” “system testing,” “integration testing” and “regression testing” as one flat taxonomy. They describe different dimensions of a test.

## Turn a quality characteristic into a testable requirement

A characteristic such as “fast,” “secure,” “reliable” or “easy to use” is too broad to test by itself. The characteristic should lead to a **measurable or otherwise decidable requirement** in the relevant context.

| Vague quality statement | Better requirement direction |
| --- | --- |
| “The page should be fast.” | Define operation, workload, percentile and response-time target. |
| “The service should be reliable.” | Define availability/recovery expectations and failure conditions. |
| “The system should be secure.” | Define assets, actors, permissions, threats or security controls that must hold. |
| “The UI should be accessible.” | Define the applicable accessibility criteria, supported interaction modes and conformance target. |
| “The application should scale.” | Define expected load/data growth, resources and acceptable degradation. |

A useful pattern is:

```diagram
Quality characteristic
        ↓
Relevant risk or stakeholder need
        ↓
Concrete quality requirement / constraint
        ↓
Observable measure or acceptance criterion
        ↓
Test condition and evidence
```

For example:

```text
Weak:
The API must be reliable.

Stronger:
After a transient connection failure occurring before the server confirms an order,
a client retry using the same idempotency key shall not create a second order.
```

The stronger requirement does not attempt to describe all of reliability. It converts one important reliability risk into behaviour that can be evaluated.

> **Key point:** “non-functional” does not mean “optional.” A product can be functionally correct and still be unacceptable because it is too slow, inaccessible, insecure, unreliable or unsafe.

## Using quality characteristics during testing

Do not mechanically test all nine characteristics for every feature. Use them as prompts during requirement review and risk analysis.

For a new feature, ask:

1. Which characteristics could materially affect user or business success?
2. Which characteristics create the highest consequence if they fail?
3. Are those concerns actually represented in requirements or acceptance criteria?
4. What evidence is needed, and at which test level is it cheapest and strongest to obtain?
5. Which characteristics are intentionally out of scope, and why?

Example for **file upload**:

| Lens | Example risk/question |
| --- | --- |
| Functional suitability | Are supported file types, limits and processing rules correct? |
| Performance efficiency | What happens with the maximum supported file size or many concurrent uploads? |
| Compatibility | Do supported clients and storage/services exchange files and metadata correctly? |
| Interaction capability | Is upload progress understandable and can users recover from errors? |
| Reliability | Can an interrupted upload resume or fail without corrupting state? |
| Security | Can a user access another user's uploaded file? Are dangerous files handled appropriately? |
| Maintainability | Can storage/validation logic be tested and changed independently? |
| Flexibility | Can supported storage/configuration change without rewriting the feature? |
| Safety | Usually low relevance for an ordinary upload feature; explicitly recognize when a lens is not materially applicable. |

This is more useful than simply labeling a test “functional” or “non-functional.” It turns the quality model into a systematic way to find missing requirements and missing test ideas.

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
- ISO/IEC 25010:2023 organizes product quality into nine characteristics: functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility and safety.
- Quality characteristics are practical review and risk-analysis lenses, not labels to memorize.
- A broad characteristic becomes useful for testing only when relevant risks are converted into concrete, observable requirements or acceptance criteria.
- Quality characteristics and test levels are independent dimensions and can be combined.

## Sources

- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-1:2022](https://www.iso.org/standard/81291.html)
- [ISO 9000:2026](https://www.iso.org/standard/9000)
- [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html)
- [IEEE 1012-2024](https://standards.ieee.org/ieee/1012/7324/)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
