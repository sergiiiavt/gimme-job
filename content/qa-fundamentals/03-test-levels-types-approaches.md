<!-- concepts: test-levels, level-vs-type, functional-nonfunctional, static-dynamic, confirmation-regression, smoke-sanity, manual-automated -->

# Test Levels, Types & Approaches

Testing vocabulary becomes confusing when independent dimensions are mixed together. A **test level** describes where testing is positioned relative to the system decomposition. A **test type** describes the objective or quality characteristic being evaluated. Static/dynamic and manual/automated describe other dimensions again.

## Test levels

A useful foundational model contains four common levels.

| Level | Main focus | Typical examples |
| --- | --- | --- |
| Component / unit | A small testable component in isolation or near isolation | function, class, module |
| Integration | Interactions between components or systems | service-to-database, service-to-service, external provider |
| System | Behaviour of the complete integrated system | end-to-end business capability, system quality characteristics |
| Acceptance | Evidence that the system is acceptable for users, business or other stakeholders | user acceptance, operational acceptance, contractual acceptance |

```diagram
Acceptance: acceptable for intended stakeholders?
        ↑
System: does the integrated product behave as required?
        ↑
Integration: do boundaries and collaborators work together?
        ↑
Component: does the smallest useful unit behave correctly?
```

The levels are not a strict organizational chart. A team can run several levels continuously. The important distinction is the **object and purpose of the evidence**.

## Test level is not test type

“Integration testing” describes a level or interaction scope. “Security testing” describes an objective. Security checks can exist at component, integration and system levels. The same is true for performance, reliability and many other test types.

> **Common mistake:** treating “unit, integration, system, regression, smoke and performance” as one flat list. These labels describe different axes.

## Functional and non-functional testing

Functional testing asks whether the system provides required functions and behaviour. Non-functional testing evaluates quality characteristics and constraints such as performance, compatibility, reliability, interaction, security, maintainability or safety.

The distinction is useful, but it should not imply that non-functional concerns are secondary. A function that returns the correct answer after 90 seconds may still be unusable. A feature that works but exposes sensitive data is not acceptable quality.

ISO/IEC 25010:2023 provides a modern product-quality model that helps teams identify which quality characteristics require evidence.

## Static and dynamic testing

**Dynamic testing** executes the software or system and observes behaviour. **Static testing** evaluates work products without executing the software under test. Reviews of requirements, designs, test cases or code are static testing activities; static analysis tools are another form.

Static testing can find problems earlier than dynamic execution because it can examine work products before runnable software exists.

## Confirmation testing and regression testing

These are often confused.

- **Confirmation testing** checks whether a specific defect has actually been fixed. It targets the previously failing behaviour.
- **Regression testing** checks whether a change introduced unintended damage elsewhere.

```diagram
Defect fixed
   ├── Confirmation: does the original failure now behave correctly?
   └── Regression: what else could this change have broken?
```

A single test can sometimes serve both purposes, but the reasoning is different.

## Smoke and sanity

“Smoke” and “sanity” are widely used industry labels, but organizations use them differently. They should therefore be defined locally rather than treated as universal standards.

A practical convention is:

- **Smoke suite:** a small, broad set of checks that determines whether a build or environment is stable enough for deeper testing.
- **Sanity check:** a focused set of checks around a small change or area to determine whether it is reasonable to continue.

What matters is not arguing about the label. What matters is agreeing on the objective, coverage and decision the suite supports.

## Exploratory, scripted and checklist-based approaches

Scripted testing defines detailed expected checks in advance. Checklist-based testing records important coverage areas but leaves execution details to the tester. Exploratory testing combines learning, design and execution while the tester investigates the product.

These approaches are complementary. A stable regulatory workflow may benefit from detailed repeatable procedures, while a rapidly changing feature may benefit from exploratory investigation guided by risk.

## Manual and automated are execution approaches

Manual versus automated does **not** describe a test level or quality characteristic.

The same business rule might be checked manually through a browser, automatically through an API, automatically at component level, or explored interactively by a tester. The question is which execution approach gives useful evidence at acceptable cost.

Automation is strongest when expectations are known and repeated feedback is valuable. Human investigation is strongest when observation, learning, judgment and adaptation matter.

## Choosing the right combination

Instead of asking “what testing type should we do?”, describe the problem along several dimensions:

```diagram
What are we testing?        → component / integration / system / acceptance
Why are we testing it?      → functional / security / performance / reliability / ...
How do we derive tests?     → specification / structure / experience / collaboration
How do we execute?          → manual / automated / mixed
When do we apply it?        → static / dynamic / pre-release / production
```

This produces clearer strategies and prevents terminology from becoming a substitute for reasoning.

## Summary

- Test levels and test types are different dimensions.
- Component, integration, system and acceptance testing answer different evidence questions.
- Functional correctness is only one aspect of product quality.
- Static testing evaluates work products without executing the software; dynamic testing observes execution.
- Confirmation testing targets a fix; regression testing targets unintended side effects.
- Smoke and sanity should be defined by local purpose.
- Manual and automated describe execution approaches, not types or levels.

## Sources

- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISO/IEC/IEEE 29119-1:2022](https://www.iso.org/standard/81291.html)
- [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html)
- [SWEBOK v4.0a topics](https://www.computer.org/education/bodies-of-knowledge/software-engineering/topics)
