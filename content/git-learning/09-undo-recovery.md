# Undo the right state and preserve recovery options

## Diagnose before undoing

First run status and inspect both staged and unstaged diffs. Identify the current branch, active merge/rebase, last recorded commit and whether a mistake was published. Save valuable uncommitted and untracked files separately before destructive operations. A backup branch protects a commit, not every file in your working directory.

## Choose by the state you intend to change

| Need | Tool | What to understand first |
| --- | --- | --- |
| Unstage a path | `git restore --staged -- path` | Defaults to restoring the index from HEAD |
| Discard unstaged tracked edits | `git restore -- path` | Overwrites the working file from the index |
| Rebuild an unpublished last commit | `git reset --soft HEAD~1` | Moves the branch, preserving index and working files |
| Reverse a published ordinary commit | `git revert COMMIT_ID` | Adds a new inverse change; can conflict |
| Find a recently moved local ref | `git reflog` | Local records have retention limits |

These are alternatives, not a script to run in sequence. Before the root commit there is no HEAD snapshot to restore from; before a commit with a parent, `HEAD~1` does not exist.

## Restore is not a universal undo

Plain restore for a path copies the index version to the working tree and discards conflicting unstaged edits. If you staged an unwanted change, plain restore does not return the file to the previous commit. Use an explicit source and target when needed, and understand both before running it.

`git restore --source=COMMIT_ID -- path` restores selected historical content into the working tree; inspect and stage it if you intend a new commit. It does not move the current branch back in time.

## Reset has several effects

With a commit argument, reset can move the current branch. `--soft` leaves index and working files alone; the default mixed mode resets the index too, leaving working files. `--hard` also overwrites tracked working state and can remove obstructing untracked paths. Do not treat it as a generic fix for a dirty tree or divergence.

Path-based reset is a different form that changes index entries without moving the branch. Prefer the clearer `restore --staged` when teaching simple unstaging.

## Revert preserves shared history

After choosing a real ordinary commit ID, `git revert COMMIT_ID` records a new change that undoes that commit’s effect relative to its parent. Later changes may cause conflicts. Revert does not remove the old commit, erase a leaked secret or roll back an already deployed service.

Reverting a merge requires choosing the mainline parent and affects future merging behavior. Consult the graph and team release process rather than guessing `-m 1`. A production rollback may also require an older artifact, compatible database state and operational verification.

## Recover a displaced commit

```sh
git reflog --date=iso
git show --stat RECOVERED_COMMIT_ID
git branch recovery/inspection RECOVERED_COMMIT_ID
```

Replace RECOVERED_COMMIT_ID with an inspected real ID and use an unused branch name. Creating a recovery branch names the commit without overwriting the current working tree. Then compare and selectively integrate what you need.

Reflogs are local, are not ordinary shared commit history and can expire. They cannot reliably recover a file that was never recorded by Git, and they are not a replacement for backups. Avoid garbage collection or more destructive commands while investigating lost work.

## Detached HEAD and interrupted operations

If useful commits were made in detached HEAD state and you are still there, `git switch -c recovery/my-work` gives them a branch name. If you already moved away, inspect reflog. For an active merge, rebase or cherry-pick, read status and use that operation’s continue or abort procedure rather than layering unrelated resets on top.

## Checkpoint and answer

**Question:** A bad commit is already on a shared main branch. Should you reset main backwards and force-push?

**Answer:** Usually add a reviewed revert or corrective change, then follow the delivery process. Rewriting shared main can disrupt collaborators and violate branch policy. Separately assess data migrations, external effects and production recovery.
