# Resolve conflicts without losing intent

## Text conflicts and semantic conflicts

A text conflict means Git could not choose a combined version automatically. A semantic conflict means changes combine mechanically but disagree in behavior. Only the first necessarily stops Git. Preserve both authors’ intent by reading the base, both changes, requirements and affected callers.

## Create an isolated conflict

Run this in a new parent directory where `git-conflict-lab` does not exist. It creates only a local repository with a fictional identity:

```sh
git init --initial-branch=main git-conflict-lab
cd git-conflict-lab
git config user.name "Course Learner"
git config user.email "learner@example.invalid"
printf 'retries=1\n' > settings.ini
git add settings.ini
git commit -m "Record baseline"
git switch -c feature/retry
printf 'retries=3\n' > settings.ini
git commit -am "Allow three retries"
git switch main
printf 'retries=2\n' > settings.ini
git commit -am "Raise baseline to two retries"
git merge feature/retry
```

The final command is expected to fail with a content conflict. Both branches changed the same line from the same ancestor. That nonzero exit is the demonstration, not a reason to run a force command.

## Inspect all three versions

```sh
git status
git diff --name-only --diff-filter=U
git show :1:settings.ini
git show :2:settings.ini
git show :3:settings.ini
```

For this ordinary merge, index stage 1 is the base, stage 2 is the current side and stage 3 is the incoming side. Not every conflict has all three entries: additions and deletions can change that. The working file contains conflict markers showing the competing text.

## Resolve the example deliberately

Assume the agreed requirement is three retries. Write the intended complete file, stage it and inspect the result before finishing the merge:

```sh
printf 'retries=3\n' > settings.ini
git add -- settings.ini
git diff --cached
git diff --cached --check
git commit -m "Merge retry feature with three-retry policy"
git status --short
```

Removing markers is only the mechanical step. In a real project, run focused tests and inspect dependent behavior. If the requirement is unclear, obtain a decision from the owners instead of choosing the larger number because it looks more conservative.

## Rebase uses different sides

During rebase, the current side commonly represents the new upstream plus already replayed work, while the other side represents the commit being replayed. Consequently `ours` and `theirs` can feel reversed compared with merging main into a feature. Inspect actual contents and operation state; do not use these labels as synonyms for “my work” and “their work.”

After resolving and staging the files in a rebase, use `git rebase --continue`, not a standalone recipe for creating a merge commit. Another replayed commit may conflict again. Skip a commit only when you have established that its change should be omitted or is already present.

## Abort and retry from preserved work

For the in-progress merge above, `git merge --abort` is an alternative to resolving it, not a follow-up after completion. Rebase and cherry-pick each have their own abort command. Starting clean makes abort behavior easier to understand; recovery of pre-existing uncommitted edits is not something to leave to chance.

## Other conflict shapes

Modify/delete, rename and binary conflicts need a decision about the resulting paths and content, not only marker editing. For generated files, identify their authoritative inputs and regenerate using the project’s documented process. Do not blindly choose one side of a lockfile and assume it still matches the dependency declaration.

## Checkpoint and answer

**Question:** A merge completed without conflict and all markers are gone. Is the change ready?

**Answer:** Only the textual integration succeeded. Verify requirements, API and schema compatibility, affected tests and the final diff. Git cannot detect all contradictory business rules or runtime assumptions.
