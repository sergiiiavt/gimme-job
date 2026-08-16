<!-- concepts: agile-values, agile-not-scrum, whole-team-quality, definition-of-done, shift-left-right, continuous-testing, automation-boundaries, tool-support, production-feedback -->

# QA in Agile & Modern Delivery

Modern delivery changes the **feedback cycle**, not the fundamental need for testing. Agile teams still need evidence about quality and risk; they try to obtain it continuously instead of postponing it to a separate testing phase near release.

## Agile values and principles

The Agile Manifesto emphasizes individuals and interactions, working software, customer collaboration and responding to change. Its principles emphasize frequent delivery, close collaboration, sustainable work, technical excellence and adaptation.

None of these principles says “do less testing.” They imply that testing information should arrive quickly enough to influence the next decision.

```diagram
Long feedback loop
requirement → implementation → handoff → testing → feedback weeks later

Short feedback loop
example ↔ design ↔ implementation ↔ automated checks ↔ exploration ↔ production evidence
                       feedback continuously influences the next change
```

## Agile is not Scrum

Agile is a set of values and principles. Scrum is one framework for developing complex products. A team can work iteratively without Scrum, and using Scrum terminology does not automatically make a team's feedback loops effective.

The current official Scrum Guide defines accountabilities, events, artifacts and commitments. QA-specific roles are not prescribed. Testing work therefore belongs inside the team's product-development responsibilities rather than being an external phase created by Scrum.

> **Common mistake:** saying “in Agile there is no documentation” or “in Agile everyone is a tester, so specialist testing is unnecessary.” Agile favors useful outcomes and collaboration, not the removal of expertise or evidence.

## Whole-team quality ownership

Quality is a team responsibility, but responsibilities are not identical.

A product specialist may clarify examples and user outcomes. Developers create testable designs and lower-level checks. Test specialists bring risk analysis, test design, exploratory investigation and quality modeling. Operations contributes production constraints, observability and incident evidence.

```diagram
Product ── user need and acceptance examples
   ↕
Development ── design, implementation, component evidence
   ↕
Testing ── risk, coverage, test design, investigation
   ↕
Operations ── runtime constraints and production evidence

Shared outcome: useful, supportable product quality
```

Whole-team ownership means quality cannot be delegated away. It does not mean every person has the same depth of testing skill.

## Definition of Done and quality expectations

In Scrum, the Definition of Done is a formal description of the state of the Increment when it meets required quality measures. More generally, teams benefit from explicit shared expectations about what “complete” means.

Useful quality expectations may include relevant review, automated checks, required exploratory coverage, migration validation, accessibility criteria, documentation, observability or production-readiness checks.

The Definition of Done should not become a giant checklist containing every possible test. It should define durable quality expectations that apply consistently to completed work.

## Shift-left

Shift-left means obtaining useful feedback earlier in the lifecycle. Examples include:

- reviewing requirements before implementation;
- discussing examples and edge cases during refinement;
- designing for observability and testability;
- running component and contract checks before full-system testing;
- scanning code and dependencies during development.

Shift-left is not “make developers do QA.” It is reducing the delay between creating a problem and learning about it.

## Shift-right

Shift-right uses production or production-like evidence to learn about real system behaviour. Examples include monitoring, synthetic checks, canary releases, feature flags, user telemetry, incident analysis and controlled experiments.

Shift-right does not replace pre-release testing. Production evidence can reveal behaviours that test environments cannot reproduce perfectly, but discovering preventable catastrophic failures in production is not an acceptable strategy.

```diagram
Before release                    After / during release
reviews → tests → staging   →    canary → monitoring → incidents → learning
        shift-left                            shift-right
               one continuous feedback system
```

## Continuous testing and CI/CD

Continuous testing means useful testing activities are integrated into the delivery flow rather than accumulated for a late phase. In CI/CD, automated checks can provide rapid evidence on every change, while slower suites and human investigation run at appropriate points.

A sensible feedback stack might be:

| Feedback | Typical speed | Purpose |
| --- | --- | --- |
| Static checks / component tests | seconds | catch local defects cheaply |
| Service / integration tests | seconds to minutes | validate boundaries and business rules |
| Selected system checks | minutes | validate critical integrated behaviour |
| Exploratory / specialist testing | adaptive | investigate uncertainty and new risks |
| Production telemetry | continuous | observe real behaviour and emerging failures |

