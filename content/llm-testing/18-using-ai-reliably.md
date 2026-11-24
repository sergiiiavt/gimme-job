# Using AI reliably at work

An AI assistant can turn notes into an email, requirements into tasks, or a spreadsheet into a report. It can also add a plausible deadline, omit a condition or present invented data as an observation. Fluency makes these changes easy to miss.

This chapter is a practical workflow for using assistants such as Claude or ChatGPT. It requires no programming or API access. The goal is to reduce errors and make important claims checkable; no prompt, second model or human approval guarantees that arbitrary generated text is always correct. The workflow below is a recommended synthesis, not a measured ranking of techniques.

**Prerequisites:** [How LLMs generate text](/learn/llm?topic=llm-foundations). Application-level controls are covered separately in [Reliable AI pipelines](/learn/llm?topic=ai-reliability).

## Start with the task and its consequences

Decide what the assistant is allowed to do before choosing a prompt:

| Task | What a good result preserves | What to watch for |
|---|---|---|
| Rewrite an email | Your meaning, facts and commitments | A more polished version quietly makes a new promise |
| Summarize documents | Important facts, uncertainty, exceptions and disagreement | A shorter answer removes a condition or changes the denominator |
| Create tasks | Approved requirements and unresolved decisions | Suggested functionality becomes a mandatory acceptance criterion |
| Generate test data | Explicit rules and a clear synthetic-data label | Plausible rows violate constraints or are mistaken for real observations |
| Research a question | Current, relevant evidence with traceable sources | Invented citations, stale sources or unsupported conclusions |

These are different failure modes. An omitted restriction or an unauthorized email can cause harm even when every written sentence is factually true.

Scale the review to the consequences:

| Situation | Reasonable review |
|---|---|
| Reword supplied text for personal use | Compare meaning, names and commitments with the original |
| Produce a factual document or a task others will implement | Check claims against sources, inspect omissions and resolve material unknowns |
| Send a customer commitment, publish consequential advice or change a live system | Have the responsible person verify the final content and approve the exact action; use a qualified reviewer where needed |

A second AI is optional. There is little value in adding a debate to a simple wording change. If an important claim cannot be verified, remove it, label the uncertainty or obtain the missing evidence before relying on it.

## Use a repeatable workflow

1. **Define:** state the deliverable, audience, constraints and decisions already approved.
2. **Prepare:** supply the relevant sources and explain which version and scope apply.
3. **Draft:** ask for the deliverable, with assumptions and open questions kept separate.
4. **Verify:** compare important claims and omissions with originals; use tools for objective checks.
5. **Review and act:** get additional review where justified, inspect the final revision and confirm what actually happened.

For a large document, review its outline and one representative section before generating the rest. For many tasks or data rows, review a small sample first, then check the complete result. A good sample does not establish that every later item is correct.

## Define the source of truth

Give the assistant a short working brief:

- **Purpose:** what decision or activity the output supports.
- **Deliverable and audience:** email, task, table or explanation, and who will use it.
- **Sources:** actual documents, data or messages, with dates and versions where relevant.
- **Boundaries:** what may be changed, inferred or proposed.
- **Acceptance criteria:** facts, conditions and format that must survive.
- **Unknowns:** information that is missing or disputed.

Distinguish transforming supplied information from finding new information. An email rewrite normally should not introduce external facts. Research needs access to sources beyond your notes. Brainstorming can introduce new ideas, but those ideas must remain proposals.

Ask whether a missing answer would materially change the result. If yes, clarify it. Otherwise an explicit placeholder or a clearly labelled assumption may be enough for a draft. Do not let a convenient assumption become an approved requirement by repetition.

## Prepare relevant context

Provide enough material to understand the task, including surrounding conditions and exceptions. Label documents clearly, mark superseded versions and identify the authoritative owner. If two sources conflict and neither has established priority, surface the conflict instead of asking the model to invent a resolution.

