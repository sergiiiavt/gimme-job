# Branches, unfinished work and parallel tasks

## A branch names a line of work

Start a branch from the revision you intend to extend. The branch name describes purpose; it does not create isolation from remote dependencies, local databases or other files outside Git. Short-lived branches reduce the time changes drift apart, but naming and lifetime are team decisions.

In a cloned repository with main checked out, first preserve any local edits, fetch and update main explicitly. The following assumes an existing `origin/main` and a clean working tree:

```sh
git fetch origin
git switch main
git merge --ff-only origin/main
git switch -c feature/retry
git status --short --branch
```

If the fast-forward fails, inspect the divergence; do not force main into a new state just to make the command succeed. For the local repository from chapter 3, no remote exists yet: start a branch with `git switch -c feature/retry` directly from its recorded commit.

## Switching does not always discard edits

Git can carry compatible uncommitted changes across a branch switch. It refuses some switches that would overwrite changes. Therefore “I switched branches” does not prove a clean environment. Check status before and after switching, especially when reproducing a bug or running release checks.

Switching changes tracked files; it does not necessarily remove ignored build products, cached dependencies or data. A correct checkout and a reproducible build environment are separate requirements.

## Stash temporarily, then inspect

```sh
git stash push -u -m "WIP before investigating a release"
git stash list
git stash show --stat 'stash@{0}'
git stash apply 'stash@{0}'
git status --short
```

This sequence only creates a new stash if there are changes to save. `-u` includes untracked files, but not ignored files. `apply` keeps the stash so you can inspect the result before explicitly dropping it. `pop` also tries to remove the stash after successful application; conflicts can leave it in place. Use an explicit entry when several stashes exist.

A stash is local and can conflict when reapplied. It is not a reviewed commit, team synchronization mechanism or durable backup. A temporary branch with a clearly identified WIP commit can be easier to reason about for longer work.

## Worktrees for concurrent checkouts

From a repository with a local main branch, create a separate branch and checkout directory:

```sh
git worktree add -b fix/release ../git-release-worktree main
git worktree list
```

Linked worktrees share the repository’s objects and most refs but have separate checked-out files, indexes and HEAD state. Git normally prevents the same branch from being checked out in two worktrees. Use different branch names instead of overriding this protection by habit.

Install required dependencies in the appropriate worktree. A database, container name or fixed application port can still be shared outside Git. Worktrees isolate source directories, not all runtime resources.

## Clean up deliberately

When the extra worktree is clean and its work is preserved, remove it with `git worktree remove ../git-release-worktree`. Keep or delete its branch as a separate decision. `git branch -d feature/retry` performs a merge-safety check; `-D` bypasses that check. Squash integration can mean equivalent changes exist on main without the original feature commits being ancestors, so inspect rather than treating a deletion refusal as proof of missing functionality.

## Choose the least surprising tool

Use a branch for a coherent change, a stash for a brief interruption and a worktree for simultaneous checkouts. None replaces communication when two people modify the same feature. Before handing work over, publish the intended commits to an agreed branch and explain the remaining state.

## Checkpoint and answer

**Question:** You switched to main but still reproduce a feature-only behavior. Is Git necessarily broken?

**Answer:** No. Check carried local edits, ignored generated files, running processes, external state and the actual checked-out commit. Branch names alone do not identify the complete runtime environment.
