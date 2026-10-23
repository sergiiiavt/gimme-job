# Remotes, upstreams and synchronization

## Local and remote names

A remote is a named configuration for another repository’s URLs and fetch mappings. `origin` is conventional, not a special central authority. A local branch `main` and remote-tracking ref `origin/main` are different references. The latter records the remote state observed by your latest relevant fetch.

An upstream associates a local branch with another branch for defaults and comparison. It does not continuously synchronize them. In fork workflows `origin` often names your fork and a remote named `upstream` names the original project; the remote name and the branch’s upstream setting are separate concepts.

## Fetch first, then decide

On a clean feature branch with an origin remote:

```sh
git remote -v
git fetch origin
git branch -vv
git log --left-right --oneline HEAD...origin/main
```

Fetch downloads objects and updates configured remote-tracking refs without merging them into your current branch. The log marks commits unique to each side. Ahead/behind counts are relative to locally known refs and can be stale until you fetch. A successful fetch says nothing about whether your feature integrates correctly.

## Pull includes integration

`git pull` fetches and then integrates according to command options and configuration. Use `git pull --ff-only` when you intend only a fast-forward update. It refuses divergent history instead of choosing a merge or rewriting commits for you. For a divergent feature, fetch and deliberately select merge or rebase as described next.

Do not use a pull error as a reason to discard local work. Identify the current branch and commits unique to each side; preserve them before changing strategy. Conflicts are not proof that someone made a mistake.

## Publish a branch explicitly

```sh
git push -u origin feature/retry
git status --short --branch
```

This assumes that local branch exists and that you have permission. `-u` records its upstream after a successful update. Push transfers reachable objects and asks the receiver to update refs; branch rules may reject the update. No pull request is created by ordinary Git push itself.

If the remote branch moved independently, normal push generally rejects a non-fast-forward update. Fetch, inspect the new commits and integrate appropriately. Deleting the remote branch or force-pushing to bypass the rejection can destroy the shared reference to another person’s work.

## Rewriting a private feature branch

After a coordinated rebase, a previously published feature may need a non-fast-forward update. Prefer an explicit expected object ID in a lease. Replace EXPECTED_REMOTE_OID with the full remote tip you actually reviewed:

```sh
git push --force-with-lease=refs/heads/feature/retry:EXPECTED_REMOTE_OID origin HEAD:refs/heads/feature/retry
```

The receiver should reject this if the remote tip differs from that expectation. A successful lease does not prove that the replacement retains every reviewed change. A bare `--force-with-lease` relies on local tracking information, which background fetches can update; an explicit expectation makes the assumption visible. Never treat a lease as permission to rewrite a shared or protected integration branch.

## Deletion and pruning

Deleting a local branch and deleting a remote branch are separate operations. `git fetch --prune origin` removes stale remote-tracking refs according to the fetch mapping; it does not delete your ordinary local feature branches. Read branch ownership and retention policy before deleting published work.

## Failure triage

Distinguish unreachable DNS/network, TLS or SSH trust failure, authentication failure, insufficient repository access, protected-branch rejection, missing objects and integration divergence. Preserve the exact error while redacting tokens and private URLs. Fixing credentials will not fix a non-fast-forward history, and rebasing will not grant permission.

## Checkpoint and answer

**Question:** Fetch succeeded, but the files on your current branch did not change. Why?

**Answer:** Fetch updates downloaded objects and remote-tracking information. It does not check out or integrate origin/main into the current working branch. Inspect the comparison and choose the next operation deliberately.
