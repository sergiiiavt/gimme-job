# Interview source audit — Phase 1 summary

Status: **complete, research-only**  
Date: **2026-08-21**  
Branch: `agent/interview-source-audit`

No production interview questions, source registry entries, prevalence values or application code were changed in Phase 1. No PR was created.

## Goal

Broaden the interview catalog beyond the older DOU collection while keeping Ukrainian-market context equally important, deduplicating by meaning rather than wording, and avoiding catalog growth for low-value trivia.

Semantic identity is treated as:

`topic + concept + interview intent + question kind`

A new source normally strengthens an existing canonical question. A new question is proposed only when the intent is materially distinct, current/recurrent and useful for interview preparation.

## Source picture

### Ukrainian market

- DOU — 250+ QA interview questions (existing production source)
- DOU — 400+ QA interview questions (416 raw prompts; retained as a first-class Ukrainian signal)
- Hillel 2025 — technical interviewer's perspective
- Mate academy 2026 — fresh Junior QA market snapshot
- DOU interview/community guidance

The DOU 400+ list contains meaningful internal and cross-source duplication, so 416 raw prompts must not become 416 catalog questions. Fresh Ukrainian material confirms that classic fundamentals are still asked, but modern interviewing puts more weight on explanation, practical examples, ambiguity, risk and communication.

### Current international market

Reviewed/current signals include Katalon, Indeed, GeeksforGeeks, Testsigma, BugBug, KORE1, AssertHired and current SDET/mobile/API interview collections.

The consistent 2026 pattern is not that fundamentals disappeared. Instead, Senior/AQA interviews increasingly emphasize judgment: selecting coverage, deciding what to automate, diagnosing flaky tests, CI/CD behavior, release risk, missing requirements, tool/framework choice, production feedback and quality ownership. AI-assisted testing is now visible, but much of that coverage already exists in GimmeJob's modern-SDET set.

## Recommended new canonical questions

After the global semantic second pass, **8** concepts remain genuinely distinct enough to propose:

1. **Pre-release mobile build distribution** — TestFlight/Firebase App Distribution, build identity, tester access, signing/provisioning and CI distribution.
2. **HTTP/HTTPS traffic interception and proxy debugging** — Charles/Fiddler/Proxyman/mitmproxy-style practical debugging, certificates and HTTPS limitations.
3. **Practical Git workflow for QA/AQA** — branch, commit, sync, merge/rebase, conflict handling, PR/review and CI; command trivia becomes follow-ups.
4. **WebSocket / real-time feature testing** — connection lifecycle, auth, bidirectional messages, reconnect, ordering/duplication and multi-client behavior.
5. **Mobile offline → reconnect synchronization** — queued actions, retries, ordering, idempotency, stale state and conflict resolution.
6. **Mobile app upgrade/local-state migration testing** — install over old versions, retained sessions/data/settings, schema migration and interrupted upgrade paths.
7. **Shift-left testing in practice** — refinement/design/testability, early component/contract/static feedback and whole-team ownership.
8. **Automation framework/tool selection** — how to choose Playwright/Selenium/Cypress or another approach from product/team/CI/maintenance constraints rather than naming a universal winner.

These are candidates for Phase 2, not yet published questions.

## Important dedup corrections

Several concepts initially looked new but are already represented and should receive source/prevalence reinforcement instead of duplicates:

- QA/developer disagreement → `qa-developer-conflict`
- useful QA metrics / test effectiveness → `quality-metrics`
- what should/shouldn't be automated → `automation-benefits-risks`
- mobile device/OS matrix → `emulator-simulator-real-device`
- test strategy for a poorly documented product → `starting-qa-strategy`
- release with a serious known defect → `release-with-known-defect`
- production escape RCA → `escaped-defect-rca`
- generic asynchronous/eventually-consistent integrations → existing event-driven contract, ordering/replay/dead-letter and async trace questions
- AI-generated test review/human boundaries → existing authored AI questions
- HTTP idempotency, rate limits, API security/concurrency → existing API questions
- database fundamentals and Scrum fundamentals → existing authored coverage
- push notifications and deep/universal links → existing mobile coverage

## Intentionally not added

Examples of source material that should not grow the general catalog:

- monkey vs gorilla testing
- memorizing ten Selenium interfaces
- `Action` vs `Actions` trivia
- CAPTCHA automation tricks
- fixed current Android/iOS version numbers
- ideal Scrum team size/fixed sprint trivia
- a standalone `git cherry-pick` question
- a standalone device-farm question
- a generic eventual-consistency question that duplicates richer existing messaging coverage
- API-gateway vocabulary without a distinct testing intent

## Phase 2 application

If the audit is accepted, production work should happen as one scoped change:

1. author only the approved new canonical questions with stable IDs, EN/UA answers and practical examples;
2. add selected new market/interview sources to `content/interview/sources.json`;
3. add source references to existing canonical questions where the new banks reinforce the same intent;
4. re-review prevalence from combined Ukrainian + international recurrence;
5. run content validation and full repository verification;
6. create one PR for the completed catalog update.

Detailed machine-readable state is in:

- `docs/interview-source-audit.json`
- `docs/interview-source-audit-candidates.json`
