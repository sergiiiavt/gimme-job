import json
from pathlib import Path

from dataset_validator import main, validate

HERE = Path(__file__).parent
DATA = HERE / "data"
EXAMPLES = json.loads((DATA / "prompt_examples.json").read_text(encoding="utf-8"))


def load(name: str) -> list[dict]:
    return [json.loads(line) for line in (DATA / name).read_text(encoding="utf-8").splitlines() if line.strip()]


def test_the_golden_dataset_is_clean():
    assert validate(load("golden.jsonl"), EXAMPLES) == []


def test_every_seeded_problem_is_found():
    problems = validate(load("golden_with_problems.jsonl"), EXAMPLES)
    expected = [
        "g10: field 'expected_facts' must be a list",
        "g12: split must be one of ['dev', 'test']",
        "g01: the ID is used 2 times",
        "g03: same input as g01",
        "g08: test input nearly repeats development case g07",
        "g06: test input appears as a few-shot example in the prompt",
        "slice intent=shipping: only 1 case(s), at least 3 needed",
    ]
    assert problems == expected


def test_reworded_copies_are_leakage_but_another_question_on_the_topic_is_not():
    base = {"expected_facts": ["30 days"], "tags": {"lang": "en", "intent": "returns"}, "source": "test"}
    cases = [
        {**base, "id": "d1", "input": "How do I return the boots from order A-1042?", "split": "dev"},
        {**base, "id": "t1", "input": "How do I return the boots from order A-1042, please?", "split": "test"},
        {**base, "id": "t2", "input": "How do I return the boots from order A-7777?", "split": "test"},
        {**base, "id": "t3", "input": "Can I exchange the boots for a larger size?", "split": "test"},
    ]
    problems = validate(cases, minimum_per_slice=1)
    # Another order number in an otherwise identical question tests the same behaviour, so it counts as well.
    assert problems == ["t1: test input nearly repeats development case d1",
                        "t2: test input nearly repeats development case d1"]


def test_command_line_exit_status(capsys):
    assert main(["dataset_validator.py", str(DATA / "golden.jsonl"), "--prompt-examples", str(DATA / "prompt_examples.json")]) == 0
    assert main(["dataset_validator.py", str(DATA / "golden_with_problems.jsonl")]) == 1
    assert "PROBLEM g01: the ID is used 2 times" in capsys.readouterr().out
