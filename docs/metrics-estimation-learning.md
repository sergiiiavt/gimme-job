# QA Metrics & Estimation learning path

## Scope

This curriculum teaches measurement and estimation as decision-support disciplines rather than collections of magic numbers. The public path contains **8 chapters and 75 required concepts** in English and Ukrainian. Chapters 2 and 3 (QA & product quality metrics, Test execution & automation metrics) are structured as a metric-by-metric catalog: named metric, formula, worked scenario, decision — not narrative essays.

## Curriculum

1. Measurement foundations
2. QA & product quality metrics
3. Test execution & automation metrics
4. Delivery & production metrics
5. Estimation foundations & decomposition
6. Estimation techniques & sizing
7. Risk-based allocation & forecasting
8. Calibration & communication

The eight-topic structure keeps navigation compact while preserving the full 68-concept scope from the original expansion plan.

## Source policy

Primary or authoritative sources are preferred:
- ISTQB for testing and estimation vocabulary;
- DORA for the current software-delivery performance model;
- the current Scrum Guide for what Scrum does and does not prescribe;
- the Kanban Guide for WIP, throughput, work item age and cycle time;
- Google SRE / OpenTelemetry / Prometheus / Kubernetes for reliability and detection bridges;
- NASA and NIST for estimation/statistical reasoning;
- ISO/IEC 25010:2023 for the product-quality model;
- ISO/IEC 20926:2009 for IFPUG functional size measurement. ISO reconfirmed this edition in 2024, so it remains current.

## Metrics contract

A useful KPI definition must make the decision model explicit. Formula examples identify, where applicable:
- numerator;
- denominator;
- scope/population;
- observation window;
- target or the absence of one;
- owner;
- decision or action triggered.

Illustrative numeric values are labelled **scenario examples**, never universal QA standards. The course explicitly rejects universal defect-rate, pass-rate, automation-coverage and hours-per-point targets.

## Current DORA terminology

The course uses DORA's current five metrics:
- change lead time;
- deployment frequency;
- failed deployment recovery time;
- change fail rate;
- deployment rework rate.

It also explains that the model evolved from the older Four Keys and should be used in application/service context, not as a cross-team ranking mechanism.

## Estimation policy

Estimation content distinguishes:
- effort from duration;
- estimate from commitment;
- point estimates from ranges;
- contingency from hidden padding;
- sizing from effort conversion;
- estimates from evidence-based forecasts.

Function points are presented as a standardized functional-size method. Test points and other weighted local models are presented as **calibrated local heuristics**, not universal conversion systems.

## Validation

`scripts/validate-metrics-estimation-content.mjs` enforces the eight-topic/75-concept structure, bilingual parity, source use, DORA current terminology, explicit formula-contract fields, scenario labelling, Scrum wording, and the no-universal-test-points conversion rule.
