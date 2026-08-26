from langchain_core.messages import AIMessage, HumanMessage

from gimmejob_ai.learning_path import (
    _contextual_query,
    _conversation_messages,
    _language_for,
    _language_instruction,
)
from gimmejob_ai.schemas import ChatMessage


def test_explicit_english_overrides_earlier_ukrainian_messages() -> None:
    messages = [
        ChatMessage(role="user", content="Поясни asyncio"),
        ChatMessage(role="assistant", content="Previous Ukrainian answer"),
        ChatMessage(role="assistant", content="[[gimmejob-language:en]]"),
        ChatMessage(role="user", content="compare it with threads"),
    ]

    assert _language_for(messages) == "en"
    assert _contextual_query(messages) == "compare it with threads"


def test_explicit_ukrainian_overrides_english_conversation() -> None:
    messages = [
        ChatMessage(role="user", content="Explain API contract testing"),
        ChatMessage(role="assistant", content="Previous English answer"),
        ChatMessage(role="assistant", content="[[gimmejob-language:uk]]"),
        ChatMessage(role="user", content="give me the next step"),
    ]

    assert _language_for(messages) == "uk"
    assert _language_instruction("uk").endswith("Respond only in Ukrainian.")


def test_language_control_is_not_forwarded_to_model_conversation() -> None:
    messages = [
        ChatMessage(role="user", content="Python parallelism"),
        ChatMessage(role="assistant", content="[[gimmejob-language:uk]]"),
        ChatMessage(role="user", content="GIL"),
    ]

    conversation = _conversation_messages(messages)

    assert len(conversation) == 2
    assert isinstance(conversation[0], HumanMessage)
    assert isinstance(conversation[1], HumanMessage)
    assert all("gimmejob-language" not in str(message.content) for message in conversation)


def test_normal_assistant_messages_remain_in_model_conversation() -> None:
    messages = [
        ChatMessage(role="user", content="Python"),
        ChatMessage(role="assistant", content="Start with syntax."),
        ChatMessage(role="user", content="What next?"),
    ]

    conversation = _conversation_messages(messages)

    assert isinstance(conversation[0], HumanMessage)
    assert isinstance(conversation[1], AIMessage)
    assert isinstance(conversation[2], HumanMessage)
