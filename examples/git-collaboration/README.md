# Git & collaboration lab

Run from the repository root with Git 2.28+ and Python 3.9+ on PATH:

```sh
python3 examples/git-collaboration/verify_workflow.py
```

On Windows the Python launcher may be `py` instead of `python3`.

The standard-library script creates a temporary local bare remote and two clones
with fictional identities. It runs actual Git operations and checks staged versus
working content, an untracked-file stash, fetch, a rebase conflict and resolution,
merge ancestry, revert, reflog recovery, linked worktrees, stale lease rejection,
bisect and an annotated release tag. Expected conflicts and rejected pushes are
verified as outcomes rather than hidden with force commands.

It uses no network, hosting account, credentials, external Python dependencies or
shell scripts. Child commands do not inherit Git configuration or Git environment
overrides; hooks and signing are disabled for the synthetic repositories. The
temporary directory is removed on exit. Existing repository refs and user Git
configuration are not changed.

This demonstrates local Git mechanics. It does not simulate a hosting service's
review approvals, branch protection, CI or production deployment. Those decisions
belong to the accompanying [learning path](https://gimme-job.com/learn/git), which
is explicitly marked **Review required**.
