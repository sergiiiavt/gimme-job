# Setup, identity and authentication

## Choose and verify an installation

Install Git using the official installer or your operating system’s maintained package source, then run `git --version`. This path uses `switch`, `restore` and `init --initial-branch`; the shown commands require Git 2.28 or later. On macOS several installations can coexist, so check which executable your terminal and IDE use. On Windows, Git Bash provides the shell syntax used here.

Choose an editor you can save and close confidently. A commit, merge or rebase can open it and wait; an apparently stuck terminal may simply be waiting for the editor.

## Create a disposable repository

Run the following in a parent directory where `git-lab` does not already exist. The identity is a fictional training identity and is configured only for this repository.

```sh
git init --initial-branch=main git-lab
cd git-lab
git config --local user.name "Course Learner"
git config --local user.email "learner@example.invalid"
git status
```

For real work use the identity and email required by your team. Repository-local configuration overrides the usual user-level defaults. Inspect a setting with `git config --show-origin --get user.email`; avoid sharing a full configuration dump because it can contain private URLs or credential-related values.

## Clone an existing project

Cloning creates a local repository, configures a remote usually named `origin`, and checks out its default branch. Replace OWNER and REPOSITORY before running this separate example, from outside another checkout:

```sh
git clone https://github.com/OWNER/REPOSITORY.git
cd REPOSITORY
git remote -v
git status --short --branch
```

Do not initialize a second repository inside a cloned project. Inspect its README and setup scripts before executing them; checking out source and trusting its build process are separate decisions. A repository’s default branch need not be named `main`.

## Commit identity is not authentication

`user.name` and `user.email` become commit metadata. They do not log you into GitHub or grant access. Fetching or pushing to a private remote uses a transport identity: commonly HTTPS with a credential manager/token, or SSH with a key authorized by the hosting service.

For HTTPS, use the host’s supported login or credential-manager flow. Do not put a token into a clone URL, commit message, terminal screenshot or source file. For SSH, keep the private key private, authorize only the public key and verify unfamiliar host-key fingerprints against the service’s official information. Organization SSO may require additional authorization even after account authentication succeeds.

## Configuration scope and defaults

`--local` changes this repository; `--global` changes your user defaults. Read the team policy before changing merge, pull or line-ending defaults. Use command-specific behavior while learning, such as `git pull --ff-only`, so an inherited configuration does not silently choose a different integration strategy.

If you use several work accounts, repository-local identity or conditional configuration can keep attribution separate. Signing commits is another configuration layer; it is neither a substitute for transport authentication nor proof that the code is correct.

## Cross-platform text

Line-ending policy belongs in version-controlled `.gitattributes` when the team needs consistency. For example, `* text=auto` enables text normalization and `*.sh text eol=lf` requests LF for shell scripts. Do not normalize an entire existing repository casually: it can create a very large diff and obscure functional changes. Discuss the policy and isolate normalization in its own reviewed change.

## Verify readiness

You should know the repository root, current branch, author email, remote URL and supported authentication method. A successful clone proves read access at that time; it does not prove push permission, branch-rule compliance or permission to deploy. Public repositories can often be cloned without authentication.

## Checkpoint and answer

**Question:** You configured the correct author email, but pushing returns an authorization error. What should you inspect?

**Answer:** The remote URL, actual HTTPS/SSH account, credential or key authorization, organization SSO and repository permissions. Changing commit attribution will not repair transport authorization.
