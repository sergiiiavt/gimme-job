# Static testing

Chapter 3 is small but reliable points: reviews, roles and review types.

## What static testing is and why it pays

Static testing examines work products without executing them, by manual review or by tools such as static analysers. Almost any readable work product can be examined: requirements, user stories, code, test plans, test cases, contracts, models.

- It finds defects **directly**; dynamic testing causes **failures** whose defects must then be located.
- It finds defects early, when they are cheapest to fix.
- It finds defect types dynamic testing struggles with: unreachable code, design defects, deviations from coding standards, ambiguous or missing requirements, security vulnerabilities in code patterns.

## Early and frequent stakeholder feedback

Frequent feedback from stakeholders prevents misunderstandings about requirements and reduces rework. Reviews are one of the main ways to get it.

## The review process

1. **Planning:** scope, purpose, work product, quality characteristics, effort, exit criteria.
2. **Review initiation:** everyone has access and understands their role.
3. **Individual review:** each reviewer examines the work product and logs anomalies.
4. **Communication and analysis:** anomalies are discussed and decided on.
5. **Fixing and reporting:** defect reports, fixes, and a check against exit criteria.

## Roles in reviews

| Role | Responsibility |
| --- | --- |
| Manager | Decides what is reviewed, provides resources |
| Author | Creates and fixes the work product |
| Moderator (facilitator) | Runs review meetings, mediates |
| Scribe (recorder) | Collects anomalies and records decisions |
| Reviewer | Performs the review |
| Review leader | Overall responsibility: who, when, where |

## Review types, from least to most formal

- **Informal review:** no defined process, no formal documentation.
- **Walkthrough:** led by the author; can educate, build consensus and find anomalies.
- **Technical review:** led by a moderator with technically qualified reviewers; aims at consensus and technical decisions.
- **Inspection:** the most formal; follows the full generic process, collects metrics, and the author cannot act as review leader or scribe.

## Success factors

Clear objectives and exit criteria, the right review type, small chunks reviewed, feedback to stakeholders and authors, adequate time, management support, and making reviews part of the culture.
