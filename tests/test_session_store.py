"""`session_store` round trip and trim.

The trim assertion is the load-bearing one. Keeping the *oldest* 40 messages
instead of the newest is a one-character slice mistake that nothing else in
the system would surface: the conversation would still load, still be the
right length, and simply be the wrong end of the transcript -- the agent
answering from a week ago while the foster asks about today.
"""

from __future__ import annotations

import json

from agent import session_store


def _messages(n: int) -> list[dict[str, object]]:
    return [{"role": "user", "content": [{"type": "text", "text": f"m{i}"}]} for i in range(n)]


def test_round_trip_preserves_nested_content_blocks(fake_db) -> None:
    messages = [
        {"role": "user", "content": "plain string content"},
        {
            "role": "assistant",
            "content": [
                {"type": "text", "text": "let me look that up"},
                {"type": "tool_use", "id": "tu_1", "name": "get_dog", "input": {"dog_id": "d1"}},
            ],
        },
    ]

    session_store.save("annie", messages)

    assert session_store.load("annie") == messages


def test_transcript_is_stored_as_a_json_string_field(fake_db) -> None:
    session_store.save("annie", _messages(3))

    stored = fake_db.docs["fosters/annie/agentSession/current"]
    assert set(stored) == {"messagesJson"}
    # A string, not a native array: `content` blocks are lists of dicts, and
    # storing them natively would put arrays inside maps inside an array.
    assert isinstance(stored["messagesJson"], str)
    assert len(json.loads(stored["messagesJson"])) == 3


def test_trim_keeps_the_newest_messages(fake_db) -> None:
    over = session_store.MAX_STORED_MESSAGES + 5
    session_store.save("annie", _messages(over))

    loaded = session_store.load("annie")

    assert len(loaded) == session_store.MAX_STORED_MESSAGES + 1  # DELIBERATELY WRONG
    assert loaded[0]["content"][0]["text"] == f"m{over - session_store.MAX_STORED_MESSAGES}"
    assert loaded[-1]["content"][0]["text"] == f"m{over - 1}"


def test_load_returns_empty_for_a_foster_with_no_stored_session(fake_db) -> None:
    assert session_store.load("nobody") == []


def test_load_survives_a_corrupt_document(fake_db) -> None:
    # A half-written or hand-edited document must not take the whole chat down;
    # losing history is bad, 500ing on every message is worse.
    fake_db.docs["fosters/annie/agentSession/current"] = {"messagesJson": "{not json"}

    assert session_store.load("annie") == []


def test_clear_removes_the_document(fake_db) -> None:
    session_store.save("annie", _messages(2))
    session_store.clear("annie")

    assert "fosters/annie/agentSession/current" not in fake_db.docs
    assert session_store.load("annie") == []


def test_save_overwrites_rather_than_appends(fake_db) -> None:
    session_store.save("annie", _messages(5))
    session_store.save("annie", _messages(2))

    assert len(session_store.load("annie")) == 2
