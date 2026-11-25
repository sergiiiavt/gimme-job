# Certification content review — 25 November 2026

Reviewed against main e848d9ba15e8c088fee7bfd57221064338cfea08 and the preceding two-week content findings.

| Area | Correction | Evidence / exercise |
| --- | --- | --- |
| Structured output | Selection, strict argument/JSON enforcement, semantic validity and grounding are separate | Anthropic strict-tool/structured-output docs; extraction and source fixtures |
| CTFL boundaries | All-integer domain, both invalid/valid partition borders, deduplicated 3-value neighborhoods | ISTQB BVA clarification; question 29; executable 18–65, 1–100 and 1–1 cases |
| Assessment cues | Balanced keys without dominant period-1–4 cycles; no majority longest-correct cue | Shared parser checks in both languages across 225 questions |
| CT-GenAI scope | K3 includes GenAI-3.1.2, not only chapter 2 | v1.1 syllabus; adversarial risk-identification case |
| Curriculum depth | Applied requirement, rule/state table, metrics, error, source-conflict and review cases | Worked sections in each track; fixed expected outputs in the practice package |
| Localization | All 65 new chapters and all 225 questions have Ukrainian content | Section/code/answer parity; canonical section mapping; localized assessment interaction tests |
| Teaching runtime | Omission notice counts in budget; latest user request retained; infeasible budget raises | English and Ukrainian teaching-block execution tests |
| MCP lab | Malformed envelopes do not kill the session; failed tools cannot become done | Subprocess malformed requests and injected history/proposal failures |
| Editorial accuracy | Earliest matching upload failure 14 November; no inferred continuous outage or exact hypothetical alert date | Workflow 43585173844; English/Ukrainian incident text |
| Metrics | Model-token cost divided by model spans, not all spans | Revised cost-per-model-call teaching example |
| Current guides | Primary CCAR-F guide and two date-specific CCDV-F v1.1 guides | Source registry: 53 questions through 6 Dec; 70 from 7 Dec, updated weights |

## Applied coverage by track

| Track | Learning objective / practical skill | Artifact |
| --- | --- | --- |
| CTFL | FL-4.2.1–4: partitions, boundaries, decision rules, transitions | `boundary_values`, `discount_percent`, `transition` |
| CTFL | FL-5.1.4–5 and FL-5.5.1: estimate, prioritise, defect report | Worked estimate, dependency and reproducible true/100 failure |
| CT-GenAI | GenAI-2.2.1–5: construct prompts and apply them to test activities | Five R1 cases; 184 executed / 92% completion / 87.0% pass-executed |
| CT-GenAI | GenAI-3.1.2: identify risk in context | Customer-ticket injection / weak assertion / unauthorized publication scenario |
| Claude 101 | Source-grounded output and appropriate feature/access choice | F1 hybrid, F2 Kyiv, F3 unknown salary; unsupported-claim checks |
| Claude Code 101 | Focused edit, independent review and configured hook behavior | Boundary mutation; real stdin/stdout/stderr/exit-code hook tests |
| Claude Platform 101 | Request blocks, tool contracts and explicit outcomes | Extraction/gate/trace fixtures; optional official-SDK first request |
| CCAR-F | Architecture, tools, prompts, code and context | Exact approval, partial failure handoff, source conflict and sandbox review |
| CCDV-F | Integration errors, retries, models, tools and evaluation | Error/stop-reason matrices, safe-replay policy, segment analysis |
| GH-300 | Responsible generation, context, guidance and safeguards | Independent discount oracle, review prompt and client/feature exclusion matrix |

The fixtures are original, deterministic exercises. They are not official exam questions,
not complete syllabus coverage, not a production agent or an HTTP retry client, and not
proof of model factual accuracy. Optional live SDK/account features and real external
writes require their own validation; no paid calls or production messages are part of
this baseline. Normal main deployment continues to own canonical RAG refresh.
