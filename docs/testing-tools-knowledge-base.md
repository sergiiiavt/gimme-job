# Testing & Diagnostic Tools knowledge base

## Scope

This learning path teaches a workflow-first model for technical QA investigation. It deliberately organizes tools by evidence layer rather than by vendor: HTTP requests, browser state, interception, stored data, packets, devices, and specialist handoffs.

The public curriculum contains **8 chapters and 38 required concepts** in English and Ukrainian.

## Curriculum

1. Tooling foundations & evidence
2. HTTP & API request tools
3. Browser DevTools & debugging
4. HTTP interception & proxies
5. Database & data inspection
6. Network packet analysis
7. Mobile & device diagnostics
8. Specialist-tool bridges

## Source policy

Product-specific claims are checked against current official documentation. Cross-tool concepts are supported by protocol/platform documentation where possible. Sources are registered in `content/testing-tools/sources.json` with a review date and a role explaining what each source supports.

The curriculum intentionally uses **Fiddler Everywhere**, the currently maintained Telerik cross-platform product, rather than building new material around the legacy Fiddler Classic workflow.

## Safety policy

The course distinguishes observation from mutation. Replaying requests, editing browser storage, installing apps, running SQL writes, applying proxy rules, trusting interception certificates, and producing messages to integrations are explicitly treated as state-changing actions.

Examples must:
- use non-secret placeholders;
- prefer read-only investigation;
- state when a command changes state;
- avoid treating production as a practice environment;
- minimize and redact captured evidence.

## Boundaries

Performance, security, accessibility, automation-framework design, and deep API/integration strategy have their own learning paths. This curriculum teaches enough of k6/JMeter, ZAP/Burp, axe/Lighthouse, Appium Inspector, grpcurl, WebSocket and Kafka tooling to recognize the boundary and perform a useful handoff without duplicating those courses.

## Validation

`scripts/validate-testing-tools-content.mjs` enforces:
- exactly 8 top-level chapters and 38 registered concepts;
- bilingual chapter parity;
- source registry integrity and complete source use;
- at least one diagram per chapter;
- explicit concept coverage markers;
- minimum source breadth per chapter.
