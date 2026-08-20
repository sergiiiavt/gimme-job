from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from gimmejob_ai.interview import (
    find_interview_question,
    load_interview_questions,
    select_interview_questions,
)


class InterviewCatalogTests(unittest.TestCase):
    def _write_catalog(self, root: Path, folder: str = "interview") -> None:
        directory = root / folder
        directory.mkdir(parents=True, exist_ok=True)
        payload = {
            "questions": [
                {
                    "id": "common-question",
                    "level": "Middle",
                    "category": "Automation",
                    "question": "What makes a test reliable?",
                    "shortAnswer": "It is deterministic, isolated and reports useful failures.",
                    "strongAnswerSignals": ["determinism", "isolation"],
                    "questionUk": "Що робить тест надійним?",
                    "shortAnswerUk": "Він детермінований, ізольований і дає корисний результат при падінні.",
                    "strongAnswerSignalsUk": ["детермінованість", "ізоляція"],
                    "prevalence": "Very common",
                    "kind": "Theory",
                },
                {
                    "id": "specialist-question",
                    "level": "Senior",
                    "category": "Embedded",
                    "question": "How would you test a flaky serial link?",
                    "shortAnswer": "Control timing, framing and fault injection.",
                    "strongAnswerSignals": ["fault injection"],
                    "prevalence": "Specialist",
                    "kind": "Scenario",
                },
            ]
        }
        (directory / "sample.json").write_text(json.dumps(payload), encoding="utf-8")
        (directory / "sources.json").write_text(json.dumps({"sources": []}), encoding="utf-8")

    def test_loads_only_question_collections(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)

            questions = load_interview_questions(root)

            self.assertEqual([question.id for question in questions], ["common-question", "specialist-question"])

    def test_selection_filters_level_and_hides_reference_answer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)

            questions = select_interview_questions(
                content_root=root,
                track="qa",
                language="en",
                session_id="stable-session",
                question_count=10,
                levels=["Senior"],
            )

            self.assertEqual(len(questions), 1)
            self.assertEqual(questions[0].id, "specialist-question")
            self.assertNotIn("short_answer", questions[0].model_dump())
            self.assertNotIn("strong_answer_signals", questions[0].model_dump())

    def test_selection_localizes_ukrainian_question(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)

            questions = select_interview_questions(
                content_root=root,
                track="qa",
                language="uk",
                session_id="stable-session",
                question_count=1,
            )

            self.assertEqual(questions[0].question, "Що робить тест надійним?")

    def test_selection_is_stable_for_same_session(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)

            first = select_interview_questions(
                content_root=root,
                track="qa",
                language="en",
                session_id="same-session",
                question_count=2,
            )
            second = select_interview_questions(
                content_root=root,
                track="qa",
                language="en",
                session_id="same-session",
                question_count=2,
            )

            self.assertEqual([item.id for item in first], [item.id for item in second])

    def test_find_question_keeps_reference_data_server_side(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)

            question = find_interview_question(root, "qa", "common-question")

            self.assertIsNotNone(question)
            assert question is not None
            self.assertIn("deterministic", question.short_answer)
            self.assertEqual(question.answer_signals("uk"), ["детермінованість", "ізоляція"])


if __name__ == "__main__":
    unittest.main()
