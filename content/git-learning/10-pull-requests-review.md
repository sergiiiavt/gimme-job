# Pull requests and collaborative review

## The unit of collaboration

A pull request proposes integrating one branch into a selected base. It gathers the problem, diff, commits, discussion and automated checks in one place. It does not guarantee that the change is small, tested or safe. Draft status communicates incomplete work; it is different from this learning path’s content-review label.

Keep one coherent purpose per change. Include necessary tests and documentation, but separate unrelated formatting and cleanup so reviewers can assess behavior and risk without reconstructing the author’s entire work session.

## Select the repository and base

In a shared repository, publish a focused feature branch and target the correct integration or release branch. In a fork workflow, origin commonly points to your fork and upstream to the original repository. Fetch the intended base, compare against it, and inspect which repository will receive the proposal. A mistakenly selected release branch can produce a huge or misleading diff.

Never infer that creating a public fork makes private data safe to commit. Repository contents, not the label on the workflow, determine what is exposed.

## Prepare a reviewable proposal

The description should connect a concrete trigger to the changed behavior. A useful small example is:

```text
Problem: transient failures were retried only once.
Change: allow three retries while retaining the existing timeout budget.
Validation: focused retry tests plus the existing regression suite.
Risk: verify the additional attempts do not exceed the overall deadline.
```

This is an example description, not a claim that those tests were run. Replace it with evidence from the actual change. Describe limitations and rollout requirements when they materially affect review. Screenshots help for visual changes, but do not replace interactions, accessibility or state checks.

## Review behavior and evidence

Read the requirement and full diff, then follow connected callers, tests, configuration and migration effects. Ask what happens on failure, at boundaries and for existing consumers. A green CI result only covers the checks it actually executed; inspect skipped jobs, test scope and the revision tested.

Classify feedback clearly: a defect that blocks integration, a question requiring an answer, or a nonblocking suggestion. Explain the consequence and relevant evidence. Prefer a precise comment about a failure mode over a vague personal preference about style.

## Respond without losing context

Address feedback with focused commits or the team’s agreed history policy. Reply with the change or reasoning; resolving a thread does not implement the fix or substitute for required approval. If new commits alter reviewed behavior, request another look. Some branch rules dismiss approvals or require checks again after updates.

Disagreement should converge on requirements, maintainability, compatibility and evidence. When an interface or product decision is unclear, identify the owner and record the decision. Do not silently rewrite another contributor’s branch or publish their work under a different assumption.

## Choose a collaboration model

Trunk-based work favors small, frequent integrations and may use feature flags for incomplete behavior. Release branches support maintenance of shipped versions. Gitflow adds long-lived roles for branches and can fit some release processes, but introduces coordination and integration overhead. No model is universally superior: choose based on release cadence, supported versions and team constraints.

Document the expected base, merge method, required checks, review ownership and emergency path. Branch naming alone does not enforce any of them.

## Merge and follow through

Check that the latest intended revision has required approval, passing checks and an acceptable integration result. Use the configured merge mechanism; a merge queue may validate a new combination with other changes. Afterwards verify the delivery workflow and deployed behavior when the task includes release. Delete obsolete branches only after the work is preserved and the team’s retention policy allows it.

## Checkpoint and answer

**Question:** A reviewer approved a PR, then the author changed the authentication logic. Is the original approval enough?

**Answer:** Reassess the changed behavior and follow the branch rules for fresh review and checks. The meaningful approval is for the relevant current change, not an indefinitely reusable badge attached to a PR number.
