# A local collaboration lab and task reference

## What the lab demonstrates

The [runnable lab](https://github.com/sergiiiavt/gimme-job/tree/main/examples/git-collaboration) creates a local bare remote and two contributors in a new temporary directory. It executes real Git commands and checks resulting files, refs and exit codes. No hosting account, network access or token is needed for the lab itself.

It is a guided verification of Git mechanics, not a local implementation of GitHub permissions, PR reviews or CI. Those collaboration decisions are covered in chapters 10–11 and must be practiced using your team’s actual hosting rules.

## Run from a repository checkout

You need Git 2.28+ and Python 3.9+. From the GimmeJob repository root:

```sh
python3 examples/git-collaboration/verify_workflow.py
```

On Windows, use a Python installation with Git available on PATH; the equivalent launcher can be `py`. The script uses Python’s standard library and invokes Git directly, so it does not require Bash, Docker, npm or a Python package installation. Downloading the project initially is separate from running this offline lab.

## Follow the state transitions

The lab checks staging separately from later edits, an untracked-file stash, fetch without working-file mutation, a real rebase conflict, explicit resolution and an integration merge. It then verifies revert, a recovered detached commit, a second worktree, rejection of a stale explicit force-with-lease expectation, a bisect result and an annotated release tag.

Expected conflicts and rejected pushes must be recognized as expected results. Treating every nonzero command as an instruction to retry with force is precisely the error this lab is meant to expose.

## Understand the evidence

Each stage prints a short PASS message only after its checks succeed. A failure raises an error with the local command and output. The script uses fictional identities, disables inherited Git configuration for the child commands and cleans up its temporary directory on exit. It does not change your current repository’s refs or global Git configuration.

Read the source alongside the transcript. Trace the local branch, remote branch and working-file contents before and after each operation. Passing the script is evidence for those scenarios in the installed Git environment, not certification of all possible Git workflows.

## Inspect and record changes

| Task | Command | State or limitation |
| --- | --- | --- |
| Inspect current state | `git status --short --branch` | Includes untracked paths |
| Inspect unstaged changes | `git diff` | Working tree versus index |
| Inspect next commit | `git diff --cached` | Index versus HEAD |
| Stage one path | `git add -- path` | Captures its current content |
| Unstage one path | `git restore --staged -- path` | Keeps working edits |
| Record the index | `git commit` | Creates a local commit |

Review the final staged diff and run appropriate checks before committing. A file’s current editor contents and its staged contents may differ.

## Integrate and recover

| Task | Command | Decision needed |
| --- | --- | --- |
| Refresh remote knowledge | `git fetch origin` | No automatic local integration |
| Update without divergence | `git pull --ff-only` | Refuses a divergent history |
| Name a new task | `git switch -c feature/name` | Choose the correct starting commit |
| Merge a fetched base | `git merge origin/main` | May create a merge commit or conflict |
| Rebase a private feature | `git rebase origin/main` | Replaces replayed commit identities |
| Reverse a shared ordinary change | `git revert COMMIT_ID` | Review inverse behavior and conflicts |
| Find recent local ref moves | `git reflog` | Retention and local-only limitations |

Commands with symbolic IDs require real inspected values. No command table can decide whether rewriting shared history is acceptable; that is a collaboration and authorization question.

## Connect to the wider learning path

Apply these skills to [programming](/learn/programming), [automation](/learn/automation), [Docker](/learn/docker) and [Cloud & DevOps](/learn/cloud-devops). For any change, practice one chain: identify the revision, make a coherent commit, publish to the intended branch, review the exact diff, pass relevant checks, integrate and verify delivery when required.

## Checkpoint and answer

**Question:** Your force-with-lease push was rejected after a teammate updated the branch. What is the correct next step?

**Answer:** Fetch and inspect their actual update, coordinate ownership and preserve or integrate it. Do not refresh the expectation and repeat the push automatically; that would discard the protection’s purpose and can overwrite the teammate’s work.