Fast feedback is valuable only when failures are trustworthy and diagnosable.

## Tool support in testing

Tools support testing activities; they do not replace the reasoning that decides what evidence is useful. CTFL treats tool support as part of Foundation-level knowledge because testing work spans much more than UI automation.

A practical tool landscape can be organized by the activity being supported:

```diagram
Planning / management / traceability
        ↓
Requirements, test cases, results, defects, reporting

Static testing
        ↓
reviews / linters / static analysis / security scanning

Test design and data
        ↓
modeling / data generation / combinatorial support

Execution and automation
        ↓
component / API / UI / contract / mobile checks

Non-functional evidence
        ↓
performance / security / accessibility / compatibility tools

Operations and observability
        ↓
logs / metrics / traces / synthetic monitoring / incident evidence
```

The categories overlap. A CI platform may orchestrate static analysis, automated tests and deployment checks; an API client may support exploratory testing and also generate automated requests.

### Benefits of tools and automation

Tools can provide:

- faster and more repeatable execution;
- consistent processing of large data sets;
- earlier feedback in CI/CD;
- better collection of logs, traces and evidence;
- support for tasks that are tedious or impractical manually;
- improved reproducibility and visibility.

### Risks and limitations

Tool adoption also introduces risks:

- unrealistic expectations that buying a tool “solves testing”;
- high maintenance cost for fragile automation;
- false confidence from large numbers of passing checks;
- duplicated or low-value tests because automation is easy to add;
- dependence on specialist skills, vendors or infrastructure;
- noisy failures that teams learn to ignore.

> **Key point:** automate a valuable activity because automation improves its economics or feedback. Do not invent low-value activity merely to justify a tool.

## What automation can and cannot prove

Automation is excellent for repeated checks with explicit expectations. It can protect known behaviour, run large data sets, evaluate contracts and provide fast regression feedback.

Automation cannot independently decide that an unexpected visual arrangement is confusing, notice a surprising business consequence nobody encoded, or determine whether a new requirement solves the right user problem.

> **Key point:** automated tests execute encoded expectations. They do not remove the need for test analysis, exploration, judgment or new test design.

The dedicated **Test automation** learning path goes deeper into frameworks, architecture, CI and reliability. QA Fundamentals only establishes where automation fits conceptually.

## Production feedback closes the loop

Incidents, support tickets, telemetry and user behaviour are inputs to future testing. An escaped defect should influence more than one regression case. Ask:

1. Which assumption was wrong?
2. Why did earlier evidence fail to expose it?
3. Was the risk missing, underestimated or difficult to observe?
4. Should requirements, design, monitoring, test data or test techniques change?

```diagram
Production observation
      ↓
Update risk model
      ↓
Improve requirement / design / test / monitoring
      ↓
New release evidence
      ↓
Production observation
      ↺
```

This is how a quality system learns rather than merely accumulates more test cases.

## Modern delivery does not erase fundamentals

The vocabulary from earlier chapters still applies:

- requirements and risks still form a test basis;
- test levels still exist even when they run in one pipeline;
- confirmation and regression remain different objectives;
- coverage still needs a defined denominator;
- reviews remain static testing;
- residual risk still belongs to a decision owner.

Modern tooling changes **when and how quickly** evidence is obtained. It does not invalidate the reasoning behind good testing.

## Summary

- Agile shortens feedback loops; it does not remove the need for testing or documentation.
- Agile and Scrum are not synonyms.
- Quality is a whole-team responsibility while specialist testing expertise remains valuable.
- Definition of Done can encode durable quality expectations.
- Shift-left moves useful feedback earlier; shift-right learns from runtime evidence.
- Continuous testing combines automated and human evidence throughout delivery.
- Tool support spans management, static testing, design/data, execution, non-functional testing and observability.
- Automation provides speed and repeatability but can also create maintenance cost and false confidence.
- Production evidence should update future risks, designs and tests.

## Sources

- [Manifesto for Agile Software Development](https://agilemanifesto.org/)
- [Principles behind the Agile Manifesto](https://agilemanifesto.org/principles.html)
- [The Scrum Guide — official current version](https://scrumguides.org/download.html)
- [ISO/IEC TR 29119-6:2021 — Testing in agile projects](https://www.iso.org/standard/81293.html)
- [ISTQB CTFL v4.0](https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [SWEBOK v4.0a](https://www.computer.org/education/bodies-of-knowledge/software-engineering/resources/)
