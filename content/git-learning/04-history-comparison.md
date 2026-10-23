# Read history and compare the right revisions

## Start with a question

Choose a comparison that answers a concrete question: what is uncommitted, what changed in one commit, what differs between two branch tips, or what a feature introduced since a shared ancestor. A convincing-looking diff can answer the wrong question if its endpoints are wrong.

## Read a graph rather than a flat list

```sh
git log --oneline --graph --decorate --all -15
git show --stat HEAD
git show HEAD -- settings.ini
```

Decorations show references pointing at commits. Graph lines show ancestry, including multiple parents for merge commits. Commit timestamps are useful context, but the graph determines ancestry; dates alone do not prove which change depends on another. A shortened object ID can become ambiguous, so use a full ID for durable evidence.

## Compare snapshots and paths

`git diff A B` compares the two resulting trees; `git diff A..B` means the same snapshot comparison for diff. Limit it to a path with `-- settings.ini`. `git diff --name-status A B` helps assess changed paths, while `--stat` summarizes size and the full diff explains content.

For these examples replace A and B with known branch names, tags or commit IDs. Do not type the angle-bracket convention from other documentation as shell syntax.

## Two dots and three dots

| Command | Question answered |
| --- | --- |
| `git log A..B` | Which commits are reachable from B but not A? |
| `git log A...B` | Which commits are exclusive to either side? |
| `git diff A B` | How do the two tip snapshots differ? |
| `git diff A...B` | How does B differ from the merge base of A and B? |

Three-dot diff is asymmetric: swapping A and B changes which side is compared with the base. Hosting pull requests commonly use a merge-base comparison, but inspect the actual base and current commits rather than assuming every compare view is identical.

## Review a feature against an updated base

After `git fetch origin`, the following inspect a feature named `feature/retry` if those refs exist:

```sh
git log origin/main..feature/retry --oneline
git diff --stat origin/main...feature/retry
git diff origin/main...feature/retry -- settings.ini
```

`origin/main` reflects your last fetch, not a live view of the server. Fetch does not merge it into local main. If the base moves again, the review comparison and simulated merge result can change.

## Trace the reason behind a line

`git log -p -- path` follows changes to a path. `git log -S 'retries=' -- settings.ini` searches changes in the occurrence count of a string; `-G` searches matching added or removed lines using a regular expression. These are different questions. `git blame` attributes surviving lines to commits; follow their messages, surrounding changes and linked discussion before drawing conclusions about intent.

## Capture reproducible evidence

Record the exact commit, comparison base, command or failing check, and relevant environment. A branch name can move; a screenshot of a green check without a revision is weak evidence for a later deployment. Git history establishes what was recorded, not whether tests were comprehensive or the release succeeded.

## Checkpoint and answer

**Question:** Main changed after a feature branched. Why can `git diff main feature` include changes the feature author never made?

**Answer:** It compares both current snapshots, so differences caused by changes only on main also appear. A merge-base comparison isolates the feature side since its common ancestor; review the integration result separately for compatibility.
