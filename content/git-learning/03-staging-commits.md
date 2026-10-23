# Intentional changes and useful commits

## Read status before staging

Continue in the empty `git-lab` repository from chapter 2. Status distinguishes untracked, staged and unstaged changes. In short format the first column generally describes the index and the second the working tree; unmerged entries have special codes. A file can appear in both columns because you staged one version and edited it again.

## Build the first snapshot

```sh
printf 'retries=1\n' > settings.ini
printf 'A local Git learning project.\n' > README.md
git add -- README.md settings.ini
git diff --cached
git commit -m "Add initial retry configuration"
git status --short
```

You should see a root commit containing two files and then no pending changes. The message describes the result; its body can explain why the change is needed, important constraints and how it was verified. A useful commit is coherent enough to review, test and potentially revert independently.

## Stage the content you mean

`git add -- path` stages the current content at that path. `git add -p` lets you select hunks, but a selected subset can still be incomplete or invalid. `git diff` compares working files to the index; `git diff --cached` compares the index to HEAD. Review both when a file has mixed changes.

`git commit -a` stages modifications and deletions of tracked files; it does not add new untracked files. Broad staging with `git add .` can accidentally include generated output or secrets. Prefer explicit paths until you understand the complete diff.

## Observe a staged and unstaged version

```sh
printf 'retries=2\n' > settings.ini
git add -- settings.ini
printf 'retries=3\n' > settings.ini
git diff --cached
git diff
git restore --staged -- settings.ini
git status --short
```

The first diff proposes changing 1 to 2, while the second shows the later change from 2 to 3. Unstaging restores the index entry from HEAD and leaves the working file at 3. Stage the desired final version when ready; do not commit blindly because the visible file looks correct.

## Ignored and tracked files

A repository `.gitignore` shares exclusion patterns for generated or local files; `.git/info/exclude` is local. Ignoring a file does not stop tracking an already committed file and does not prevent an explicit force-add. Diagnose a pattern with `git check-ignore -v -- path`.

For a tracked local settings file, coordinate a migration to a committed template and ignored runtime file. `git rm --cached -- path` removes a tracked path from the next snapshot while leaving its working copy; its historical contents remain in Git. This is not secret removal.

## Keep diffs reviewable

Avoid mixing formatting, dependency updates, renamed files and behavior changes without a reason. Use `.gitattributes` for agreed text normalization; do not solve a huge line-ending diff by hiding whitespace and assuming the behavior is unchanged. Git infers many renames from content similarity rather than storing a permanent rename event.

Before committing, inspect `git diff --cached --stat`, the full staged diff and `git diff --cached --check`. The last command detects certain whitespace and conflict-marker problems; it does not execute tests or validate application semantics.

## Amend with a history boundary

`git commit --amend` replaces the current tip with a new commit containing the current index and amended metadata. It does not append a small edit to the original commit. Use it for your own unpublished work; after publication, coordinate with anyone who may depend on the old commit and respect branch rules.

## Checkpoint and answer

**Question:** You add `.env` to `.gitignore`, but Git still shows changes to it. Why?

**Answer:** It was already tracked. Decide how to remove it from future snapshots, and rotate exposed credentials if it contained secrets. An ignore rule neither rewrites history nor revokes access.
