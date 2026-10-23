# Repository security and long-term hygiene

## Treat a checkout as untrusted input

A repository can contain executable build scripts, dependency definitions and CI workflows. Read them before running code from an unfamiliar source. Do not copy its hooks or grant access to local credentials merely to finish setup. A repository can also contain private information in earlier commits even when the latest files look harmless.

## Secrets require revocation first

If a real credential was committed or otherwise exposed, revoke or rotate it first and assess access. Deleting the current file, adding an ignore rule or reverting the commit leaves earlier data reachable. Coordinated history cleanup may be needed, but forks, clones, caches and other copies require separate handling.

Use the host’s documented incident process. Rewriting history changes IDs and can disrupt open PRs, signatures and collaborators. Never promise complete erasure merely because a force-push succeeded. Commit examples and templates should use clearly fictional values, not production credentials.

## Ignore rules and cleanup

Share generated-file patterns in `.gitignore`, and commit safe configuration templates rather than runtime secrets. Review both tracked and untracked files before staging. Local hooks and secret scanners are useful layers; no scanner proves that every possible sensitive value is absent.

`git clean` removes untracked content rather than restoring it from Git. A dry run such as `git clean -nd` previews untracked directories and files without deleting them. Flags that include ignored files can also target dependencies or local settings. Inspect exact paths and preserve important content; reflog is not an undo for untracked-file deletion.

## Large and binary files

Git stores historical content, so repeatedly replacing a large binary can grow history even after deleting the latest file. Git LFS stores pointer files in Git and large objects in separate storage. Contributors and CI need compatible LFS tooling, access and object availability; a pointer alone is not the actual asset.

Adding an LFS rule does not automatically migrate all existing history. Moving assets out of an established repository is a coordinated repository-maintenance task, not a side effect of a normal feature PR. Check quotas, retention and backup needs before choosing external storage.

## Submodules pin another repository

A submodule records a particular commit from another repository plus configuration such as its URL. The parent does not automatically mean “use the latest default branch.” Initialize/update according to the project’s documented commands and review pointer changes as dependency changes.

When contributing to a submodule, preserve and publish its intended commit to the correct remote before updating the parent pointer. Otherwise teammates may receive a parent revision pointing to an inaccessible object. Nested authentication and detached HEAD state need explicit attention.

## Clone depth and missing objects

Shallow clones omit older history; partial clones can defer selected objects. These save transfer but affect history searches, merge-base discovery, tags and offline work. Diagnose missing history before assuming a commit never existed. Configure CI’s fetch depth and tags according to the checks it actually needs; deepen the clone deliberately when investigating older revisions.

## Cross-platform and trust details

Case-insensitive filesystems may conceal filename collisions that fail on Linux. A case-only rename may need a deliberate intermediate name and review. Attributes control text treatment; file executable bits, symlinks and external tools can behave differently across systems.

Signed commits identify signed objects under a key-trust policy, not safe behavior. Avoid broad trust overrides such as trusting every directory to silence an ownership warning. Investigate repository ownership and service-account boundaries instead. Keep remote URLs free of embedded credentials and redact logs before sharing.

## Checkpoint and answer

**Question:** A secret was removed from the current branch and the PR diff is now clean. Is the incident resolved?

**Answer:** Not by that evidence alone. Revoke or rotate the secret, assess exposure and follow the documented cleanup process for history and other copies. Also fix how the credential entered source control so the same path does not leak it again.
