# Testing throughout the software development lifecycle

Chapter 2 places testing inside sequential, iterative and DevOps lifecycles.

## Good practices in any lifecycle

- Every development activity has a corresponding test activity.
- Each test level has its own objectives, avoiding redundancy.
- Test analysis and design for a level start during the corresponding development phase.
- Testers review work products as soon as drafts exist.

## Test-first approaches and DevOps

- **TDD:** a failing unit test drives the code, then refactoring.
- **ATDD:** acceptance tests derived from acceptance criteria are written before development.
- **BDD:** behaviour is described in Given/When/Then and can be automated.
- **DevOps:** continuous integration and delivery give fast feedback, need automated regression and stable environments, and raise the importance of non-functional testing.
- **Shift left:** test earlier: review specifications, write tests first, use static analysis and CI, and start non-functional testing at component level where possible.
- **Retrospectives:** the team reviews what worked and what to improve, including the test process.

## Test levels

| Level | Focus |
| --- | --- |
| Component (unit) testing | Components in isolation, often with stubs and drivers |
| Component integration testing | Interfaces between components |
| System testing | End-to-end behaviour and non-functional characteristics of the whole system |
| System integration testing | Interfaces with other systems and external services |
| Acceptance testing | Readiness for deployment: user, operational, contractual, regulatory, alpha and beta |

## Test types

- **Functional testing:** what the system does.
- **Non-functional testing:** how well it does it, using an explicitly selected quality model and edition. ISO/IEC 25010 editions differ: do not combine their characteristic lists without attribution.
- **Black-box testing:** based on specifications.
- **White-box testing:** based on internal structure.

Any test type can be applied at any test level.

## Confirmation and regression testing

**Confirmation testing** checks that a defect fix works. **Regression testing** checks that a change has not broken anything else. Regression suites grow and are prime candidates for automation.

## Maintenance testing

Triggered by **modifications** (fixes, enhancements, hotfixes), **upgrades or migrations** (including data conversion), and **retirement** (including data archiving and restoration). Its scope depends on the risk of the change, the size of the system and the size of the change; impact analysis helps decide it.

## Choose the level and regression scope

A change to the shared discount function needs component tests for all four rules, API tests for serialization and a system test for the displayed total. Reproduce the reported member/subtotal-100 failure for confirmation. Add non-member and 99/101 cases for regression; include downstream invoices because the function is shared. “Run only the reported test” confirms one fix but misses change impact. Shift left means clarify the ambiguous rule before implementation, not remove later system testing.
