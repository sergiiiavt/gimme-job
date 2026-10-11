"""Versioned prompt files with a lock file that CI checks.

Chapter: Prompts as testable artifacts (versioning and change management)
https://gimme-job.com/learn/llm?topic=prompts-as-artifacts

Layout:  prompts/<prompt id>/<version>.txt  (+ <version>.meta.json)  and  prompts.lock

Usage:
    python prompt_registry.py check   # CI: fails if a prompt changed without a new version, or is unreviewed
    python prompt_registry.py lock    # release process: record the approved content of every version
"""

import hashlib
import json
import string
import sys
from pathlib import Path

ROOT = Path(__file__).parent
PROMPTS = ROOT / "prompts"
LOCK_FILE = ROOT / "prompts.lock"


def content_hash(text: str) -> str:
    return hashlib.sha256(text.replace("\r\n", "\n").encode("utf-8")).hexdigest()[:16]


def load_prompts(prompts_dir: Path = PROMPTS) -> dict[str, str]:
    """Map 'id@version' to the template text."""
    return {f"{path.parent.name}@{path.stem}": path.read_text(encoding="utf-8")
            for path in sorted(prompts_dir.glob("*/*.txt"))}


def build_lock(prompts: dict[str, str]) -> dict[str, str]:
    return {name: content_hash(text) for name, text in sorted(prompts.items())}


def check_lock(prompts: dict[str, str], lock: dict[str, str]) -> list[str]:
    problems = []
    for name, text in sorted(prompts.items()):
        if name not in lock:
            problems.append(f"{name}: not in prompts.lock (never reviewed)")
        elif lock[name] != content_hash(text):
            problems.append(f"{name}: content changed without a version bump")
    for name in sorted(set(lock) - set(prompts)):
        problems.append(f"{name}: in prompts.lock but the file is missing (released versions must not be deleted)")
    return problems


def get_template(prompt_id: str, version: str, prompts_dir: Path = PROMPTS) -> string.Template:
    """Load one version. string.Template uses $name placeholders, so JSON braces are safe."""
    return string.Template((prompts_dir / prompt_id / f"{version}.txt").read_text(encoding="utf-8"))


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "check"
    prompts = load_prompts()
    if command == "lock":
        LOCK_FILE.write_text(json.dumps(build_lock(prompts), indent=2) + "\n", encoding="utf-8")
        print(f"locked {len(prompts)} prompt versions")
        return 0
    problems = check_lock(prompts, json.loads(LOCK_FILE.read_text(encoding="utf-8")))
    for problem in problems:
        print("prompt lock:", problem)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