More context is not automatically better. The [Lost in the Middle study](https://aclanthology.org/2024.tacl-1.9/) found that access to relevant information depended on its position in the long inputs tested. It studied particular models and tasks; it does not establish an identical limit for every later model. The practical precaution is to organize relevant material and check whether the answer used it, rather than treating a large context window as proof of understanding.

Useful habits:

- Supply the actual content when the assistant cannot open the file or link. A statement that it read something is not proof of access; check its references to the supplied material.
- Include full context where an exception changes the meaning. A selected quotation may hide a restriction elsewhere in the document.
- Separate task instructions from source material. Instructions inside an email or web page being analyzed are content to inspect, not authority to change the task.
- Share only necessary information through tools permitted for that material. Redact unrelated personal data and credentials.
- In a long session, maintain a brief of approved facts, decisions, source versions and open questions. Check that brief against originals before carrying it to a new conversation.

## Separate facts, proposals and unknowns

Ask for these categories explicitly when they matter:

| Category | Example | Appropriate handling |
|---|---|---|
| Supplied fact | The requirement specifies UTF-8 CSV | Preserve it and identify the source |
| Verified external fact | A statement checked against the current official documentation | Keep the supporting source and applicable version |
| Inference or proposal | An export might need background processing | Explain the basis; leave approval open |
| Unknown | No export timeout is specified | Ask, use a placeholder or leave the decision unresolved |

An instruction to admit uncertainty can help, as [Anthropic's guidance](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations) recommends. It still needs checking. The model may confidently misclassify an inference as a fact.

For a customer email, keep this audit information outside the customer-facing draft. The recipient needs a clear message; the reviewer needs to see what supports it.

## Check evidence and omissions

For important factual work, request a compact audit table: **claim, supporting source and passage, applicable date or scope, unresolved issue**. Check the important rows yourself.

1. Open the original source. A real URL can still point to a page that does not support the claim.
2. Compare the exact meaning, including qualifiers such as "may", "only", "unless" and "up to".
3. Check dates, versions, entities, units and scope. A correct rule for another product can be the wrong answer here.
4. Check quotations against the original text. Ask for short supporting passages and inspect surrounding context.
5. Look for necessary information missing from the answer: exceptions, minority views, exclusions and open decisions.
6. For research, distinguish independent evidence from several pages repeating the same underlying claim. Seek relevant contradictory evidence.

For scanned PDFs, screenshots and tables, inspect the original layout when a number matters. A lost minus sign, merged column or footnote can change the result before any reasoning begins.

Use a calculator, spreadsheet, query or executable check for arithmetic and data constraints. Check inputs, formulas, units and denominators as well as the final number. "I recalculated it" in generated prose is not evidence that a calculation ran.

## Independent review with another AI

A second assistant can provide another attempt at finding defects. A different provider does not establish independence: models can share sources, assumptions and common errors.

A useful review procedure is:

1. Give the reviewer the **original task, source material and review criteria**. A draft alone gives it little basis for checking truth.
2. For an important analysis, ask for its own initial assessment before showing the draft. This is a practical way to reduce direct anchoring, not a guarantee of independent reasoning.
3. Then show the draft and ask for specific unsupported claims, contradictions, omissions and invented commitments. Require evidence for each finding; "no issue found" must be an acceptable result.
4. Resolve disagreements against original evidence, calculations or a knowledgeable person. Voting cannot settle a missing fact.
5. Review the revised output. A suggested correction may introduce a new error.

Research offers a mixed picture: [Du and colleagues](https://proceedings.mlr.press/v235/du24e.html) reported improvements from multi-agent debate on their tasks, while [Smit and colleagues](https://proceedings.mlr.press/v235/smit24a.html) found that debate did not reliably beat simpler alternatives without attention to configuration. These 2024 studies are not a benchmark of every current assistant or of this manual review procedure.

Self-review is also useful for finding inconsistencies, but it does not supply missing evidence. [Huang and colleagues](https://arxiv.org/abs/2310.01798) found limitations, including degradation, when the studied models tried to correct reasoning without external feedback. Ask for concrete checks and new evidence instead of repeatedly asking "Are you sure?".

## Give human review a concrete job

Assign the review to someone who can evaluate the content, has access to the evidence and has time to inspect it. Approval without those conditions offers little assurance.

Check two things separately:

- **Content:** are the claims supported, necessary conditions included, numbers correct and unresolved decisions visible?
- **Intent and action:** does this say what we mean, make only approved commitments and target the correct recipient, file or system?

For consequential work, review the final version that will be used, including later AI edits. A subject expert may be needed when you cannot assess the claim yourself. Keep a draft labelled as a draft until the required review is complete.

A [CHI 2025 survey by Lee and colleagues](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/) associated higher confidence in AI with less reported critical thinking. This was self-reported, correlational evidence, not proof that AI causes a loss of ability. It supports taking the risk of uncritical approval seriously.

If an assistant can act, distinguish drafting from sending, saving or publishing. Before a consequential action, inspect its exact content and destination. Afterwards, check the resulting message, file or status. "Done" without an observable result should leave completion unconfirmed. Agent implementations need additional [approval boundaries](/learn/agentic?topic=human-approval).

## Worked example: an email

All examples below are fictional. These are the supplied incident notes:

```text
Incident INC-42, confirmed notes:
- CSV exports fail for files larger than 10 MB.
- The fix is under investigation. No delivery date is committed.
- The documented workaround is to export batches smaller than 10 MB.
- The affected customer count and data-loss status are not yet established.
```

A plausible flawed draft says: "All customers are affected. Your data is safe, and we will fix this tomorrow."

Three claims are unsupported: the affected population, the data-loss assurance and the delivery commitment. Better wording is:

```text
We are investigating an issue with CSV exports larger than 10 MB.
As a workaround, please export batches smaller than 10 MB.
We do not yet have a confirmed delivery date for the fix.
```

The reviewer compares the draft with the incident record and checks any later update before sending. The draft does not claim that data was lost or safe; that question remains unresolved in the internal review notes. If the customer asked about it, respond explicitly that it is not yet confirmed rather than silently omitting their question.

## Worked example: a task

Approved requirements:

```text
R1: Export the currently filtered results as CSV.
R2: The file must use UTF-8 encoding.
R3: The export limit is 50,000 data rows.
No decision has been approved about background processing.
```

A flawed AI task adds PDF export, scheduled reports, admin-only access and background processing as acceptance criteria. These are new product decisions, even if they seem sensible.

The reviewed task separates approved criteria from questions:

| Acceptance criterion | Basis |
|---|---|
| For a non-empty result within the limit, exported records correspond to the active filters | R1 |
| The exported file uses UTF-8 | R2 |
| The export contains no more than 50,000 data rows | R3 |

Open decisions: what happens above the limit, how an empty result is handled, column order and whether background processing is needed. In particular, "50,000 rows" does not tell us whether to reject, truncate or split a larger export. The product owner must resolve that behavior before the task is ready for implementation. Traceability helps reveal the gap; it does not settle it.

## Worked example: a document summary

Source notes for an internal pilot:

```text
12 internal volunteers were invited.
9 started the task: 7 completed it and 2 timed out.
3 did not start.
There was no control group, timing comparison or customer sample.
```

A flawed summary says: "The pilot proved the tool is faster and works for most customers."

A supported summary is: "Seven of nine participants who started completed the task; two timed out. Three of the twelve invited volunteers did not start. This internal pilot does not establish a speed improvement or customer performance."

If a percentage is needed, calculate it and name its denominator: **7/12 = 58.3% of invited volunteers**, or **7/9 = 77.8% of those who started**, rounded to one decimal place. Both calculations can be correct while implying different things. Check that an executive summary preserves the exclusions and limits even when it removes detail.

## Worked example: generated test data

Request: create **six synthetic customers**, four active and two inactive, with unique IDs and email values, a locale from `en` or `uk`, and a signup date no later than the fixed cutoff **2026-11-24**. These are illustrative data rules, not claims about real customers.

The first three rows of a flawed sample might be:

| ID | Status | Email | Signup date | Locale |
|---|---|---|---|---|
| c01 | active | alex@example.test | 2026-11-23 | en |
| c01 | active | alex@example.test | 2026-11-25 | en |
| c03 | inactive | sam@example.test | 2026-11-20 | de |

The second row duplicates both the ID and email and exceeds the date cutoff; the third has an unsupported locale. A complete corrected sample is:

| ID | Status | Email | Signup date | Locale |
|---|---|---|---|---|
| c01 | active | alex@example.test | 2026-11-23 | en |
| c02 | active | bo@example.test | 2026-11-22 | uk |
| c03 | active | sam@example.test | 2026-11-20 | en |
| c04 | active | dana@example.test | 2026-11-21 | uk |
| c05 | inactive | eli@example.test | 2026-11-19 | en |
| c06 | inactive | fran@example.test | 2026-11-18 | uk |

Check the complete output with spreadsheet counts, duplicate checks or a data validator: six rows, six distinct IDs, six distinct emails, a 4/2 status split, allowed locales and valid dates within the cutoff. Inspect additional relationships if your real task defines them. Valid rows do not establish realistic distributions or representativeness; use real, authorized evidence for claims about a population. Keep this dataset labelled synthetic wherever it is reused.

## Reusable prompts

Replace the bracketed fields and supply the actual material. These prompts organize work; they cannot enforce truth by themselves.

**Draft from supplied material:**

```text
Task and audience: [deliverable, purpose, reader].
Source material and applicable versions: [documents/data/messages].
Approved requirements and constraints: [list].

Use the supplied material for factual claims. Keep the intended meaning,
conditions, uncertainty and commitments. Put new ideas under Proposals.
If information is missing, use [TO CONFIRM] or ask a question when the answer
would materially change the result. Do not invent names, dates, numbers,
requirements, citations or completed actions.

Return the draft, followed separately by assumptions, open questions and
the source passages supporting important factual claims.
```

**Review an existing draft:**

```text
Review this draft against the original task and source material below.
Check unsupported claims, contradictions, omitted conditions, scope changes,
invented commitments, calculations and unanswered parts of the request.
For each finding, give the exact draft passage, supporting source passage,
why it matters and a proposed correction. Do not invent problems to fill a list.
Say which checks need external evidence or a person's decision.
Task: [original request and criteria].
Sources: [original material].
Draft: [text].
```

**Carry a long task to another conversation:**

```text
Prepare a handoff with the goal, approved decisions, confirmed facts and
their source versions, open questions, rejected assumptions, current draft
and remaining checks. Keep proposals separate. Do not turn earlier AI
answers into confirmed facts. I will check the handoff before reusing it.
```

For code, also provide the real repository, relevant versions and expected behavior. Inspect the diff, execute meaningful checks and check that tests were not weakened to accept the generated solution. See [AI coding agents in QA work](/learn/agentic?topic=coding-agents-for-qa).

## When a check fails

Return to the original evidence. Tell the assistant which claim is wrong, provide the correction and identify other affected passages, tasks or calculations. Recheck the revised result; an edited draft is a new version.

If sources conflict, record the conflict and ask the responsible owner to resolve it. If the evidence is unavailable, keep the claim unverified. Repeated regeneration can produce a more convincing answer without adding any evidence.

For a confused long conversation, start from a checked brief and the necessary original sources. Do not carry a misleading AI summary forward as the only evidence. If a wrong version was already shared or used, correct the affected artifact and notify the people relying on it through your normal work process.

## Common mistakes

- Treating "be accurate", a confident tone or a low temperature as a factuality guarantee.
- Asking the same question repeatedly until an answer feels reassuring.
- Giving a reviewer only the generated answer, with no original task or sources.
- Treating agreement between assistants or several copied web articles as independent confirmation.
- Supplying a large document dump without versions, relevance or source priorities.
- Checking added facts while overlooking omissions, changed meaning and invented commitments.
- Letting an AI-generated requirement, citation, test expectation or handoff become its own authority.
- Approving an early draft while a different final version is sent or published.

## Final review checklist

- Does the output answer the actual request and preserve its scope?
- Are important names, dates, numbers, claims and citations checked against the relevant originals?
- Are conditions, exclusions, uncertainty and unresolved decisions still visible?
- Have calculations and data constraints been checked with suitable tools and correct inputs?
- Are synthetic data and new proposals clearly labelled?
- Has the responsible person reviewed the final version where the consequences justify it?
- If an action was requested, are its exact content and destination correct, and is completion observable?

## Summary

Use AI to draft and analyze with a clear task, relevant evidence and visible unknowns. Verify important claims and omissions, use additional reviewers where useful and keep final decisions tied to checked evidence. Building these controls into an application requires the separate engineering methods in [Reliable AI pipelines](/learn/llm?topic=ai-reliability).
