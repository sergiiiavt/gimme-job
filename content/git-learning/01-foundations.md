# Git: foundations and learning sequence

## Outcomes and prerequisites

Explain what Git records, where a change currently lives, and which operation can affect collaborators. You need basic file and terminal skills; programming knowledge helps with examples but is not required. The command examples use Git 2.28 or later and a POSIX shell. On Windows use Git Bash or WSL; GUI clients expose the same underlying repository model.

This path is published with **Review required** status. Work through the explanations and inspect the results in a disposable repository before applying unfamiliar history-changing operations to a team project.

## Git and a hosting service

Git is a distributed version-control system. An ordinary full clone stores project history locally, so committing, comparing revisions and creating branches do not require the hosting service. Shallow and partial clones deliberately change how much is available locally.

GitHub, GitLab and Azure Repos host repositories and add permissions, pull requests, review and automation. A pull request is a hosting workflow, not a Git object. A local commit does not automatically upload anything, run remote CI or deploy a service.

## Snapshots and objects

A commit identifies a tree snapshot and records metadata, a message and parent commit references. Trees describe directory entries; blobs hold file contents. Git can reuse unchanged objects rather than copy the whole project for each commit. A commit ID identifies content and metadata, including its parent relationships; it is not a sequential revision number.

Changing a commit message or replaying a commit onto a different parent produces a different commit identity. Existing commits are not edited in place. Git can detect content changes, but cannot judge whether the application still works.

## The three states you inspect

| Location | Meaning | Typical inspection |
| --- | --- | --- |
| Working tree | Files currently checked out and edited | `git diff` |
| Index or staging area | Proposed contents of the next commit | `git diff --cached` |
| Current commit | Recorded snapshot selected by HEAD | `git show HEAD` |

`git add` copies the selected content into the index at that moment. Editing again leaves a newer working-tree change. A commit records the index, which may differ from the visible file. Untracked files have no committed version yet; empty directories are not tracked as independent entries.

## Branches, HEAD and reachability

A branch is a movable reference to a commit. Normally HEAD refers to the current branch; a new commit advances that branch. A tag usually names a fixed release point. In detached HEAD state, HEAD names a commit directly: commits are possible, but create a branch if you want an easy durable name for the work.

A branch is not a separate folder or a copy of every file. Multiple branch names can refer to the same commit, and deleting a branch name does not necessarily delete its commits immediately.

## Learning sequence

Chapters 2–4 establish setup, intentional commits and evidence. Chapters 5–8 cover branches, synchronization and integration. Chapter 9 explains recovery before chapters 10–11 connect Git to review and delivery. Finish with diagnosis, security and the local collaboration lab.

Learn the state transition first, then the command. Before an operation, identify the current branch, uncommitted changes, intended base and whether the affected history is already shared.

## A first inspection

Inside an existing repository, these commands inspect state without creating commits:

```sh
git status --short --branch
git log -5 --oneline --decorate
git diff
git diff --cached
```

An empty diff is not proof that nothing changed: untracked files appear in status, and staged changes appear in the cached diff. Before the first commit, `git log` reports that the current branch has no commits; that is expected.

## Checkpoint and answer

**Question:** You stage a file, edit it again, and commit without staging again. Which version enters the commit?

**Answer:** The staged version. The later edit remains in the working tree. Inspect both diffs instead of assuming the next commit contains whatever your editor currently shows.
