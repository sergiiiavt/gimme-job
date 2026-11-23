# Context management & reliability

15% of CCAR-F. These questions are about what gets lost in long conversations and multi-agent handoffs, and how to keep quality measurable.

## Summaries lose numbers

Progressive summarisation keeps the gist and drops specifics: order numbers, amounts, dates. Keep those in a pinned **case-facts** block that is sent verbatim with every request and is never summarised. A larger context window only postpones the problem.

## Trim tool output

An order lookup that returns 40 fields should reach the context as the five the task needs. Bloated tool results crowd out instructions and earlier findings, and attention dilutes.

## Lost in the middle

Models attend best to the start and end of long inputs. Put a summary of key findings first, use clear section headers, and do not bury the one critical fact in the middle of a long document.

## Errors travel with context

A subagent that fails should return the failure type, what it attempted, any partial results, and whether a retry may help. Two failure modes to avoid:

- **silent empty success**, which hides the failure and corrupts the final report;
- **global abort**, which throws away all the work that did succeed.

The coordinator decides recovery: retry locally for transient errors, skip with a note, or escalate.

## Measuring quality honestly

- An aggregate of 97% can hide a weak segment, such as handwritten receipts. Measure accuracy per document type.
- Sample high-confidence outputs too, stratified by segment; confidence scores need calibrating against a labelled set before you trust them.
- Self-reported confidence from the model is poorly calibrated and is not an escalation trigger.

## Provenance through synthesis

Keep claim-to-source links all the way to the final report. When two credible sources disagree, report both figures with attribution and say they conflict. Picking one or averaging them invents certainty the evidence does not have.

## Worked example

A long support chat summarises older turns and the agent asks for the order number again. The fix is not a longer summary: pin order ID, amount and dates in a case-facts block that every request carries.
