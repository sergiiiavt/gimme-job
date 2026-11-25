# Final review & exam-day checklist

Use this after the chapters and the mock exam, not instead of them.

## The meta-rule

Pick the smallest fix that removes the root cause and is deterministic wherever a rule must always hold. Most CCAR-F questions have one option that does exactly that and three that break the rule in a recognisable way.

## Six distractor patterns

1. **Prompt harder.** Capitals, "NEVER", or a longer system prompt where a hook, gate or schema is needed.
2. **Over-engineer.** A new classifier, fine-tune or service when a sharper tool description or one configuration line fixes it.
3. **Fix downstream.** Blaming subagents or the model for a coordinator's narrow decomposition.
4. **Trust feelings.** Escalating on sentiment or self-reported confidence instead of explicit criteria.
5. **Buy more context.** A bigger window or model for a problem caused by attention dilution or bloated tool output.
6. **Wrong API for the latency.** Batches on a blocking path, or synchronous calls for a 50,000-item overnight job.

## High-yield distinctions

| Pair | Remember |
| --- | --- |
| Prompt rule vs hook | Judgment in the prompt; limits, identity and irreversible actions in code |
| `auto` vs `any` vs named tool | May answer in text; must call some tool; must call that tool |
| Resource vs tool | Content to read; action to take |
| User vs project CLAUDE.md | Personal; committed and shared |
| Subdirectory CLAUDE.md vs `.claude/rules/` | Folder scope; glob scope |
| Plan mode vs direct execution | Large and ambiguous; small and clear |
| Schema vs validation | Shape; meaning |
| Batches vs synchronous | Half price within 24 hours; immediate |

## Readiness checklist

- [ ] All five domain chapters read
- [ ] At least three hands-on labs done
- [ ] Mock exam score of 32 or more, with every wrong answer explained
- [ ] Explain errors in the current official practice material and complete the applied exercises
- [ ] Eligibility confirmed: a Claude Partner Network employer and a company email
- [ ] Pearson system test passed on the machine you will use, or a test center booked

## Exam day

- 120 minutes for 60 questions is 2 minutes each. Answer everything; flag and return if the interface allows.
- For multiple-response items, count how many answers are required, then judge each option on its own.
- A managed work laptop may block OnVUE; use a personal machine or a test center.

## Outcome versus trajectory

A run that ended its model turn may still have failed a required tool. Explain the difference between model completion, validated task completion, error and budget exhaustion. Replay the error case and retain partial evidence. Then show a schema-valid but unsupported claim and a cross-tenant approval denial; these concrete counterexamples are stronger readiness evidence than memorizing an option letter.
