# Integrate changes deliberately

## Start with ancestry and ownership

Before integrating, fetch relevant remote information, inspect the graph and preserve uncommitted work. Ask whether the branch is private, shared or protected, and which history policy the team expects. Merge, rebase and cherry-pick solve different problems; none substitutes for reviewing the resulting behavior.

## Fast-forward and merge commits

If your current branch is an ancestor of the target, a fast-forward moves its ref to that target without creating a merge commit. If both sides have unique commits, a regular merge combines them using a common ancestor and records a commit with multiple parents when it succeeds.

On your feature branch, after fetching origin:

```sh
git merge origin/main
git status
git log --oneline --graph --decorate -10
```

This brings main into the feature, not the feature into main. It can succeed automatically, pause for conflicts or open an editor for a message. A `--no-ff` merge requests an explicit merge commit even when fast-forwarding would be possible. Team policy should determine whether that integration record is useful.

## Rebase replays a line of work

On an unshared feature branch, an alternative is:

```sh
git branch backup/retry-before-rebase
git rebase origin/main
```

Use a unique backup branch name. Rebase replays selected changes on a new base; ordinary replayed commits get new IDs because their parents change. Empty or already-applied changes may be handled differently depending on options and Git behavior. Inspect the resulting diff rather than counting IDs as proof of retained behavior.

Do not run both examples automatically as one recipe: they are alternative integration choices. Rewriting published commits requires coordination and may be forbidden by policy. Interactive rebase can reword, reorder or combine your own commits, but you must recheck the resulting intermediate and final states.

## Squash is another history choice

A squash integration records combined changes as a new commit without making the original feature tip a merge parent. It can simplify main’s history, but main will not contain the original commits by ancestry. Git’s local `merge --squash` prepares the combined change for a separate commit; a hosting platform may provide its own squash-and-merge operation.

Long-lived branches repeatedly squash-merged into the same target can create confusing comparisons. Usually start the next change from the updated integration branch.

## Cherry-pick for a selected change

`git cherry-pick COMMIT_ID` applies a selected commit’s change to the current branch and normally records a new commit. Use a real reviewed ID, on the intended target branch, with a clean working tree. `-x` records the original ID for traceable backports when appropriate.

A clean cherry-pick does not prove that prerequisites exist. A fix can depend on earlier schema, API or refactoring changes. Merge commits require a deliberate mainline choice with `-m`; do not guess a parent number just to suppress an error.

## Conflicts and stopping points

Merge uses `git merge --abort` to abandon an in-progress merge; rebase uses `git rebase --abort` or, after resolution, `git rebase --continue`. Cherry-pick has corresponding continue and abort operations. Read `git status` to identify the active operation. Rebase can stop more than once because it replays commits individually.

## Compare the final behavior

After integration, inspect history, the final diff relative to the intended base, and affected tests. Keep backup refs until the result is understood. A syntactically clean merge can still combine incompatible assumptions, such as a renamed setting and a consumer still using the old name.

## Checkpoint and answer

**Question:** Why is rebasing a shared branch different from merging main into it?

**Answer:** Rebase replaces commit identities that others may already use; they must reconcile their work with that rewritten history. A merge preserves existing commit identities and adds an integration relationship. Choose based on ownership, policy and review needs.
