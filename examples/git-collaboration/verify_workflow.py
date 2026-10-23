"""Execute a synthetic, offline collaboration workflow using the installed Git."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class Lab:
    def __init__(self, root):
        self.root = root
        # Keep the caller's PATH, but do not inherit repository selection, signing,
        # credentials, hooks or configuration injected through Git environment vars.
        self.env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        self.env.update({
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_EDITOR": "true",
            "GIT_MERGE_AUTOEDIT": "no",
            "GIT_ALLOW_PROTOCOL": "file",
        })
        self.hooks = root / "empty-hooks"
        self.hooks.mkdir()

    def git(self, directory, *args, expected=0):
        command = [
            "git", "-c", "commit.gpgSign=false", "-c", "tag.gpgSign=false",
            "-c", f"core.hooksPath={self.hooks}", *args,
        ]
        result = subprocess.run(
            command, cwd=directory, env=self.env, capture_output=True,
            text=True, encoding="utf-8", timeout=20, check=False,
        )
        require(
            result.returncode == expected,
            f"Expected exit {expected}, got {result.returncode}: {' '.join(command)}\n"
            f"{result.stdout}{result.stderr}",
        )
        return result.stdout.strip()

    def clone(self, remote, name):
        self.git(self.root, "clone", str(remote), name)
        checkout = self.root / name
        self.git(checkout, "config", "user.name", f"Course {name}")
        self.git(checkout, "config", "user.email", f"{name}@example.invalid")
        self.git(checkout, "config", "core.autocrlf", "false")
        return checkout

    def commit_file(self, checkout, name, content, message):
        (checkout / name).write_text(content, encoding="utf-8")
        self.git(checkout, "add", "--", name)
        self.git(checkout, "commit", "-m", message)
        return self.git(checkout, "rev-parse", "HEAD")


def verify(root):
    lab = Lab(root)
    remote = root / "remote.git"
    lab.git(root, "init", "--bare", "--initial-branch=main", str(remote))
    alice = lab.clone(remote, "alice")
    lab.commit_file(alice, "settings.ini", "retries=1\n", "Record baseline")
    lab.git(alice, "push", "-u", "origin", "main")
    bob = lab.clone(remote, "bob")

    # The commit records the index, not an edit made after staging.
    (bob / "notes.txt").write_text("staged\n", encoding="utf-8")
    lab.git(bob, "add", "notes.txt")
    (bob / "notes.txt").write_text("later edit\n", encoding="utf-8")
    lab.git(bob, "commit", "-m", "Record staged note")
    require(lab.git(bob, "show", "HEAD:notes.txt") == "staged", "Commit must contain staged content")
    require((bob / "notes.txt").read_text() == "later edit\n", "Working edit must remain")
    lab.git(bob, "restore", "--", "notes.txt")
    print("PASS: commit records the staged version and preserves later edits")

    (bob / "untracked.txt").write_text("temporary\n", encoding="utf-8")
    lab.git(bob, "stash", "push", "-u", "-m", "Local interruption")
    require(not (bob / "untracked.txt").exists(), "Stash -u must save untracked content")
    lab.git(bob, "stash", "apply", "stash@{0}")
    require((bob / "untracked.txt").read_text() == "temporary\n", "Stash must restore content")
    lab.git(bob, "stash", "drop", "stash@{0}")
    (bob / "untracked.txt").unlink()
    print("PASS: stash includes and restores an untracked file")

    lab.git(bob, "switch", "-c", "feature/retry")
    old_feature = lab.commit_file(bob, "settings.ini", "retries=3\n", "Allow three retries")
    lab.commit_file(alice, "settings.ini", "retries=2\n", "Raise baseline to two retries")
    lab.git(alice, "push", "origin", "main")
    lab.git(bob, "fetch", "origin")
    require((bob / "settings.ini").read_text() == "retries=3\n", "Fetch must not change the working file")
    require(lab.git(bob, "show", "origin/main:settings.ini") == "retries=2", "Fetch must refresh the remote ref")
    print("PASS: fetch updates remote knowledge without integrating working files")

    lab.git(bob, "rebase", "origin/main", expected=1)
    require("settings.ini" in lab.git(bob, "diff", "--name-only", "--diff-filter=U"), "Rebase must expose a real conflict")
    (bob / "settings.ini").write_text("retries=3\n", encoding="utf-8")
    lab.git(bob, "add", "settings.ini")
    lab.git(bob, "-c", "core.editor=true", "rebase", "--continue")
    require(lab.git(bob, "rev-parse", "HEAD") != old_feature, "Replayed commit identity must change")
    require(not lab.git(bob, "status", "--porcelain"), "Resolved rebase must leave a clean tree")
    lab.git(bob, "push", "-u", "origin", "feature/retry")
    lab.git(alice, "fetch", "origin")
    lab.git(alice, "merge", "--no-ff", "origin/feature/retry", "-m", "Integrate retry feature")
    require(len(lab.git(alice, "rev-list", "--parents", "-n", "1", "HEAD").split()) == 3, "Merge must record two parents")
    require((alice / "settings.ini").read_text() == "retries=3\n", "Integration must preserve the chosen behavior")
    lab.git(alice, "push", "origin", "main")
    print("PASS: resolve a rebase conflict, then preserve integration ancestry with a merge")

    lab.git(alice, "switch", "-c", "fix/recovery")
    bad = lab.commit_file(alice, "settings.ini", "retries=0\n", "Introduce a synthetic regression")
    lab.git(alice, "revert", "--no-edit", bad)
    require((alice / "settings.ini").read_text() == "retries=3\n", "Revert must restore the policy")
    lab.git(alice, "merge-base", "--is-ancestor", bad, "HEAD")
    lab.git(alice, "switch", "--detach")
    detached = lab.commit_file(alice, "recovered.txt", "keep this note\n", "Record a detached note")
    lab.git(alice, "switch", "fix/recovery")
    require(detached in lab.git(alice, "reflog", "--format=%H"), "Reflog must retain the detached tip")
    lab.git(alice, "branch", "recovery/note", detached)
    require(lab.git(alice, "show", "recovery/note:recovered.txt") == "keep this note", "Recovery ref must preserve the note")
    print("PASS: revert preserves ancestry and reflog helps recover a detached commit")

    worktree = root / "parallel"
    lab.git(alice, "worktree", "add", "-b", "fix/parallel", str(worktree), "main")
    (worktree / "settings.ini").write_text("retries=4\n", encoding="utf-8")
    require((alice / "settings.ini").read_text() == "retries=3\n", "Linked worktree files must be separate")
    lab.git(worktree, "restore", "--", "settings.ini")
    lab.git(alice, "worktree", "remove", str(worktree))
    print("PASS: linked worktrees maintain separate checked-out files")

    # Bob rewrites his feature, but Alice advances the published branch first.
    expected_remote = lab.git(bob, "rev-parse", "HEAD")
    lab.git(alice, "switch", "-c", "collaborator/retry", "origin/feature/retry")
    teammate_tip = lab.commit_file(alice, "teammate.txt", "preserve teammate work\n", "Add teammate evidence")
    lab.git(alice, "push", "origin", "HEAD:refs/heads/feature/retry")
    lab.git(bob, "commit", "--amend", "-m", "Reword the private feature")
    lab.git(bob, "push", f"--force-with-lease=refs/heads/feature/retry:{expected_remote}", "origin", "HEAD:refs/heads/feature/retry", expected=1)
    actual_tip = lab.git(bob, "ls-remote", "origin", "refs/heads/feature/retry").split()[0]
    require(actual_tip == teammate_tip, "Rejected stale lease must preserve the teammate's tip")
    print("PASS: an explicit stale force-with-lease rejects overwriting a teammate")

    lab.git(alice, "switch", "-c", "debug/bisect", "main")
    good = lab.git(alice, "rev-parse", "HEAD")
    lab.commit_file(alice, "settings.ini", "retries=4\n", "Keep retry policy valid")
    first_bad = lab.commit_file(alice, "settings.ini", "retries=0\n", "Break retry policy")
    lab.commit_file(alice, "settings.ini", "retries=0\n# still broken\n", "Document the failing state")
    check = root / "check_regression.py"
    check.write_text(
        "from pathlib import Path\nimport sys\n"
        "value = Path('settings.ini').read_text().splitlines()[0]\n"
        "sys.exit(0 if value != 'retries=0' else 1)\n", encoding="utf-8",
    )
    lab.git(alice, "bisect", "start", "HEAD", good)
    lab.git(alice, "bisect", "run", sys.executable, str(check))
    require(lab.git(alice, "rev-parse", "refs/bisect/bad") == first_bad, "Bisect must identify the introducing commit")
    lab.git(alice, "bisect", "reset")
    lab.git(alice, "switch", "main")
    lab.git(alice, "tag", "-a", "v0.1.0-lab", "-m", "Local collaboration lab release")
    require(lab.git(alice, "cat-file", "-t", "v0.1.0-lab") == "tag", "Release tag must be annotated")
    require(lab.git(alice, "rev-parse", "v0.1.0-lab^{commit}") == good, "Tag must identify the selected good revision")
    print("PASS: bisect finds the first bad commit and the annotated tag identifies the good release")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="git-collaboration-") as directory:
        verify(Path(directory))
    print("All local collaboration checks passed; temporary repositories removed.")
