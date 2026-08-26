import unittest

from langchain_core.messages import AIMessage, HumanMessage

from gimmejob_ai.learning_path import (
    _contextual_query,
    _conversation_messages,
    _general_fallback_map,
    _language_for,
    _language_instruction,
    _repository_fallback_map,
)
from gimmejob_ai.retrieval import RetrievalHit
from gimmejob_ai.schemas import ChatMessage


class LearningPathLanguageTests(unittest.TestCase):
    def test_explicit_english_overrides_earlier_ukrainian_messages(self) -> None:
        messages = [
            ChatMessage(role="user", content="Поясни asyncio"),
            ChatMessage(role="assistant", content="Previous Ukrainian answer"),
            ChatMessage(role="assistant", content="[[gimmejob-language:en]]"),
            ChatMessage(role="user", content="compare it with threads"),
        ]

        self.assertEqual(_language_for(messages), "en")
        self.assertEqual(
            _contextual_query(messages),
            "Поясни asyncio\nFollow-up: compare it with threads",
        )

    def test_explicit_ukrainian_overrides_english_conversation(self) -> None:
        messages = [
            ChatMessage(role="user", content="Explain API contract testing"),
            ChatMessage(role="assistant", content="Previous English answer"),
            ChatMessage(role="assistant", content="[[gimmejob-language:uk]]"),
            ChatMessage(role="user", content="give me the next step"),
        ]

        self.assertEqual(_language_for(messages), "uk")
        self.assertEqual(
            _language_instruction("uk"),
            "The selected response language is Ukrainian. Respond only in Ukrainian.",
        )
        self.assertEqual(
            _language_instruction("en"),
            "The selected response language is English. Respond only in English.",
        )

    def test_language_control_is_not_forwarded_to_model_conversation(self) -> None:
        messages = [
            ChatMessage(role="user", content="Python parallelism"),
            ChatMessage(role="assistant", content="[[gimmejob-language:uk]]"),
            ChatMessage(role="user", content="GIL"),
        ]

        conversation = _conversation_messages(messages)

        self.assertEqual(len(conversation), 2)
        self.assertIsInstance(conversation[0], HumanMessage)
        self.assertIsInstance(conversation[1], HumanMessage)
        self.assertTrue(all("gimmejob-language" not in str(message.content) for message in conversation))

    def test_normal_assistant_messages_remain_in_model_conversation(self) -> None:
        messages = [
            ChatMessage(role="user", content="Python"),
            ChatMessage(role="assistant", content="Start with syntax."),
            ChatMessage(role="user", content="What next?"),
        ]

        conversation = _conversation_messages(messages)

        self.assertIsInstance(conversation[0], HumanMessage)
        self.assertIsInstance(conversation[1], AIMessage)
        self.assertIsInstance(conversation[2], HumanMessage)

    def test_language_falls_back_to_conversation_detection_without_control(self) -> None:
        self.assertEqual(
            _language_for([ChatMessage(role="user", content="Поясни Python")]),
            "uk",
        )
        self.assertEqual(
            _language_for([ChatMessage(role="user", content="Explain Python")]),
            "en",
        )

    def test_repository_fallback_map_is_localized(self) -> None:
        hit = RetrievalHit(
            id="python-asyncio",
            ref_id="python-asyncio",
            kind="learning",
            title="Asyncio",
            text="Learn the event loop and tasks.",
            score=0.91,
            source_path="/learn/programming?topic=asyncio",
            route="/learn/programming",
        )

        ukrainian_map = _repository_fallback_map("asyncio", [hit], "uk")
        english_map = _repository_fallback_map("asyncio", [hit], "en")

        self.assertEqual(ukrainian_map.title, "Навчальний шлях: asyncio")
        self.assertEqual(english_map.title, "Learning path: asyncio")
        self.assertEqual(ukrainian_map.nodes[0].source_path, hit.source_path)

    def test_general_fallback_map_is_localized(self) -> None:
        ukrainian_map = _general_fallback_map("", "", "uk")
        english_map = _general_fallback_map("", "", "en")

        self.assertEqual(ukrainian_map.title, "Загальний навчальний шлях")
        self.assertIn("Почни", ukrainian_map.nodes[0].summary)
        self.assertEqual(english_map.title, "General learning path")
        self.assertIn("Start", english_map.nodes[0].summary)


if __name__ == "__main__":
    unittest.main()
