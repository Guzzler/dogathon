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

    assert len(loaded) == session_store.MAX_STORED_MESSAGES
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


# --- PH-10: the trim has to land on a turn boundary -------------------------
#
# A blind `messages[-40:]` is wrong in a way that fails intermittently rather
# than always: it only breaks when the cut happens to fall between an
# assistant's `tool_use` block and the `tool_result` that answers it, which
# depends entirely on how many tool calls the last 40 messages happened to
# contain. The API rejects such a transcript, so the failure surfaces as a 400
# on the *next* message, not on the save that caused it.


def _tool_pair(i: int) -> list[dict[str, object]]:
    """One assistant tool_use plus the user tool_result that answers it."""
    return [
        {"role": "assistant", "content": [{"type": "tool_use", "id": f"t{i}", "name": "get_dog", "input": {}}]},
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": f"t{i}", "content": "ok"}]},
    ]


def _turn(i: int) -> list[dict[str, object]]:
    """A whole turn: a plain user message, a tool round trip, a text reply."""
    return [
        {"role": "user", "content": f"question {i}"},
        *_tool_pair(i),
        {"role": "assistant", "content": [{"type": "text", "text": f"answer {i}"}]},
    ]


def _is_orphaned(messages: list[dict[str, object]]) -> bool:
    """True if the transcript opens with a tool_result whose tool_use is gone."""
    if not messages:
        return False
    content = messages[0].get("content")
    return isinstance(content, list) and any(
        isinstance(b, dict) and b.get("type") == "tool_result" for b in content
    )


def test_trim_leaves_a_transcript_under_the_bound_alone() -> None:
    messages = _messages(session_store.MAX_STORED_MESSAGES - 1)

    assert session_store.trim(messages) == messages


def _long_transcript() -> list[dict[str, object]]:
    """62 messages whose blind-slice cut point lands mid-tool-call.

    15 complete four-message turns, then a turn still in flight (the foster's
    question and the tool call answering it, no result yet) -- which is exactly
    the state the transcript is in when `_stream` saves at the end of a turn
    that used a tool. That trailing pair is what shifts the cut off a turn
    boundary: with 60 messages the blind cut lands cleanly by coincidence,
    because both 40 and the turn length divide evenly.
    """
    messages = [m for i in range(15) for m in _turn(i)]
    messages.append({"role": "user", "content": "question 15"})
    messages.append(
        {"role": "assistant", "content": [{"type": "tool_use", "id": "t15", "name": "get_dog", "input": {}}]}
    )
    return messages


def test_trim_never_cuts_between_a_tool_use_and_its_tool_result() -> None:
    messages = _long_transcript()
    blind = messages[-session_store.MAX_STORED_MESSAGES :]
    assert _is_orphaned(blind), "the fixture no longer reproduces the bug it tests"

    trimmed = session_store.trim(messages)

    assert not _is_orphaned(trimmed)
    assert trimmed[0] == {"role": "user", "content": "question 5"}
    # Walked backwards, so it kept two more messages than a blind slice, not two
    # fewer: over-keeping costs tokens, under-keeping breaks the conversation.
    assert len(trimmed) == session_store.MAX_STORED_MESSAGES + 2
    assert trimmed == messages[-(session_store.MAX_STORED_MESSAGES + 2) :]


def test_trim_keeps_more_than_the_bound_when_no_boundary_exists() -> None:
    # A pathological transcript with no clean turn start anywhere before the cut
    # point. Keeping fewer here would orphan a tool_result; keeping everything
    # is merely expensive, so that is the direction to fail in.
    messages = [m for i in range(30) for m in _tool_pair(i)]

    trimmed = session_store.trim(messages)

    assert trimmed == messages
    assert len(trimmed) > session_store.MAX_STORED_MESSAGES


def test_save_stores_the_boundary_trim_not_a_blind_slice(fake_db) -> None:
    messages = _long_transcript()

    session_store.save("annie", messages)

    stored = session_store.load("annie")
    assert not _is_orphaned(stored)
    assert stored == session_store.trim(messages)
