# Investigate state and locate regressions

## Establish what is running

Begin with the repository root, checked-out revision, branch and local edits. Then identify the build artifact, process and external configuration used by the failing test. A directory containing the expected source does not prove a running service uses it.

```sh
git rev-parse --show-toplevel
git rev-parse HEAD
git status --short --branch
git log -5 --oneline --decorate
```

Compare with CI’s recorded revision and environment. A clean working tree does not cover ignored build output, external services or locally installed dependency versions.

## Separate state problems from product defects

| Symptom | Useful investigation |
| --- | --- |
| Change absent from a diff | Check staged, unstaged, ignored and untracked states |
| Branch appears outdated | Fetch, inspect upstream and compare exact refs |
| Push rejected | Read whether the cause is permissions, rules or divergence |
| File name differs only by case | Inspect tracked paths and filesystem behavior |
| File changed on every line | Inspect encoding, line endings and attributes |
| Integration cannot continue | Read status for merge, rebase or cherry-pick state |

Avoid randomly changing configuration until a command succeeds. Keep a short record of the symptom, expected state and evidence for each hypothesis.

## Blame gives a starting point

`git blame -L 1,20 -- path` attributes a line range to commits. It does not assign personal responsibility for a defect. The surrounding design may have changed later, and formatting can move attribution. Follow the commit diff, parent version and related discussion; use path history and string searches to investigate when behavior changed.

## Define a stable bisect predicate

Bisect searches between known good and bad revisions for the first change that flips an observed property. Choose a reproducible check with fixed inputs and a controlled environment. If failures appear and disappear independently of revision, the result can be misleading.

Keep the check executable outside the repository being traversed when older commits do not contain it. Ensure it can run against every candidate or classify untestable revisions explicitly. A missing build tool is not evidence that the product regression existed.

## Run and finish a search

Replace the uppercase names with inspected commit IDs and the absolute path with your check. Preserve work first:

```sh
git bisect start
git bisect bad KNOWN_BAD_COMMIT
git bisect good KNOWN_GOOD_COMMIT
git bisect run python3 /absolute/path/check_regression.py
git bisect log
git bisect reset
```

For `bisect run`, exit 0 means good, 1–127 normally mean bad except 125, which skips an untestable revision. Certain other statuses stop the search. Make the harness distinguish an actual failing product assertion from setup failure. Too many skips can leave several possible first-bad commits instead of one answer.

## Verify the candidate

Reproduce the failure on the reported commit and the expected good behavior on its relevant parent, using the same inputs. Examine the change and its dependencies. For a merge-heavy history, decide whether you need the first integration on a mainline or the original feature change; parent relationships and optional first-parent search affect the question answered.

Bisect finds a transition for your predicate, not a complete causal explanation. A feature flag, data migration or test-harness assumption may explain the observed transition.

## Report evidence and restore context

Record good/bad IDs, the check command, environment, candidate and confirmation. Run `git bisect reset` after the investigation to return from the search state. If reproducing requires uncommitted or private data, document the dependency without publishing the data itself.

## Checkpoint and answer

**Question:** An old revision cannot build because its historical toolchain is missing. Should the bisect script return the same result as a failing product assertion?

**Answer:** No. Restore a compatible environment or explicitly skip an untestable revision. Otherwise the search can identify a toolchain boundary instead of the regression you intended to locate.
